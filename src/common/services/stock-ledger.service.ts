import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calculateWac, dec, type Decimal } from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessDayService } from './business-day.service';

const D = (value: Decimal) => new Prisma.Decimal(value.toFixed());
const toDec = (value: Prisma.Decimal | null | undefined) => dec(value?.toFixed() ?? 0);

export interface StockPosting {
  businessDayId: string;
  goldInG?: Decimal;
  goldOutG?: Decimal;
  priceIn?: Decimal;
  priceOut?: Decimal;
  /** ແຫຼ່ງ column in the History table. */
  partnerLabel?: string;
  /** Type column — what produced the row. */
  typeLabel: string;
  movementId?: string;
  createdById: string;
}

export interface OldStockPosting extends StockPosting {
  /** Which ປະເພດຄຳ bucket the weight belongs to. */
  goldTypeId: string;
}

export interface LedgerPosition {
  weightG: Decimal;
  cost: Decimal;
}

/**
 * Writes rows into the Stock (NEW) and Stock (OLD) ledgers.
 *
 * Extracted here because Buyback, Exchange, Stock movements, gold handovers
 * and the FACTORY completion all append to the same two ledgers under the
 * same §7.1/§7.2 accumulation contract:
 *
 *   WEIGHT  = previous WEIGHT  + GOLD(g) IN − GOLD(g) OUT
 *   ຕົ້ນທຶນ  = previous ຕົ້ນທຶນ + PRICE (IN) − PRICE (OUT)
 *
 * Note the running columns accumulate across the WHOLE warehouse, not per
 * ປະເພດຄຳ: §7.2 reads GOLD (g) OLD and ຕົ້ນທຶນຄຳ OLD off the latest row, and
 * its History table has no ປະເພດຄຳ column. The per-type split lives in
 * `StockOldTypeBalance` instead.
 *
 * Every method takes a transaction client — a stock posting is never valid on
 * its own, only as part of the transaction that caused it.
 */
