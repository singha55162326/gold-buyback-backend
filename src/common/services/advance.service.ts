import { Injectable } from '@nestjs/common';
import { Prisma, type Currency, type PaymentMethod } from '@prisma/client';
import { dec, netAdvance, type Decimal } from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessDayService } from './business-day.service';
import { HistoryRangeService } from './history-range.service';
import type { HistoryRangeDto } from '../dto/history-range.dto';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

const D = (value: Decimal) => new Prisma.Decimal(value.toFixed());
const toDec = (value: Prisma.Decimal | null | undefined) => dec(value?.toFixed() ?? 0);

export interface AdvancePostingInput {
  orderId: string;
  currency: Currency;
  amount: Decimal;
  direction: 'IN' | 'OUT';
  method?: PaymentMethod;
  bankAccountId?: string | null;
  note?: string;
  createdById: string;
}

/**
 * Module Advace (TOR §7).
 *
 * ເງິນມັດຈໍາ Order ຮັບລ່ວງໜ້າ has its own ledger in the updated TOR, separate
 * from AP (Cash) — which §9.2 now scopes to ຄ່າແຮງຊ່າງຄ້າງຈ່າຍ alone.
 *
 *   Order ສຳເລັດ           -> +Advance
 *   ຢືນຢັນລູກຄ້າຮັບເຄື່ອງ  -> −Advance
 *
 * COH Cash subtracts the net, so money the shop is holding against an
 * undelivered order never reads as its own.
 */
@Injectable()
export class AdvanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly range: HistoryRangeService,
  ) {}

  async post(tx: Prisma.TransactionClient, input: AdvancePostingInput) {
    if (input.amount.lte(0)) return null;

    const businessDate = BusinessDayService.toDateOnly();
    const isIn = input.direction === 'IN';

    const previous = await tx.advanceLedger.findFirst({
      where: { currency: input.currency, deletedAt: null },
      orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
    });

    const lastToday = await tx.advanceLedger.findFirst({
      where: { currency: input.currency, businessDate },
      orderBy: { sequence: 'desc' },
    });

    const balance = isIn
      ? toDec(previous?.balance).plus(input.amount)
      : toDec(previous?.balance).minus(input.amount);

    return tx.advanceLedger.create({
      data: {
        orderId: input.orderId,
        businessDate,
        currency: input.currency,
        amountIn: D(isIn ? input.amount : dec(0)),
        amountOut: D(isIn ? dec(0) : input.amount),
        balance: D(balance),
        method: input.method ?? null,
        bankAccountId: input.bankAccountId ?? null,
        sequence: (lastToday?.sequence ?? 0) + 1,
        note: input.note ?? null,
        createdById: input.createdById,
      },
    });
  }

  /** ຍອດ Advance ສຸດທິ per currency — what COH subtracts. */
  async netByCurrency(
    client: Prisma.TransactionClient | PrismaService = this.prisma,
    asOf?: Date,
  ): Promise<Record<Currency, Decimal>> {
    const rows = await client.advanceLedger.groupBy({
      by: ['currency'],
      where: { deletedAt: null, ...(asOf ? { businessDate: { lte: asOf } } : {}) },
      _sum: { amountIn: true, amountOut: true },
    });

    const result = { LAK: dec(0), THB: dec(0), USD: dec(0) } as Record<Currency, Decimal>;
    for (const row of rows) {
      result[row.currency] = netAdvance(
        toDec(row._sum.amountIn),
        toDec(row._sum.amountOut),
      );
    }
    return result;
  }

  /** ໜ້າຕ່າງ Module Advace: ລວມຍອດເງິນ Advace, ລວມຈຳນວນບິນ (TOR §7). */
  async summary() {
    const [net, openOrders] = await Promise.all([
      this.netByCurrency(),
      this.prisma.order.count({
        where: { deletedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }),
    ]);

    return {
      totals: (['LAK', 'THB', 'USD'] as const).map((currency) => ({
        currency,
        net: net[currency].toFixed(),
      })),
      billCount: openOrders,
    };
  }

  /**
   * History for the Advance module, keyed to the order it belongs to.
   *
   * ຄ່າເລີ່ມຕົ້ນ = ມື້ນີ້ ແລະ ກວ້າງອອກໄດ້ຕາມສິດ. ກອງຕາມ businessDate (ເປັນ
   * ຖັນວັນທີລ້ວນ) ບໍ່ແມ່ນ createdAt, ເພາະລາຍການຂອງມື້ການຄ້າໜຶ່ງອາດຖືກ
   * ບັນທຶກຫຼັງທ່ຽງຄືນ.
   */
  async history(query: HistoryRangeDto, user?: AuthenticatedUser) {
    const range = this.range.resolve(query, user);
    const where = {
      deletedAt: null,
      businessDate: HistoryRangeService.dayWindow(range),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.advanceLedger.findMany({
        where,
        include: {
          // The View detail in §7 needs the full order context.
          order: { include: { customer: true, goldItem: true, supplier: true } },
          bankAccount: true,
        },
        orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
        skip: range.skip,
        take: range.take,
      }),
      this.prisma.advanceLedger.count({ where }),
    ]);

    return this.range.page(
      rows.map((row) => {
        /*
         * ຍອດເງິນສຸດທິ = ຍອດເງິນທີ່ໄດ້ຮັບ − ຍອດຄົງເຫຼືອຮັບ − ຍອດເງິນຕັດຊຳລະ
         * ຕາມທີ່ລູກຄ້າກຳນົດ. ຄຳນວນຢູ່ server ເພື່ອບໍ່ໃຫ້ສອງໜ້າຈໍຄຳນວນຄົນລະແບບ.
         */
        const received = toDec(row.amountIn);
        const outstanding = toDec(row.order.balanceAmount);
        const settled = toDec(row.amountOut);
        return {
          ...row,
          outstandingAmount: outstanding.toFixed(),
          netAmount: received.minus(outstanding).minus(settled).toFixed(),
        };
      }),
      total,
      range,
    );
  }
}
