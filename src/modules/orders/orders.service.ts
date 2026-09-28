import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Currency, type OrderStatus } from '@prisma/client';
import { dec, type Decimal } from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { BusinessDayService } from '../../common/services/business-day.service';
import { AdvanceService } from '../../common/services/advance.service';
import { PricingContextService } from '../pricing/pricing-context.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { CreateOrderDto, OrderReceiptDto, UpdateOrderStatusDto } from './dto/order.dto';

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
    private readonly pricingContext: PricingContextService,
  ) {}

  private resolveReceipt(
    dto: OrderReceiptDto,
    rates: Parameters<typeof PricingContextService.rateFor>[0],
    owed: Decimal,
  ) {
    if (dto.method === 'BANK' && !dto.bankAccountId) {
      throw new BadRequestException('ກະລຸນາເລືອກທະນາຄານ');
    }

    const amount = dec(dto.amount);
    if (!amount.isFinite() || amount.lte(0)) {
      throw new BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
    }

    const rate = PricingContextService.rateFor(rates, dto.currency, 'sell');
    const amountLak = amount.mul(rate);
    const changeLak = amountLak.gt(owed) ? amountLak.minus(owed) : dec(0);

    return { amount, rate, amountLak, changeLak, applied: amountLak.minus(changeLak) };
  }

  async create(dto: CreateOrderDto, user: AuthenticatedUser) {
    const context = await this.pricingContext.load();

    const totalAmount = dec(dto.totalAmount);
    if (totalAmount.lte(0)) throw new BadRequestException('ຍອດລວມຕ້ອງໃຫຍ່ກວ່າ 0');

    const receipt = this.resolveReceipt(dto.receipt, context.rates, totalAmount);
    const day = await this.businessDay.current();

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
          goldItemId: dto.goldItemId,
          weightG: D(dec(dto.weightG)),
          quantity: dto.quantity,
          totalAmount: D(totalAmount),
          receivedAmount: D(receipt.applied),
          balanceAmount: D(totalAmount.minus(receipt.applied)),
          status: 'ORDER_PLACED',
          note: dto.note ?? null,
          createdById: user.id,
          receipts: {
            create: {
              method: dto.receipt.method,
              bankAccountId: dto.receipt.bankAccountId ?? null,
              currency: dto.receipt.currency,
              rate: D(receipt.rate),
              amount: D(receipt.amount),
              amountLak: D(receipt.amountLak),
              changeLak: D(receipt.changeLak),
              isDeposit: true,
              createdById: user.id,
            },
          },
          statusHistory: {
            create: { toStatus: 'ORDER_PLACED', changedById: user.id },
          },
        },
        include: { receipts: true, customer: true },
      });

      await this.recordReceiptMoney(tx, {
        method: dto.receipt.method,
        bankAccountId: dto.receipt.bankAccountId ?? null,
        currency: dto.receipt.currency,
        amount: D(receipt.amount),
        businessDayId: day.id,
        refId: order.id,
        note: `ເງິນມັດຈໍາ Order ${order.code}`,
        createdById: user.id,
      });

      // ★ Step 1: the deposit is money held, not revenue.
      await this.advance.post(tx, {
        orderId: order.id,
        currency: dto.receipt.currency,
        amount: receipt.amount,
        direction: 'IN',
        method: dto.receipt.method,
        bankAccountId: dto.receipt.bankAccountId ?? null,
        note: `ເງິນມັດຈໍາ Order ${order.code}`,
        createdById: user.id,
      });

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

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.supplierId ? { supplierId: dto.supplierId } : {}),
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
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: 'UPDATE',
          entity: 'Order',
          entityId: id,
          before: { status: order.status },
          after: { status: dto.status },
          summary: `Order ${order.code}: ${STATUS_LABEL_LO[dto.status]}`,
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
  async addReceipt(id: string, dto: OrderReceiptDto, user: AuthenticatedUser) {
    const order = await this.prisma.order.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw new NotFoundException('ບໍ່ພົບ Order');
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new BadRequestException('Order ນີ້ປິດແລ້ວ');
    }

    const context = await this.pricingContext.load();
    const balance = dec(order.balanceAmount.toFixed());
    const receipt = this.resolveReceipt(dto, context.rates, balance);
    const day = await this.businessDay.current();

    const received = dec(order.receivedAmount.toFixed()).plus(receipt.applied);
    const total = dec(order.totalAmount.toFixed());
    const remaining = total.minus(received);
    const settled = remaining.lte(0);

    return this.prisma.$transaction(async (tx) => {
      await tx.orderReceipt.create({
        data: {
          orderId: id,
          method: dto.method,
          bankAccountId: dto.bankAccountId ?? null,
          currency: dto.currency,
          rate: D(receipt.rate),
          amount: D(receipt.amount),
          amountLak: D(receipt.amountLak),
          changeLak: D(receipt.changeLak),
          createdById: user.id,
        },
      });

      await this.recordReceiptMoney(tx, {
        method: dto.method,
        bankAccountId: dto.bankAccountId ?? null,
        currency: dto.currency,
        amount: D(receipt.amount),
        businessDayId: day.id,
        refId: order.id,
        note: `ຊຳຣະ Order ${order.code}`,
        createdById: user.id,
      });

      // The extra payment is still money held until the goods are handed over.
      await this.advance.post(tx, {
        orderId: order.id,
        currency: dto.currency,
        amount: receipt.amount,
        direction: 'IN',
        method: dto.method,
        bankAccountId: dto.bankAccountId ?? null,
        note: `ຊຳຣະເພີ່ມ Order ${order.code}`,
        createdById: user.id,
      });

      if (settled) {
        // ★ Step 2: obligation discharged — release the whole advance.
        await this.advance.post(tx, {
          orderId: order.id,
          currency: 'LAK',
          amount: total,
          direction: 'OUT',
          note: `ຢືນຢັນລູກຄ້າຮັບເຄື່ອງ ${order.code} — ລົບລ້າງພັນທະມັດຈໍາ`,
          createdById: user.id,
        });
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

  list(status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: { deletedAt: null, ...(status ? { status } : {}) },
      include: {
        customer: true,
        goldItem: true,
        supplier: true,
        receipts: { include: { bankAccount: true } },
        statusHistory: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
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
    },
  ) {
    if (input.method === 'CASH') {
      await tx.cashTransaction.create({
        data: {
          businessDayId: input.businessDayId,
          type: 'IN',
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
          type: 'DEPOSIT',
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
}