@Injectable()
export class StockLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** GOLD (g) NEW and ຕົ້ນທຶນຄຳ NEW — the latest row (§7.1). */
  async newPosition(client: Prisma.TransactionClient | PrismaService = this.prisma): Promise<LedgerPosition> {
    const last = await client.stockNewLedger.findFirst({
      where: { deletedAt: null },
      orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
    });
    return { weightG: toDec(last?.weightG), cost: toDec(last?.cost) };
  }

  /** GOLD (g) OLD and ຕົ້ນທຶນຄຳ OLD — the latest row (§7.2). */
  async oldPosition(client: Prisma.TransactionClient | PrismaService = this.prisma): Promise<LedgerPosition> {
    const last = await client.stockOldLedger.findFirst({
      where: { deletedAt: null },
      orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
    });
    return { weightG: toDec(last?.weightG), cost: toDec(last?.cost) };
  }

  /** WAC ປັດຈຸບັນ (§3.7) — always computed from the newest NEW and OLD rows. */
  async currentWac(client: Prisma.TransactionClient | PrismaService = this.prisma) {
    const [newPos, oldPos] = await Promise.all([
      this.newPosition(client),
      this.oldPosition(client),
    ]);
    return {
      ...calculateWac({
        newWeightG: newPos.weightG,
        newCost: newPos.cost,
        oldWeightG: oldPos.weightG,
        oldCost: oldPos.cost,
      }),
      newPosition: newPos,
      oldPosition: oldPos,
    };
  }

  /** Next sequence number within a business date, per ledger. */
  private async nextSequence(
    tx: Prisma.TransactionClient,
    ledger: 'NEW' | 'OLD',
    businessDate: Date,
  ): Promise<number> {
    const last =
      ledger === 'NEW'
        ? await tx.stockNewLedger.findFirst({
            where: { businessDate },
            orderBy: { sequence: 'desc' },
          })
        : await tx.stockOldLedger.findFirst({
            where: { businessDate },
            orderBy: { sequence: 'desc' },
          });
    return (last?.sequence ?? 0) + 1;
  }

  /** Append one row to the Stock (NEW) history. */
  async postNew(tx: Prisma.TransactionClient, input: StockPosting) {
    const businessDate = BusinessDayService.toDateOnly();
    const previous = await this.newPosition(tx);

    const goldInG = input.goldInG ?? dec(0);
    const goldOutG = input.goldOutG ?? dec(0);
    const priceIn = input.priceIn ?? dec(0);
    const priceOut = input.priceOut ?? dec(0);

    return tx.stockNewLedger.create({
      data: {
        movementId: input.movementId ?? null,
        businessDate,
        partnerLabel: input.partnerLabel ?? null,
        typeLabel: input.typeLabel,
        goldInG: D(goldInG),
        goldOutG: D(goldOutG),
        priceIn: D(priceIn),
        priceOut: D(priceOut),
        weightG: D(previous.weightG.plus(goldInG).minus(goldOutG)),
        cost: D(previous.cost.plus(priceIn).minus(priceOut)),
        sequence: await this.nextSequence(tx, 'NEW', businessDate),
        createdById: input.createdById,
      },
    });
  }

  /**
   * Append one row to the Stock (OLD) history and refresh that ປະເພດຄຳ's
   * balance for the day. Both happen together so the global ledger and the
   * per-type breakdown can never disagree.
   */
  async postOld(tx: Prisma.TransactionClient, input: OldStockPosting) {
    const businessDate = BusinessDayService.toDateOnly();
    const previous = await this.oldPosition(tx);

    const goldInG = input.goldInG ?? dec(0);
    const goldOutG = input.goldOutG ?? dec(0);
    const priceIn = input.priceIn ?? dec(0);
    const priceOut = input.priceOut ?? dec(0);

    const row = await tx.stockOldLedger.create({
      data: {
        movementId: input.movementId ?? null,
        goldTypeId: input.goldTypeId,
        businessDate,
        partnerLabel: input.partnerLabel ?? null,
        typeLabel: input.typeLabel,
        goldInG: D(goldInG),
        goldOutG: D(goldOutG),
        priceIn: D(priceIn),
        priceOut: D(priceOut),
        weightG: D(previous.weightG.plus(goldInG).minus(goldOutG)),
        cost: D(previous.cost.plus(priceIn).minus(priceOut)),
        sequence: await this.nextSequence(tx, 'OLD', businessDate),
        createdById: input.createdById,
      },
    });

    await this.refreshTypeBalance(tx, {
      businessDayId: input.businessDayId,
      goldTypeId: input.goldTypeId,
      goldInG,
      goldOutG,
      priceIn,
      priceOut,
    });

    return row;
  }

  /**
   * ນໍ້າໜັກ(g) ຄົງເຫຼືອ = ຕັ້ງຕົ້ນ + IN − OUT
   * ຕົ້ນທຶນຄົງເຫຼືອ      = ຕົ້ນທຶນຕັ້ງຕົ້ນ + PRICE (IN) − PRICE (OUT)
   *
   * The opening figures are written by the day-rollover job and are never
   * touched here, so re-running a posting can only move the movement columns.
   */
  private async refreshTypeBalance(
    tx: Prisma.TransactionClient,
    input: {
      businessDayId: string;
      goldTypeId: string;
      goldInG: Decimal;
      goldOutG: Decimal;
      priceIn: Decimal;
      priceOut: Decimal;
    },
  ) {
    const key = {
      businessDayId_goldTypeId: {
        businessDayId: input.businessDayId,
        goldTypeId: input.goldTypeId,
      },
    };

    const existing = await tx.stockOldTypeBalance.findUnique({ where: key });

    const openingWeightG = toDec(existing?.openingWeightG);
    const openingCost = toDec(existing?.openingCost);
    const inG = toDec(existing?.inG).plus(input.goldInG);
    const outG = toDec(existing?.outG).plus(input.goldOutG);
    const priceIn = toDec(existing?.priceIn).plus(input.priceIn);
    const priceOut = toDec(existing?.priceOut).plus(input.priceOut);

    const data = {
      inG: D(inG),
      outG: D(outG),
      priceIn: D(priceIn),
      priceOut: D(priceOut),
      closingWeightG: D(openingWeightG.plus(inG).minus(outG)),
      closingCost: D(openingCost.plus(priceIn).minus(priceOut)),
    };

    await tx.stockOldTypeBalance.upsert({
      where: key,
      update: data,
      create: {
        businessDayId: input.businessDayId,
        goldTypeId: input.goldTypeId,
        ...data,
      },
    });
  }

  /**
   * ນໍ້າໜັກ g ທີ່ມີຢູ່ຈິງ for a ປະເພດຄຳ — what §7.2's stock-out guard checks
   * an OUT against.
   */
  async availableOldWeight(
    goldTypeId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Decimal> {
    const balance = await client.stockOldTypeBalance.findFirst({
      where: { goldTypeId },
      orderBy: { updatedAt: 'desc' },
    });
    return toDec(balance?.closingWeightG);
  }
}
