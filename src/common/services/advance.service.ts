import { Injectable } from '@nestjs/common';
import { Prisma, type Currency, type PaymentMethod } from '@prisma/client';
import { dec, netAdvance, type Decimal } from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessDayService } from './business-day.service';
import { AuditService } from './audit.service';
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
  /**
   * ບັນທຶກແຖວ ເຖິງວ່າຈຳນວນເງິນເປັນ 0.
   *
   * ໃຊ້ຕອນສ້າງ Order ທີ່ຍັງບໍ່ໄດ້ຮັບເງິນມັດຈຳ: ລູກຄ້າຕ້ອງການເຫັນ Order ນັ້ນ
   * ຢູ່ Module Advance ຕັ້ງແຕ່ສ້າງ ບໍ່ແມ່ນລໍຖ້າຈົນມີເງິນເຂົ້າ.
   */
  allowZero?: boolean;
  /** ວັນທີທຸລະກຳ (ໃຊ້ຕອນແກ້ໄຂ Order ເກົ່າ ເພື່ອຮັກສາວັນທີເດີມ). */
  businessDate?: Date;
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
    private readonly audit: AuditService,
  ) {}

  async post(tx: Prisma.TransactionClient, input: AdvancePostingInput) {
    if (input.amount.lte(0) && !input.allowZero) return null;

    const businessDate = input.businessDate ?? BusinessDayService.toDateOnly();
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

  /**
   * ລົບລ້າງຍອດ Advance ຄົງເຫຼືອຂອງ Order ແຍກຕາມສະກຸນເງິນທີ່ຮັບຈິງ.
   *
   * ໃຊ້ເມື່ອ Order ສຳເລັດ (COMPLETED) ຫຼື ຍົກເລີກ (CANCELLED) ເພື່ອບໍ່ໃຫ້ຍອດ
   * THB / USD ຄ້າງບວກ ຫຼື LAK ຕິດລົບຈາກການຕັດຂ້າມສະກຸນເງິນ.
   */
  async settleOrderAdvance(
    tx: Prisma.TransactionClient,
    order: { id: string; code: string },
    createdById: string,
    note?: string,
    businessDate?: Date,
  ) {
    const groups = await tx.advanceLedger.groupBy({
      by: ['currency'],
      where: { orderId: order.id, deletedAt: null },
      _sum: { amountIn: true, amountOut: true },
    });

    const settledEntries = [];
    for (const g of groups) {
      const net = toDec(g._sum.amountIn).minus(toDec(g._sum.amountOut));
      if (net.gt(0)) {
        const entry = await this.post(tx, {
          orderId: order.id,
          currency: g.currency,
          amount: net,
          direction: 'OUT',
          businessDate,
          note: note ?? `ຢືນຢັນລູກຄ້າຮັບເຄື່ອງ ${order.code} — ລົບລ້າງພັນທະມັດຈໍາ`,
          createdById,
        });
        if (entry) settledEntries.push(entry);
      }
    }
    return settledEntries;
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
   *
   * ລວມທັງ Order ທີ່ຍັງບໍ່ທັນປິດ ຫຼື ຍັງມີຍອດ Advance ຄ້າງຢູ່ ເພື່ອບໍ່ໃຫ້ບິນຄ້າງ
   * ຂ້າມມື້ຫາຍໄປຈາກໜ້າຈໍ ແລະ ດຶງທຸກຂາການເຄື່ອນໄຫວຂອງ Order ທີ່ເຂົ້າເງື່ອນໄຂ
   * ເພື່ອໃຫ້ການລວມຍອດຕາມ Order ຄົບຖ້ວນ.
   */
  async history(query: HistoryRangeDto, user?: AuthenticatedUser) {
    const range = this.range.resolve(query, user);
    const dayWin = HistoryRangeService.dayWindow(range);

    const [advGroups, rangeOrders] = await Promise.all([
      this.prisma.advanceLedger.groupBy({
        by: ['orderId', 'currency'],
        where: { deletedAt: null },
        _sum: { amountIn: true, amountOut: true },
      }),
      this.prisma.advanceLedger.findMany({
        where: { deletedAt: null, businessDate: dayWin },
        select: { orderId: true },
        distinct: ['orderId'],
      }),
    ]);

    const unsettledOrderIds = advGroups
      .filter((g) => toDec(g._sum.amountIn).gt(toDec(g._sum.amountOut)))
      .map((g) => g.orderId);

    const activeOrderIds = Array.from(
      new Set([...rangeOrders.map((r) => r.orderId), ...unsettledOrderIds]),
    );

    const where: Prisma.AdvanceLedgerWhereInput = {
      deletedAt: null,
      order: { deletedAt: null },
      OR: [
        { businessDate: dayWin },
        { order: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } },
        ...(activeOrderIds.length > 0 ? [{ orderId: { in: activeOrderIds } }] : []),
      ],
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.advanceLedger.findMany({
        where,
        include: {
          // The View detail in §7 needs the full order context.
          order: {
            include: {
              customer: true,
              goldItem: true,
              supplier: true,
              receipts: true,
              lines: { include: { goldItem: true }, orderBy: { sortOrder: 'asc' } },
            },
          },
          bankAccount: true,
        },
        orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
        skip: range.skip,
        take: range.take,
      }),
      this.prisma.advanceLedger.count({ where }),
    ]);

    // ຜູ້ບັນທຶກ — ລູກຄ້າຂໍໃຫ້ເຫັນທຸກ Module ທີ່ມີການລົງລາຍການ.
    const withActors = await this.audit.withCreatorNames(rows);

    return this.range.page(
      withActors.map((row) => {
        const received = toDec(row.amountIn);
        const outstanding = toDec(row.order.balanceAmount);
        const settled = toDec(row.amountOut);

        // คำนวณ Order Currency และ Balance บน Server เพื่อความแม่นยำทางบัญชี
        let cur = (row.order.currency as string) || 'LAK';
        let totalInCur = row.order.originalTotalAmount ? toDec(row.order.originalTotalAmount) : null;
        const noteText = row.order.note ?? row.note ?? '';
        const match = noteText.match(/\[TOTAL:\s*([\d,.]+)\s*(THB|USD|LAK)\]/);

        if (cur === 'LAK' && match) {
          cur = match[2];
          totalInCur = dec(match[1].replace(/,/g, ''));
        }

        if (!totalInCur || cur === 'LAK') {
          totalInCur = toDec(row.order.totalAmount);
        }

        let balanceInCur = dec(0);
        if (outstanding.gt(0)) {
          if (cur === 'LAK') {
            balanceInCur = outstanding;
          } else {
            const nonRefundReceipts = (row.order.receipts ?? []).filter((r) => !r.isRefund);
            const allSameCur =
              nonRefundReceipts.length > 0 && nonRefundReceipts.every((r) => r.currency === cur);

            if (allSameCur) {
              const rcvdInCur = nonRefundReceipts.reduce((s, r) => s.plus(toDec(r.amount)), dec(0));
              const diff = totalInCur.minus(rcvdInCur);
              balanceInCur = diff.gt(0) ? diff : dec(0);
            } else {
              const exRate = toDec(row.order.exchangeRate);
              if (exRate.gt(0)) {
                balanceInCur = outstanding.div(exRate).toDecimalPlaces(2);
              } else {
                const rcvdInCur = nonRefundReceipts
                  .filter((r) => r.currency === cur)
                  .reduce((s, r) => s.plus(toDec(r.amount)), dec(0));
                const effectiveRcvd = rcvdInCur.gt(0)
                  ? rcvdInCur
                  : (row.currency === cur ? received : dec(0));
                const diff = totalInCur.minus(effectiveRcvd);
                balanceInCur = diff.gt(0) ? diff : dec(0);
              }
            }
          }
        }

        const cleanNote = noteText
          .replace(/\[TOTAL:\s*[\d,.]+\s*(THB|USD|LAK)\]\s*/g, '')
          .trim();

        return {
          ...row,
          outstandingAmount: (cur === row.currency ? balanceInCur : outstanding).toFixed(),
          netAmount: received.minus(settled).toFixed(),
          orderSummary: {
            currency: cur,
            totalAmount: totalInCur.toFixed(),
            balanceAmount: balanceInCur.toFixed(),
            isBalanceZero: outstanding.lte(0),
            cleanNote,
          },
        };
      }),
      total,
      range,
    );
  }
}
