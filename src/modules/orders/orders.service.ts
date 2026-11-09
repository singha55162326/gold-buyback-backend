import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Currency, type OrderStatus } from '@prisma/client';
import { dec, type Decimal } from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { HistoryRangeService } from '../../common/services/history-range.service';
import { BusinessDayService } from '../../common/services/business-day.service';
import { AdvanceService } from '../../common/services/advance.service';
import { CashService } from '../cash/cash.service';
import { PricingContextService } from '../pricing/pricing-context.service';
import type { HistoryRangeDto } from '../../common/dto/history-range.dto';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type {
  CreateOrderDto,
  OrderReceiptDto,
  ReceiveOrderDto,
  UpdateOrderStatusDto,
  UpdateOrderDto,
} from './dto/order.dto';

const D = (value: Decimal) => new Prisma.Decimal(value.toFixed());

/**
 * TOR §7 — Status Workflow Order. Each status may only advance to the next,
 * or be cancelled; skipping a step would let an order be handed over before
 * the smith has returned it.
 */
const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  ORDER_PLACED: ['SENT_TO_SMITH', 'CANCELLED'],
  SENT_TO_SMITH: ['RECEIVED_FROM_SMITH', 'CANCELLED'],
  RECEIVED_FROM_SMITH: ['AWAITING_PICKUP', 'CANCELLED'],
  AWAITING_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const STATUS_LABEL_LO: Record<OrderStatus, string> = {
  ORDER_PLACED: 'Order ສຳເລັດ',
  SENT_TO_SMITH: 'ສັ່ງຊ່າງ ສຳເລັດ',
  RECEIVED_FROM_SMITH: 'ຮັບເຄື່ອງຈາກຊ່າງ ສຳເລັດ',
  AWAITING_PICKUP: 'ລໍຖ້າລູກຄ້າຮັບເຄື່ອງ',
  COMPLETED: 'Completed',
  CANCELLED: 'ຍົກເລີກ',
};

