import { Injectable } from '@nestjs/common';
import { Prisma, type ApArRefType, type ApArSide, type Currency } from '@prisma/client';
import {
  buildCashPosting,
  buildGoldPosting,
  dec,
  findPostingRule,
  type CashApArReason,
  type Decimal,
  type GoldPostingRule,
  type MovementType,
  type StockScope,
} from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessDayService } from './business-day.service';

const D = (value: Decimal) => new Prisma.Decimal(value.toFixed());
const toDec = (value: Prisma.Decimal | null | undefined) => dec(value?.toFixed() ?? 0);

/** Maps a domain posting reason onto the persisted ApArRefType enum. */
const REF_TYPE: Record<CashApArReason, ApArRefType> = {
  LABOR_PAYABLE: 'LABOR_PAYABLE',
  LABOR_PAYMENT: 'LABOR_PAYMENT',
  CREDIT_ISSUED: 'CREDIT_ISSUED',
  CREDIT_RECEIPT: 'CREDIT_RECEIPT',
  MANUAL_AP: 'ADJUSTMENT',
  MANUAL_AP_PAYMENT: 'ADJUSTMENT',
  MANUAL_AR: 'ADJUSTMENT',
  MANUAL_AR_RECEIPT: 'ADJUSTMENT',
  ADJUSTMENT: 'ADJUSTMENT',
};

export interface CashPostingInput {
  reason: CashApArReason;
  currency: Currency;
  amount: Decimal;
  refId?: string;
  /** ແຫຼ່ງ Supplier the obligation is owed to or by (TOR §9.3, §9.4). */
  partnerId?: string;
  /** ປະເພດລາຍການ AP-AR (Cash) (TOR §9.1). */
  categoryId?: string;
  note?: string;
  createdById: string;
}

export interface GoldPostingInput {
  scope: StockScope;
  type: MovementType;
  partnerId: string;
  weightG: Decimal;
  cost: Decimal;
  movementId?: string;
  refType: ApArRefType;
  note?: string;
  createdById: string;
}

/**
 * Writes into the two AP/AR sub-ledgers (TOR §8, §9).
 *
 * Both ledgers accumulate exactly like the stock ledgers — each row carries
 * the running balance after it — so a History table renders without
 * recomputation and a balance can be explained row by row.
 *
 * Every method takes a transaction client: an AP/AR posting is only ever
 * valid as part of the transaction that caused it.
 */
@Injectable()
export class ApArPostingService {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------------------------------------------------------------- *
   * §9 — AP/AR (Cash)
   * ---------------------------------------------------------------- */

  /**
   * Post one cash-side movement. The direction (AP vs AR, increase vs
   * decrease) comes from the domain posting table, so no caller has to
   * remember which way round a given event goes.
   */
  async postCash(tx: Prisma.TransactionClient, input: CashPostingInput) {
    if (input.amount.lte(0)) return null;

    const posting = buildCashPosting(input.reason, input.currency, input.amount);
    const businessDate = BusinessDayService.toDateOnly();

    const previous = await tx.cashApArLedger.findFirst({
      where: {
        side: posting.side,
        currency: input.currency,
        ...(input.partnerId ? { partnerId: input.partnerId } : {}),
        deletedAt: null,
      },
      orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
    });

    const lastToday = await tx.cashApArLedger.findFirst({
      where: { side: posting.side, currency: input.currency, businessDate },
      orderBy: { sequence: 'desc' },
    });

    const balance = toDec(previous?.balance)
      .plus(posting.amountIn)
      .minus(posting.amountOut);

    return tx.cashApArLedger.create({
      data: {
        side: posting.side,
        refType: REF_TYPE[input.reason],
        refId: input.refId ?? null,
        partnerId: input.partnerId ?? null,
        categoryId: input.categoryId ?? null,
        businessDate,
        currency: input.currency,
        amountIn: D(posting.amountIn),
        amountOut: D(posting.amountOut),
        balance: D(balance),
        sequence: (lastToday?.sequence ?? 0) + 1,
        note: input.note ?? null,
        createdById: input.createdById,
      },
    });
  }

  /* ---------------------------------------------------------------- *
   * §8 — AP/AR (GOLD)
   * ---------------------------------------------------------------- */

  /** The Admin-editable posting rules, loaded as the domain shape. */
  async loadGoldRules(
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<GoldPostingRule[]> {
    const rows = await client.goldApArPostingRule.findMany({
      where: { isActive: true },
      include: { partner: true, counterparty: true },
    });
    return rows.map((row) => ({
      scope: row.scope as StockScope,
      type: row.type as MovementType,
      partnerCode: row.partner.code,
      side: row.side as ApArSide,
      sign: row.sign === 1 ? 1 : -1,
      counterpartyCode: row.counterparty?.code ?? null,
    }));
  }

  /**
   * Post a gold movement, if the partner is tracked for AP/AR.
   *
   * Returns null when no rule matches — a movement to a display cabinet or a
   * wholesale customer creates no obligation, which is a normal outcome
   * rather than an error.
   */
  async postGold(tx: Prisma.TransactionClient, input: GoldPostingInput) {
    const partner = await tx.partnerSource.findUnique({ where: { id: input.partnerId } });
    if (!partner || !partner.tracksGoldApAr) return null;

    const rules = await this.loadGoldRules(tx);
    const rule = findPostingRule(rules, input.scope, input.type, partner.code);
    if (!rule) return null;

    const posting = buildGoldPosting(rule, input.weightG, input.cost);
    const businessDate = BusinessDayService.toDateOnly();

    /*
     * Which partner's obligation moves. Normally the one on the movement, but
     * TOR §8.4 pairs Stock IN from EASY with Stock OUT to WITHDRAW: handing
     * gold to WITHDRAW is what clears EASY's payable. Booking that against
     * WITHDRAW would leave EASY's balance climbing forever and WITHDRAW's
     * running negative, so the pair has to settle on one row.
     */
    const bookAgainst = rule.counterpartyCode
      ? ((await tx.partnerSource.findUnique({ where: { code: rule.counterpartyCode } })) ?? partner)
      : partner;
    const ledgerPartnerId = bookAgainst.id;

    const previous = await tx.goldApArLedger.findFirst({
      where: { partnerId: ledgerPartnerId, side: posting.side, deletedAt: null },
      orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
    });

    const lastToday = await tx.goldApArLedger.findFirst({
      where: { partnerId: ledgerPartnerId, side: posting.side, businessDate },
      orderBy: { sequence: 'desc' },
    });

    const weightG = toDec(previous?.weightG).plus(posting.goldInG).minus(posting.goldOutG);
    const cost = toDec(previous?.cost).plus(posting.priceIn).minus(posting.priceOut);

    return tx.goldApArLedger.create({
      data: {
        partnerId: ledgerPartnerId,
        side: posting.side,
        refType: input.refType,
        movementId: input.movementId ?? null,
        businessDate,
        typeLabel: `${input.scope} ${input.type} — ${partner.nameLo}`,
        goldInG: D(posting.goldInG),
        goldOutG: D(posting.goldOutG),
        priceIn: D(posting.priceIn),
        priceOut: D(posting.priceOut),
        weightG: D(weightG),
        cost: D(cost),
        sequence: (lastToday?.sequence ?? 0) + 1,
        note: input.note ?? null,
        createdById: input.createdById,
      },
    });
  }
}