/**
 * TOR §7 — ລາຍການ Order.
 *
 * ★ The Advance logic the TOR calls out explicitly:
 *
 *   1. ເມື່ອ 'Order ສຳເລັດ' (ລູກຄ້າຈ່າຍເງິນມັດຈໍາ):
 *      +Advance — money received against an obligation to deliver goods,
 *      not yet revenue.
 *   2. ເມື່ອ 'ຢືນຢັນລູກຄ້າຮັບເຄື່ອງ':
 *      −Advance — the delivery obligation ends and the deposit is released.
 *
 * The updated TOR gives this its own ledger rather than routing it through
 * AP (Cash), which §9.2 now scopes to ຄ່າແຮງຊ່າງຄ້າງຈ່າຍ alone. COH Cash
 * subtracts the net advance, so a deposit in the drawer never reads as the
 * shop's own money.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly businessDay: BusinessDayService,
    private readonly advance: AdvanceService,
    private readonly cash: CashService,
    private readonly pricingContext: PricingContextService,
    private readonly range: HistoryRangeService,
  ) {}

  /**
   * Resolve every leg of one receipt.
   *
   * A customer may put down a deposit part in cash and part by transfer, in
   * more than one currency. Each leg converts at its own rate; the change is
   * taken on the TOTAL and charged to the last leg, so the legs still sum to
   * exactly what was received.
   */
  private resolveReceipts(
    lines: OrderReceiptDto[],
    rates: Parameters<typeof PricingContextService.rateFor>[0],
    owed: Decimal,
  ) {
    if (lines.length === 0) {
      throw new BadRequestException('ຕ້ອງມີລາຍການຮັບເງິນຢ່າງໜ້ອຍ 1 ລາຍການ');
    }

    const resolved = lines.map((dto) => {
      if (dto.method === 'BANK' && !dto.bankAccountId) {
        throw new BadRequestException('ກະລຸນາເລືອກທະນາຄານ');
      }

      const amount = dec(dto.amount);
      if (!amount.isFinite() || amount.lte(0)) {
        throw new BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
      }

      const rate = PricingContextService.rateFor(rates, dto.currency, 'sell');
      return { ...dto, amount, rate, amountLak: amount.mul(rate), changeLak: dec(0) };
    });

    const totalLak = resolved.reduce((sum, l) => sum.plus(l.amountLak), dec(0));
    const changeLak = totalLak.gt(owed) ? totalLak.minus(owed) : dec(0);
    if (changeLak.gt(0)) resolved[resolved.length - 1]!.changeLak = changeLak;

    return { lines: resolved, totalLak, changeLak, applied: totalLak.minus(changeLak) };
  }

  /** The legs of a request, however the client spelled them. */
  private receiptLines(dto: {
    receipt?: OrderReceiptDto;
    receipts?: OrderReceiptDto[];
    method?: string;
    bankAccountId?: string;
    currency?: string;
    amount?: string;
  }): OrderReceiptDto[] {
    if (dto.receipts?.length) return dto.receipts;
    if (dto.receipt) return [dto.receipt];
    if (dto.method && dto.currency && dto.amount) {
      return [dto as unknown as OrderReceiptDto];
    }
    return [];
  }

  async create(dto: CreateOrderDto, user: AuthenticatedUser) {
    const context = await this.pricingContext.load();

    const totalAmount = dec(dto.totalAmount);
    if (totalAmount.lte(0)) throw new BadRequestException('ຍອດລວມຕ້ອງໃຫຍ່ກວ່າ 0');

    /*
     * ບິນໜຶ່ງມີໄດ້ຫຼາຍລາຍການ. ຫົວບິນຍັງເກັບ ນ້ຳໜັກລວມ / ຈຳນວນລວມ ແລະ
     * ລາຍການທຳອິດ ເພື່ອໃຫ້ການຮັບເງິນ, Advance ແລະ ລາຍງານເກົ່າອ່ານບ່ອນດຽວ.
     */
    const lines = dto.lines?.length
      ? dto.lines
      : dto.goldItemId && dto.weightG && dto.quantity
        ? [{ goldItemId: dto.goldItemId, weightG: dto.weightG, quantity: dto.quantity }]
        : [];
    if (lines.length === 0) throw new BadRequestException('ຕ້ອງມີລາຍການຢ່າງໜ້ອຍ 1 ລາຍການ');

    const totalWeightG = lines.reduce((sum, l) => sum.plus(dec(l.weightG).mul(l.quantity)), dec(0));
    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
    if (totalWeightG.lte(0)) throw new BadRequestException('ນ້ຳໜັກລວມຕ້ອງໃຫຍ່ກວ່າ 0');

    const receipt = this.resolveReceipts(this.receiptLines(dto), context.rates, totalAmount);
    const day = await this.businessDay.current();

    let currency = dto.currency ?? 'LAK';
    let originalTotalAmount = dto.originalTotalAmount ? dec(dto.originalTotalAmount) : null;
    let exchangeRate = dto.exchangeRate ? dec(dto.exchangeRate) : null;

    if (!dto.currency && dto.note) {
      const match = dto.note.match(/\[TOTAL:\s*([\d,.]+)\s*(THB|USD|LAK)\]/);
      if (match) {
        currency = match[2] as 'LAK' | 'THB' | 'USD';
        originalTotalAmount = dec(match[1].replace(/,/g, ''));
      }
    }
    if (!originalTotalAmount) {
      originalTotalAmount = totalAmount;
    }
    if (!exchangeRate) {
      exchangeRate = currency !== 'LAK' ? PricingContextService.rateFor(context.rates, currency, 'sell') : dec(1);
    }

    const customer = await this.prisma.customer.upsert({
      where: { phone: dto.phone },
      update: {},
      create: { phone: dto.phone },
    });

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          code: await this.nextCode(tx),
          billNo: dto.billNo,
          productType: dto.productType,
          staffName: dto.staffName.trim(),
          customerId: customer.id,
          goldItemId: lines[0]!.goldItemId,
          weightG: D(totalWeightG),
          quantity: totalQuantity,
          lines: {
            create: lines.map((line, index) => ({
              goldItemId: line.goldItemId,
              weightG: D(dec(line.weightG)),
              quantity: line.quantity,
              amount: line.amount ? D(dec(line.amount)) : null,
              note: line.note ?? null,
              sortOrder: index,
            })),
          },
          totalAmount: D(totalAmount),
          receivedAmount: D(receipt.applied),
          balanceAmount: D(totalAmount.minus(receipt.applied)),
          currency,
          originalTotalAmount: D(originalTotalAmount),
          exchangeRate: D(exchangeRate),
          status: 'ORDER_PLACED',
          note: dto.note ?? null,
          createdById: user.id,
          receipts: {
            create: receipt.lines.map((line) => ({
              method: line.method,
              bankAccountId: line.bankAccountId ?? null,
              currency: line.currency,
              rate: D(line.rate),
              amount: D(line.amount),
              amountLak: D(line.amountLak),
              changeLak: D(line.changeLak),
              isDeposit: true,
              createdById: user.id,
            })),
          },
          statusHistory: {
            create: { toStatus: 'ORDER_PLACED', changedById: user.id },
          },
        },
        include: {
          receipts: true,
          customer: true,
          lines: { include: { goldItem: true }, orderBy: { sortOrder: 'asc' } },
        },
      });

      // One movement per leg, so Module Cash and Module Bank each show
      // what actually landed in them.
      for (const line of receipt.lines) {
        await this.recordReceiptMoney(tx, {
          method: line.method,
          bankAccountId: line.bankAccountId ?? null,
          currency: line.currency,
          amount: D(line.amount),
          businessDayId: day.id,
          refId: order.id,
          note: `ເງິນມັດຈໍາ Order ${order.code}`,
          createdById: user.id,
        });
      }

      // ★ Step 1: the deposit is money held, not revenue. One entry per
      // leg, because Advance is reported per currency.
      for (const line of receipt.lines) {
        await this.advance.post(tx, {
          orderId: order.id,
          currency: line.currency,
          amount: line.amount,
          direction: 'IN',
          method: line.method,
          bankAccountId: line.bankAccountId ?? null,
          note: `ເງິນມັດຈໍາ Order ${order.code}`,
          createdById: user.id,
        });
      }

      /*
       * Order ທີ່ສ້າງໂດຍຍັງບໍ່ໄດ້ຮັບເງິນມັດຈຳ ກໍຕ້ອງປາກົດຢູ່ Module Advance.
       * ແຕ່ກ່ອນ ການບັນທຶກຂ້າມແຖວທີ່ຈຳນວນເງິນ = 0 ຈຶ່ງເຫັນແຕ່ Order ທີ່ມີເງິນ
       * — ລູກຄ້າແຈ້ງວ່າ "ລາຍການບໍ່ບັນທຶກເຂົ້າ Module Advace".
       */
      if (receipt.lines.length === 0) {
        await this.advance.post(tx, {
          orderId: order.id,
          currency: 'LAK',
          amount: dec(0),
          direction: 'IN',
          allowZero: true,
          note: `ສ້າງ Order ${order.code} — ຍັງບໍ່ໄດ້ຮັບເງິນມັດຈຳ`,
          createdById: user.id,
        });
      }

      await this.audit.record(
        {
          actorId: user.id,
          action: 'CREATE',
          entity: 'Order',
          entityId: order.id,
          after: {
            code: order.code,
            totalAmount: totalAmount.toFixed(),
            received: receipt.applied.toFixed(),
          },
          summary: `ສ້າງ Order ${order.code} — ມັດຈໍາ ${receipt.applied.toFixed(0)} LAK`,
        },
        tx,
      );

      return order;
    });
  }

  /** Advance the order one step along the §7 workflow. */
  async updateStatus(id: string, dto: UpdateOrderStatusDto, user: AuthenticatedUser) {
    const order = await this.prisma.order.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw new NotFoundException('ບໍ່ພົບ Order');

    if (!NEXT_STATUS[order.status].includes(dto.status)) {
      throw new BadRequestException(
        `ບໍ່ສາມາດປ່ຽນສະຖານະຈາກ "${STATUS_LABEL_LO[order.status]}" ເປັນ "${STATUS_LABEL_LO[dto.status]}" ໄດ້`,
      );
    }

    // TOR §7: each transition captures the fact that makes it true, so the
    // status can always be traced back to who/when rather than just a flag.
    if (dto.status === 'SENT_TO_SMITH' && !dto.supplierId) {
      throw new BadRequestException('ກະລຸນາເລືອກ Supplier ກ່ອນປ່ຽນເປັນ "ສັ່ງຊ່າງ ສຳເລັດ"');
    }
    if (dto.status === 'RECEIVED_FROM_SMITH' && !dto.receivedFromSmithAt) {
      throw new BadRequestException('ກະລຸນາປ້ອນວັນທີຮັບເຄື່ອງຈາກຊ່າງ');
    }
    if (dto.status === 'COMPLETED' && !dto.customerPickupAt) {
      throw new BadRequestException('ກະລຸນາປ້ອນວັນທີລູກຄ້າມາຮັບເຄື່ອງ');
    }

    // Completion is reached by paying the balance to zero, not by fiat.
    if (dto.status === 'COMPLETED' && dec(order.balanceAmount.toFixed()).gt(0)) {
      throw new BadRequestException(
        `ຍັງມີຍອດຄົງເຫຼືອ ${order.balanceAmount.toFixed(0)} LAK — ຕ້ອງຊຳຣະໃຫ້ຄົບກ່ອນ`,
      );
    }

    const refundLines =
      dto.status === 'COMPLETED'
        ? (dto.refundReceipts ?? []).filter((l) => dec(l.amount).gt(0))
        : [];
    if (refundLines.some((l) => l.method === 'BANK' && !l.bankAccountId)) {
      throw new BadRequestException('ການຈ່າຍແບບໂອນ ຕ້ອງເລືອກທະນາຄານ');
    }

    const [day, context] =
      refundLines.length > 0
        ? await Promise.all([this.businessDay.current(), this.pricingContext.load()])
        : [null, null];

    if (refundLines.length > 0) {
      await this.assertRefundableAndFunds(order.id, order.code, refundLines);
    }

    return this.prisma.$transaction(async (tx) => {
      if (refundLines.length > 0 && day && context) {
        await this.recordRefundLegs(tx, order, refundLines, day.id, context.rates, user.id);
      }

      if (dto.status === 'CANCELLED') {
        await this.advance.settleOrderAdvance(
          tx,
          order,
          user.id,
          `ຍົກເລີກ Order ${order.code} — ລົບລ້າງພັນທະມັດຈໍາ`,
        );
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.supplierId ? { supplierId: dto.supplierId } : {}),
          // ວັນທີສັ່ງຊ່າງ — ເກັບຕອນປ່ຽນສະຖານະ ເພື່ອໃຫ້ View ບອກໄດ້ວ່າສັ່ງມື້ໃດ.
          ...(dto.status === 'SENT_TO_SMITH' && !order.sentToSmithAt
            ? { sentToSmithAt: new Date() }
            : {}),
          ...(dto.receivedFromSmithAt
            ? { receivedFromSmithAt: new Date(dto.receivedFromSmithAt) }
            : {}),
          ...(dto.customerPickupAt
            ? { customerPickupAt: new Date(dto.customerPickupAt) }
            : {}),
          ...(dto.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
          statusHistory: {
            create: {
              fromStatus: order.status,
              toStatus: dto.status,
              note: dto.note ?? null,
              changedById: user.id,
            },
          },
        },
        include: {
          customer: true,
          goldItem: true,
          supplier: true,
          receipts: { include: { bankAccount: true } },
          lines: { include: { goldItem: true }, orderBy: { sortOrder: 'asc' } },
        },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: dto.status === 'COMPLETED' ? 'COMPLETE' : 'UPDATE',
          entity: 'Order',
          entityId: id,
          before: { status: order.status },
          after: { status: dto.status, ...(refundLines.length > 0 ? { refundedLegs: refundLines.length } : {}) },
          summary:
            refundLines.length > 0
              ? `Order ${order.code}: ${STATUS_LABEL_LO[dto.status]} ແລະ ຈ່າຍເງິນຄືນ`
              : `Order ${order.code}: ${STATUS_LABEL_LO[dto.status]}`,
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * ຢືນຢັນລູກຄ້າຮັບເຄື່ອງ / Payment ຄືນ / ຊຳລະເພີ່ມ.
   *
   * When the balance reaches zero the order auto-completes and the deposit
   * liability is released — TOR §7 step 2.
   */
  async addReceipt(id: string, dto: ReceiveOrderDto, user: AuthenticatedUser) {
    const order = await this.prisma.order.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw new NotFoundException('ບໍ່ພົບ Order');
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new BadRequestException('Order ນີ້ປິດແລ້ວ');
    }

    const context = await this.pricingContext.load();
    const balance = dec(order.balanceAmount.toFixed());
    const receipt = this.resolveReceipts(this.receiptLines(dto), context.rates, balance);
    const day = await this.businessDay.current();

    const received = dec(order.receivedAmount.toFixed()).plus(receipt.applied);
    const total = dec(order.totalAmount.toFixed());
    const remaining = total.minus(received);
    const settled = remaining.lte(0);

    return this.prisma.$transaction(async (tx) => {
      for (const line of receipt.lines) {
        await tx.orderReceipt.create({
          data: {
            orderId: id,
            method: line.method,
            bankAccountId: line.bankAccountId ?? null,
            currency: line.currency,
            rate: D(line.rate),
            amount: D(line.amount),
            amountLak: D(line.amountLak),
            changeLak: D(line.changeLak),
            createdById: user.id,
          },
        });

        await this.recordReceiptMoney(tx, {
          method: line.method,
          bankAccountId: line.bankAccountId ?? null,
          currency: line.currency,
          amount: D(line.amount),
          businessDayId: day.id,
          refId: order.id,
          note: `ຊຳຣະ Order ${order.code}`,
          createdById: user.id,
        });
      }

      // The extra payment is still money held until the goods are handed
      // over. One entry per leg, because Advance is reported per currency.
      for (const line of receipt.lines) {
        await this.advance.post(tx, {
          orderId: order.id,
          currency: line.currency,
          amount: line.amount,
          direction: 'IN',
          method: line.method,
          bankAccountId: line.bankAccountId ?? null,
          note: `ຊຳຣະເພີ່ມ Order ${order.code}`,
          createdById: user.id,
        });
      }

      if (settled) {
        // ★ Step 2: obligation discharged — release the whole advance per currency.
        await this.advance.settleOrderAdvance(
          tx,
          order,
          user.id,
          `ຢືນຢັນລູກຄ້າຮັບເຄື່ອງ ${order.code} — ລົບລ້າງພັນທະມັດຈໍາ`,
        );
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          receivedAmount: D(received),
          balanceAmount: D(settled ? dec(0) : remaining),
          ...(settled
            ? {
                status: 'COMPLETED' as const,
                completedAt: new Date(),
                customerPickupAt: order.customerPickupAt ?? new Date(),
                statusHistory: {
                  create: {
                    fromStatus: order.status,
                    toStatus: 'COMPLETED' as const,
                    note: 'ຊຳຣະຄົບ — ປິດອັດຕະໂນມັດ',
                    changedById: user.id,
                  },
                },
              }
            : {}),
        },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: settled ? 'COMPLETE' : 'UPDATE',
          entity: 'Order',
          entityId: id,
          before: { balance: order.balanceAmount.toFixed() },
          after: { balance: updated.balanceAmount.toFixed(), status: updated.status },
          summary: settled
            ? `Order ${order.code} ຊຳຣະຄົບ — Completed`
            : `ຮັບເງິນ Order ${order.code} ${receipt.applied.toFixed(0)} LAK`,
        },
        tx,
      );

      return updated;
    });
  }

  async list(status: OrderStatus | undefined, query: HistoryRangeDto, user?: AuthenticatedUser) {
    const range = this.range.resolve(query, user);
    /*
     * Order ທີ່ຍັງບໍ່ທັນປິດ (ຍັງສັ່ງຊ່າງ / ລໍຖ້າຮັບເຄື່ອງ ຫຼື ຍັງມີຍອດເງິນມັດຈຳຄ້າງຄືນ)
     * ຕ້ອງປາກົດຢູ່ໜ້າຈໍຈົນກວ່າຈະສຳເລັດຄົບຖ້ວນ ເຊັ່ນດຽວກັບ Module ຝາກສິນຄ້າ,
     * ເພື່ອບໍ່ໃຫ້ບິນຄ້າງຂ້າມມື້ຫາຍໄປຈາກໜ້າຈໍເມື່ອຂຶ້ນມື້ໃໝ່.
     */
    const advGroups = await this.prisma.advanceLedger.groupBy({
      by: ['orderId'],
      where: { deletedAt: null },
      _sum: { amountIn: true, amountOut: true },
    });
    const unsettledOrderIds = advGroups
      .filter((g) => dec(g._sum.amountIn?.toFixed() ?? 0).gt(dec(g._sum.amountOut?.toFixed() ?? 0)))
      .map((g) => g.orderId);

    const inRange = { createdAt: HistoryRangeService.window(range) };
    const stillOpen: Prisma.OrderWhereInput = {
      status: { not: 'CANCELLED' },
      OR: [
        { status: { not: 'COMPLETED' } },
        ...(unsettledOrderIds.length > 0 ? [{ id: { in: unsettledOrderIds } }] : []),
      ],
    };
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      ...(status
        ? {
            status,
            ...(status === 'CANCELLED'
              ? inRange
              : status === 'COMPLETED'
                ? {
                    OR: [
                      inRange,
                      ...(unsettledOrderIds.length > 0 ? [{ id: { in: unsettledOrderIds } }] : []),
                    ],
                  }
                : {}),
          }
        : { OR: [inRange, stillOpen] }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          customer: true,
          goldItem: true,
          supplier: true,
          receipts: { include: { bankAccount: true } },
          // ລາຍການໃນບິນ — ປຸ່ມ View ຕ້ອງເຫັນຄົບທຸກແຖວ.
          lines: { include: { goldItem: true }, orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: range.skip,
        take: range.take,
      }),
      this.prisma.order.count({ where }),
    ]);
    // ຜູ້ບັນທຶກ — ລູກຄ້າຂໍໃຫ້ເຫັນທຸກ Module ທີ່ມີການລົງລາຍການ.
    return this.range.page(await this.audit.withCreatorNames(rows), total, range);
  }

  /**
   * ຈ່າຍເງິນຄືນທີ່ຮັບຈາກລູກຄ້າ (TOR §7 ຕາມທີ່ລູກຄ້າແຈ້ງ).
   *
   * ໃຊ້ຕອນຢືນຢັນລູກຄ້າຮັບເຄື່ອງ ແລ້ວຕ້ອງຄືນເງິນມັດຈຳ (ຫຼື ສ່ວນໜຶ່ງ) ໃຫ້ລູກຄ້າ:
   * ເງິນອອກຈາກລີ້ນຊັກ/ບັນຊີຈິງ, ແຖວ OrderReceipt ບັນທຶກເປັນ `isRefund`, ແລະ
   * ຍອດ Advance ທີ່ຍັງຖືແທນລູກຄ້າຫຼຸດລົງຕາມຈຳນວນທີ່ຄືນ.
   */
  async refund(id: string, dto: ReceiveOrderDto, user: AuthenticatedUser) {
    const order = await this.prisma.order.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw new NotFoundException('ບໍ່ພົບ Order');

    const lines = (dto.receipts ?? []).filter((l) => dec(l.amount).gt(0));
    if (lines.length === 0) throw new BadRequestException('ຕ້ອງລະບຸຈຳນວນເງິນທີ່ຈ່າຍຄືນ');

    const bankLegs = lines.filter((l) => l.method === 'BANK');
    if (bankLegs.some((l) => !l.bankAccountId)) {
      throw new BadRequestException('ການຈ່າຍແບບໂອນ ຕ້ອງເລືອກທະນາຄານ');
    }

    const [day, context] = await Promise.all([
      this.businessDay.current(),
      this.pricingContext.load(),
    ]);

    await this.assertRefundableAndFunds(order.id, order.code, lines);

    return this.prisma.$transaction(async (tx) => {
      await this.recordRefundLegs(tx, order, lines, day.id, context.rates, user.id);

      await this.audit.record(
        {
          actorId: user.id,
          action: 'UPDATE',
          entity: 'Order',
          entityId: order.id,
          summary: `ຈ່າຍເງິນຄືນ Order ${order.code}`,
        },
        tx,
      );

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { receipts: { include: { bankAccount: true } } },
      });
    });
  }

  /**
   * ກວດສອບວ່າ:
   * 1. ຍອດທີ່ຈະຈ່າຍຄືນ ບໍ່ເກີນຍອດເງິນມັດຈຳສຸດທິທີ່ຮັບມາໃນ Order ນີ້
   * 2. ເງິນສົດໃນຮ້ານ (Module Cash) ແລະ ບັນຊີທະນາຄານ (Module Bank) ມີພໍຈ່າຍຄືນ (ບໍ່ຕິດລົບ)
   */
  private async assertRefundableAndFunds(
    orderId: string,
    orderCode: string,
    lines: OrderReceiptDto[],
  ): Promise<void> {
    const receipts = await this.prisma.orderReceipt.findMany({
      where: { orderId },
      select: { currency: true, amount: true, isRefund: true },
    });

    const netByCur = new Map<Currency, Decimal>();
    for (const r of receipts) {
      const prev = netByCur.get(r.currency) ?? dec(0);
      const amt = dec(r.amount.toFixed());
      netByCur.set(r.currency, r.isRefund ? prev.minus(amt) : prev.plus(amt));
    }

    const reqByCur = new Map<Currency, Decimal>();
    for (const l of lines) {
      const prev = reqByCur.get(l.currency) ?? dec(0);
      reqByCur.set(l.currency, prev.plus(dec(l.amount)));
    }

    for (const [currency, reqAmt] of reqByCur) {
      const availableAdvance = netByCur.get(currency) ?? dec(0);
      if (reqAmt.gt(availableAdvance)) {
        throw new BadRequestException(
          `ຍອດຈ່າຍເງິນຄືນ ${reqAmt.toFixed()} ${currency} ເກີນຍອດມັດຈຳຄົງເຫຼືອຂອງ Order ${orderCode} (ມີ ${availableAdvance.toFixed()} ${currency})`,
        );
      }
    }

    await this.cash.assertSufficientFunds(lines, `ການຈ່າຍເງິນຄືນ Order ${orderCode}`);
  }

  private async recordRefundLegs(
    tx: Prisma.TransactionClient,
    order: { id: string; code: string; currency: Currency; exchangeRate: Prisma.Decimal | null },
    lines: OrderReceiptDto[],
    businessDayId: string,
    rates: Parameters<typeof PricingContextService.rateFor>[0],
    userId: string,
  ) {
    for (const line of lines) {
      const amountDec = dec(line.amount);
      const amount = D(amountDec);
      const orderRate = order.exchangeRate ? dec(order.exchangeRate.toFixed()) : dec(0);
      const rateDec =
        line.currency === 'LAK'
          ? dec(1)
          : line.currency === order.currency && orderRate.gt(0)
            ? orderRate
            : PricingContextService.rateFor(rates, line.currency, 'buyback');
      const amountLak = D(amountDec.mul(rateDec));

      await this.recordReceiptMoney(tx, {
        method: line.method,
        bankAccountId: line.bankAccountId ?? null,
        currency: line.currency,
        amount,
        businessDayId,
        refId: order.id,
        note: `ຈ່າຍເງິນຄືນ Order ${order.code}`,
        createdById: userId,
        direction: 'out',
      });

      await tx.orderReceipt.create({
        data: {
          orderId: order.id,
          method: line.method,
          bankAccountId: line.bankAccountId ?? null,
          currency: line.currency,
          rate: D(rateDec),
          amount,
          amountLak,
          isRefund: true,
          createdById: userId,
        },
      });

      await this.advance.post(tx, {
        orderId: order.id,
        currency: line.currency,
        amount: amountDec,
        direction: 'OUT',
        method: line.method,
        bankAccountId: line.bankAccountId ?? null,
        note: `ຈ່າຍເງິນຄືນ Order ${order.code}`,
        createdById: userId,
      });
    }
  }

  private async recordReceiptMoney(
    tx: Prisma.TransactionClient,
    input: {
      method: string;
      bankAccountId: string | null;
      currency: Currency;
      amount: Prisma.Decimal;
      businessDayId: string;
      refId: string;
      note: string;
      createdById: string;
      /** `out` = ຮ້ານຈ່າຍເງິນຄືນໃຫ້ລູກຄ້າ. */
      direction?: 'in' | 'out';
    },
  ) {
    const out = input.direction === 'out';
    if (input.method === 'CASH') {
      await tx.cashTransaction.create({
        data: {
          businessDayId: input.businessDayId,
          type: out ? 'OUT' : 'IN',
          currency: input.currency,
          amount: input.amount,
          refType: 'Order',
          refId: input.refId,
          note: input.note,
          createdById: input.createdById,
        },
      });
    } else if (input.bankAccountId) {
      await tx.bankTransaction.create({
        data: {
          businessDayId: input.businessDayId,
          bankAccountId: input.bankAccountId,
          type: out ? 'WITHDRAW' : 'DEPOSIT',
          currency: input.currency,
          amount: input.amount,
          refType: 'Order',
          refId: input.refId,
          note: input.note,
          createdById: input.createdById,
        },
      });
    }
  }

  private async nextCode(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const prefix = `OD-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const count = await tx.order.count({ where: { code: { startsWith: prefix } } });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  async update(id: string, dto: UpdateOrderDto, user: AuthenticatedUser) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: { lines: true, customer: true, receipts: true },
    });
    if (!order) throw new NotFoundException('ບໍ່ພົບ Order');

    const context = await this.pricingContext.load();

    return this.prisma.$transaction(async (tx) => {
      let customerId = order.customerId;
      if (dto.phone && dto.phone !== order.customer.phone) {
        const customer = await tx.customer.upsert({
          where: { phone: dto.phone },
          update: {},
          create: { phone: dto.phone },
        });
        customerId = customer.id;
      }

      let totalWeightG = order.weightG;
      let totalQuantity = order.quantity;
      let goldItemId = order.goldItemId;

      if (dto.lines && dto.lines.length > 0) {
        totalWeightG = D(dto.lines.reduce((sum, l) => sum.plus(dec(l.weightG).mul(l.quantity)), dec(0)));
        totalQuantity = dto.lines.reduce((sum, l) => sum + l.quantity, 0);
        goldItemId = dto.lines[0].goldItemId;

        await tx.orderLine.deleteMany({ where: { orderId: id } });
        await tx.orderLine.createMany({
          data: dto.lines.map((line, index) => ({
            orderId: id,
            goldItemId: line.goldItemId,
            weightG: D(dec(line.weightG)),
            quantity: line.quantity,
            amount: line.amount ? D(dec(line.amount)) : null,
            note: line.note ?? null,
            sortOrder: index,
          })),
        });
      }

      let newTotalAmount = order.totalAmount;
      let newReceivedAmount = order.receivedAmount;
      let newBalanceAmount = order.balanceAmount;

      if (dto.totalAmount) {
        const totalDec = dec(dto.totalAmount);
        if (totalDec.lte(0)) throw new BadRequestException('ຍອດລວມຕ້ອງໃຫຍ່ກວ່າ 0');
        newTotalAmount = D(totalDec);
      }

      let currency: Currency = dto.currency ?? order.currency ?? 'LAK';
      let originalTotalAmount = dto.originalTotalAmount
        ? dec(dto.originalTotalAmount)
        : order.originalTotalAmount
          ? dec(order.originalTotalAmount.toFixed())
          : null;
      let exchangeRate = dto.exchangeRate
        ? dec(dto.exchangeRate)
        : order.exchangeRate
          ? dec(order.exchangeRate.toFixed())
          : null;

      const noteToCheck = dto.note !== undefined ? dto.note : order.note;
      if (!dto.currency && noteToCheck) {
        const match = noteToCheck.match(/\[TOTAL:\s*([\d,.]+)\s*(THB|USD|LAK)\]/);
        if (match) {
          currency = match[2] as Currency;
          originalTotalAmount = dec(match[1].replace(/,/g, ''));
        }
      }
      if (!originalTotalAmount || currency === 'LAK') {
        originalTotalAmount = dec(newTotalAmount.toFixed());
      }
      if (!exchangeRate || currency === 'LAK') {
        exchangeRate =
          currency !== 'LAK'
            ? PricingContextService.rateFor(context.rates, currency, 'sell')
            : dec(1);
      }

      if (dto.receipts !== undefined) {
        const totalDec = dec(newTotalAmount.toFixed());
        const receipt = this.resolveReceipts(dto.receipts, context.rates, totalDec);

        // ກວດສອບວ່າການແກ້ໄຂຍອດຮັບ ຈະບໍ່ເຮັດໃຫ້ຍອດ Cash ຫຼື Bank ໃນຮ້ານຕິດລົບ
        const oldDeposits = order.receipts.filter((r) => !r.isRefund);
        const deltaMap = new Map<
          string,
          { method: string; bankAccountId: string | null; currency: Currency; diff: Decimal }
        >();
        for (const old of oldDeposits) {
          const key = `${old.method}:${old.bankAccountId ?? ''}:${old.currency}`;
          const prev = deltaMap.get(key);
          const amt = dec(old.amount.toFixed());
          if (!prev) {
            deltaMap.set(key, {
              method: old.method,
              bankAccountId: old.bankAccountId ?? null,
              currency: old.currency,
              diff: amt,
            });
          } else {
            prev.diff = prev.diff.plus(amt);
          }
        }
        for (const line of receipt.lines) {
          const key = `${line.method}:${line.bankAccountId ?? ''}:${line.currency}`;
          const prev = deltaMap.get(key);
          if (prev) {
            prev.diff = prev.diff.minus(line.amount);
          }
        }
        const reductions = Array.from(deltaMap.values())
          .filter((item) => item.diff.gt(0))
          .map((item) => ({
            method: item.method,
            bankAccountId: item.bankAccountId,
            currency: item.currency,
            amount: item.diff,
          }));
        if (reductions.length > 0) {
          await this.cash.assertSufficientFunds(
            reductions,
            `ການແກ້ໄຂຍອດຮັບ Order ${order.code} (ຍອດຄົງເຫຼືອຈະຕິດລົບ)`,
          );
        }

        // Preserve original businessDayId and advance businessDate so editing an
        // older order does not shift its cash/bank/advance movements into today.
        const [existingCash, existingBank, existingAdvance] = await Promise.all([
          tx.cashTransaction.findFirst({
            where: { refType: 'Order', refId: id, deletedAt: null },
            orderBy: { createdAt: 'asc' },
          }),
          tx.bankTransaction.findFirst({
            where: { refType: 'Order', refId: id, deletedAt: null },
            orderBy: { createdAt: 'asc' },
          }),
          tx.advanceLedger.findFirst({
            where: { orderId: id, deletedAt: null },
            orderBy: [{ businessDate: 'asc' }, { sequence: 'asc' }],
          }),
        ]);
        const targetBusinessDayId =
          existingCash?.businessDayId ??
          existingBank?.businessDayId ??
          (await this.businessDay.current()).id;
        const targetAdvanceDate = existingAdvance?.businessDate;

        // Preserve any refund receipts that were already paid out on this order
        const existingRefunds = order.receipts.filter((r) => r.isRefund);

        newReceivedAmount = D(receipt.applied);
        const remaining = totalDec.minus(receipt.applied);
        newBalanceAmount = D(remaining.gt(0) ? remaining : dec(0));

        // Replace old movements & receipts cleanly, then re-apply deposit + existing refunds
        await tx.cashTransaction.deleteMany({ where: { refType: 'Order', refId: id } });
        await tx.bankTransaction.deleteMany({ where: { refType: 'Order', refId: id } });
        await tx.advanceLedger.deleteMany({ where: { orderId: id } });
        await tx.orderReceipt.deleteMany({ where: { orderId: id, isRefund: false } });

        // Create updated deposit receipts
        await tx.orderReceipt.createMany({
          data: receipt.lines.map((line) => ({
            orderId: id,
            method: line.method,
            bankAccountId: line.bankAccountId ?? null,
            currency: line.currency,
            rate: D(line.rate),
            amount: D(line.amount),
            amountLak: D(line.amountLak),
            changeLak: D(line.changeLak),
            isDeposit: true,
            createdById: user.id,
          })),
        });

        for (const line of receipt.lines) {
          await this.recordReceiptMoney(tx, {
            method: line.method,
            bankAccountId: line.bankAccountId ?? null,
            currency: line.currency,
            amount: D(line.amount),
            businessDayId: targetBusinessDayId,
            refId: order.id,
            note: `ເງິນມັດຈໍາ Order ${order.code} (ແກ້ໄຂ)`,
            createdById: user.id,
          });
          await this.advance.post(tx, {
            orderId: order.id,
            currency: line.currency,
            amount: line.amount,
            direction: 'IN',
            businessDate: targetAdvanceDate,
            method: line.method,
            bankAccountId: line.bankAccountId ?? null,
            note: `ເງິນມັດຈໍາ Order ${order.code} (ແກ້ໄຂ)`,
            createdById: user.id,
          });
        }

        // Re-record any existing refund movements so refund history is not lost
        for (const ref of existingRefunds) {
          await this.recordReceiptMoney(tx, {
            method: ref.method,
            bankAccountId: ref.bankAccountId ?? null,
            currency: ref.currency,
            amount: ref.amount,
            businessDayId: targetBusinessDayId,
            refId: order.id,
            note: `ຈ່າຍເງິນຄືນ Order ${order.code}`,
            createdById: ref.createdById,
            direction: 'out',
          });
          await this.advance.post(tx, {
            orderId: order.id,
            currency: ref.currency,
            amount: dec(ref.amount.toFixed()),
            direction: 'OUT',
            businessDate: targetAdvanceDate,
            method: ref.method,
            bankAccountId: ref.bankAccountId ?? null,
            note: `ຈ່າຍເງິນຄືນ Order ${order.code}`,
            createdById: ref.createdById,
          });
        }

        if (receipt.lines.length === 0) {
          await this.advance.post(tx, {
            orderId: order.id,
            currency: 'LAK',
            amount: dec(0),
            direction: 'IN',
            allowZero: true,
            businessDate: targetAdvanceDate,
            note: `ແກ້ໄຂ Order ${order.code} — ຍັງບໍ່ໄດ້ຮັບເງິນມັດຈຳ`,
            createdById: user.id,
          });
        }

        const effectiveStatus = dto.status ?? order.status;
        if (effectiveStatus === 'CANCELLED') {
          await this.advance.settleOrderAdvance(
            tx,
            order,
            user.id,
            `ຍົກເລີກ Order ${order.code} — ລົບລ້າງພັນທະມັດຈໍາ`,
            targetAdvanceDate,
          );
        }
      } else {
        if (dto.totalAmount) {
          const totalDec = dec(dto.totalAmount);
          const receivedDec = dec(order.receivedAmount.toFixed());
          const balDec = totalDec.minus(receivedDec);
          newBalanceAmount = D(balDec.gt(0) ? balDec : dec(0));
        }
        if (dto.status && dto.status !== order.status && dto.status === 'CANCELLED') {
          await this.advance.settleOrderAdvance(
            tx,
            order,
            user.id,
            `ຍົກເລີກ Order ${order.code} — ລົບລ້າງພັນທະມັດຈໍາ`,
          );
        }
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          customerId,
          goldItemId,
          weightG: totalWeightG,
          quantity: totalQuantity,
          totalAmount: newTotalAmount,
          receivedAmount: newReceivedAmount,
          balanceAmount: newBalanceAmount,
          currency,
          originalTotalAmount: D(originalTotalAmount),
          exchangeRate: D(exchangeRate),
          ...(dto.billNo ? { billNo: dto.billNo } : {}),
          ...(dto.productType ? { productType: dto.productType } : {}),
          ...(dto.staffName ? { staffName: dto.staffName.trim() } : {}),
          ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId || null } : {}),
          ...(dto.note !== undefined ? { note: dto.note || null } : {}),
          ...(dto.status ? { status: dto.status } : {}),
        },
        include: {
          customer: true,
          goldItem: true,
          supplier: true,
          lines: { include: { goldItem: true } },
          receipts: { include: { bankAccount: true } },
        },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: 'UPDATE',
          entity: 'Order',
          entityId: order.id,
          summary: `ແກ້ໄຂ Order ${order.code} (Admin)`,
        },
        tx,
      );

      return updated;
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: { receipts: true },
    });
    if (!order) throw new NotFoundException('ບໍ່ພົບ Order');

    const netInflowMap = new Map<
      string,
      { method: string; bankAccountId: string | null; currency: Currency; net: Decimal }
    >();
    for (const r of order.receipts) {
      const key = `${r.method}:${r.bankAccountId ?? ''}:${r.currency}`;
      const amt = dec(r.amount.toFixed());
      const signed = r.isRefund ? amt.neg() : amt;
      const prev = netInflowMap.get(key);
      if (!prev) {
        netInflowMap.set(key, {
          method: r.method,
          bankAccountId: r.bankAccountId ?? null,
          currency: r.currency,
          net: signed,
        });
      } else {
        prev.net = prev.net.plus(signed);
      }
    }
    const netInflows = Array.from(netInflowMap.values())
      .filter((item) => item.net.gt(0))
      .map((item) => ({
        method: item.method,
        bankAccountId: item.bankAccountId,
        currency: item.currency,
        amount: item.net,
      }));
    if (netInflows.length > 0) {
      await this.cash.assertSufficientFunds(
        netInflows,
        `ການລຶບ Order ${order.code} (ຍອດຄົງເຫຼືອຈະຕິດລົບ)`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.order.update({
        where: { id },
        data: { deletedAt: now, deletedById: user.id },
      });

      await tx.advanceLedger.updateMany({
        where: { orderId: id, deletedAt: null },
        data: { deletedAt: now },
      });

      await tx.cashTransaction.updateMany({
        where: { refType: 'Order', refId: id, deletedAt: null },
        data: { deletedAt: now, deletedById: user.id },
      });

      await tx.bankTransaction.updateMany({
        where: { refType: 'Order', refId: id, deletedAt: null },
        data: { deletedAt: now, deletedById: user.id },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: 'DELETE',
          entity: 'Order',
          entityId: order.id,
          summary: `ລຶບ Order ${order.code} (Admin)`,
        },
        tx,
      );

      return { success: true };
    });
  }

}
