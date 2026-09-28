import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ApprovalStatus, type Currency } from '@prisma/client';
import { dec, type Decimal } from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { ApprovalService } from '../../common/services/approval.service';
import { BusinessDayService } from '../../common/services/business-day.service';
import { ApArPostingService } from '../../common/services/apar-posting.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingContextService } from '../pricing/pricing-context.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { CreateCreditDto, CreditReceiptDto, ReviewCreditDto } from './dto/credit.dto';

const D = (value: Decimal) => new Prisma.Decimal(value.toFixed());

/**
 * TOR §5.3 change limits. Foreign notes are accepted for convenience, not as
 * a currency exchange service, so the amount that can come back as LAK change
 * is capped.
 */
const CHANGE_LIMIT: Partial<Record<Currency, Decimal>> = {
  THB: dec(1_000),
  USD: dec(100),
};

/**
 * TOR §5.3 — ລາຍການສິນເຊື່ອ (Gold Credit / Installment).
 *
 *   ຍອດເງິນສິນເຊື່ອຕິດໜີ້ = ລາຄາຂາຍ − ເງິນວາງດາວ
 *
 * The outstanding balance is an AR (Cash): the shop has handed over gold and
 * is owed money. It is posted on approval and drawn down by each instalment.
 */
@Injectable()
export class CreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approval: ApprovalService,
    private readonly businessDay: BusinessDayService,
    private readonly apar: ApArPostingService,
    private readonly notifications: NotificationsService,
    private readonly pricingContext: PricingContextService,
  ) {}

  /**
   * Convert a receipt to LAK at the SELL rate (the shop is taking money in)
   * and apply the §5.3 change caps.
   */
  private resolveReceipt(
    dto: CreditReceiptDto,
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

    // §5.3: THB change ≤ 1,000 THB equivalent; USD change ≤ 100 USD.
    const limit = CHANGE_LIMIT[dto.currency];
    if (limit && changeLak.gt(limit.mul(rate))) {
      throw new BadRequestException(
        `ເງິນທອນຈາກ ${dto.currency} ປ້ອນໄດ້ບໍ່ເກີນ ${limit.toFixed(0)} ${dto.currency}`,
      );
    }

    return { amount, rate, amountLak, changeLak };
  }

  async create(dto: CreateCreditDto, user: AuthenticatedUser, shiftId: string) {
    const context = await this.pricingContext.load();

    const sellPrice = dec(dto.sellPrice);
    const downPayment = dec(dto.downPayment);

    if (sellPrice.lte(0)) throw new BadRequestException('ລາຄາຂາຍຕ້ອງໃຫຍ່ກວ່າ 0');
    if (downPayment.isNegative()) throw new BadRequestException('ເງິນວາງດາວຕ້ອງບໍ່ຕິດລົບ');
    if (downPayment.gt(sellPrice)) {
      throw new BadRequestException('ເງິນວາງດາວຕ້ອງບໍ່ເກີນລາຄາຂາຍ');
    }

    const outstanding = sellPrice.minus(downPayment);

    // §5.3: the down payment received must cover the agreed down payment.
    const receipt = this.resolveReceipt(dto.receipt, context.rates, downPayment);
    if (receipt.amountLak.lt(downPayment)) {
      throw new BadRequestException(
        `ຮັບເງິນ (${receipt.amountLak.toFixed(0)} LAK) ຕ້ອງບໍ່ຫນ້ອຍກວ່າເງິນວາງດາວ (${downPayment.toFixed(0)} LAK)`,
      );
    }

    const customer = await this.prisma.customer.upsert({
      where: { phone: dto.phone },
      update: {},
      create: { phone: dto.phone },
    });

    return this.prisma.$transaction(async (tx) => {
      const credit = await tx.goldCredit.create({
        data: {
          code: await this.nextCode(tx),
          shiftId,
          customerId: customer.id,
          goldItemId: dto.goldItemId,
          cabinetId: dto.cabinetId ?? null,
          weightG: D(dec(dto.weightG)),
          quantity: dto.quantity,
          sellPrice: D(sellPrice),
          downPayment: D(downPayment),
          outstanding: D(outstanding),
          status: 'PENDING',
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
              isDownPayment: true,
              createdById: user.id,
            },
          },
        },
        include: { receipts: true, customer: true },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: 'CREATE',
          entity: 'GoldCredit',
          entityId: credit.id,
          after: { code: credit.code, outstanding: outstanding.toFixed() },
          summary: `ສ້າງລາຍການສິນເຊື່ອ ${credit.code} — ຕິດໜີ້ ${outstanding.toFixed(0)} LAK`,
        },
        tx,
      );

      await this.notifications.notify(
        {
          kind: 'CREDIT_CREATED',
          recipientRole: 'PAYMENT',
          title: 'ມີລາຍການສິນເຊື່ອລໍຖ້າອະນຸມັດ',
          body: `${credit.code} — ຕິດໜີ້ ${outstanding.toFixed(0)} LAK`,
          refType: 'GoldCredit',
          refId: credit.id,
        },
        tx,
      );

      return credit;
    });
  }

  /**
   * payment approves. On approval the down payment lands in cash/bank and the
   * outstanding balance is recognised as AR (Cash) — TOR §9.2.
   */
  async review(id: string, dto: ReviewCreditDto, user: AuthenticatedUser) {
    const credit = await this.prisma.goldCredit.findFirst({
      where: { id, deletedAt: null },
      include: { receipts: true },
    });
    if (!credit) throw new NotFoundException('ບໍ່ພົບລາຍການສິນເຊື່ອ');

    const next: ApprovalStatus = dto.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    this.approval.assertTransition(credit.status, next);

    const day = await this.businessDay.current();

    return this.prisma.$transaction(async (tx) => {
      if (dto.decision === 'APPROVED') {
        for (const receipt of credit.receipts) {
          await this.recordReceiptMoney(tx, {
            receipt,
            businessDayId: day.id,
            note: `ເງິນວາງດາວສິນເຊື່ອ ${credit.code}`,
            refId: credit.id,
            createdById: user.id,
          });
        }

        await this.apar.postCash(tx, {
          reason: 'CREDIT_ISSUED',
          currency: 'LAK',
          amount: dec(credit.outstanding.toFixed()),
          refId: credit.id,
          note: `ຍອດສິນເຊື່ອຕິດໜີ້ ${credit.code}`,
          createdById: user.id,
        });
      }

      const updated = await tx.goldCredit.update({
        where: { id },
        data: {
          status: next,
          approvedById: user.id,
          approvedAt: new Date(),
          rejectReason: dto.decision === 'REJECTED' ? (dto.reason ?? null) : null,
        },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
          entity: 'GoldCredit',
          entityId: id,
          before: { status: credit.status },
          after: { status: next },
        },
        tx,
      );

      await this.notifications.notify(
        {
          kind: 'APPROVAL_RESULT',
          recipientUserId: credit.createdById,
          title:
            dto.decision === 'APPROVED'
              ? `ສິນເຊື່ອ ${credit.code} ຖືກອະນຸມັດ`
              : `ສິນເຊື່ອ ${credit.code} ຖືກປະຕິເສດ`,
          body: dto.reason ?? undefined,
          refType: 'GoldCredit',
          refId: id,
        },
        tx,
      );

      return updated;
    });
  }

  /** An instalment against an outstanding credit — draws down the AR. */
  async addReceipt(id: string, dto: CreditReceiptDto, user: AuthenticatedUser) {
    const credit = await this.prisma.goldCredit.findFirst({ where: { id, deletedAt: null } });
    if (!credit) throw new NotFoundException('ບໍ່ພົບລາຍການສິນເຊື່ອ');
    if (credit.status !== 'APPROVED' && credit.status !== 'COMPLETED') {
      throw new BadRequestException('ສິນເຊື່ອຍັງບໍ່ໄດ້ຮັບການອະນຸມັດ');
    }

    const outstanding = dec(credit.outstanding.toFixed());
    if (outstanding.lte(0)) throw new BadRequestException('ສິນເຊື່ອນີ້ຊຳຣະຄົບແລ້ວ');

    const context = await this.pricingContext.load();
    const receipt = this.resolveReceipt(dto, context.rates, outstanding);
    const applied = receipt.amountLak.minus(receipt.changeLak);
    const remaining = outstanding.minus(applied);
    const day = await this.businessDay.current();

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.creditReceipt.create({
        data: {
          creditId: id,
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
        receipt: created,
        businessDayId: day.id,
        note: `ຮັບຄ່າງວດສິນເຊື່ອ ${credit.code}`,
        refId: credit.id,
        createdById: user.id,
      });

      await this.apar.postCash(tx, {
        reason: 'CREDIT_RECEIPT',
        currency: 'LAK',
        amount: applied,
        refId: credit.id,
        note: `ຮັບຄ່າງວດ ${credit.code}`,
        createdById: user.id,
      });

      const settled = remaining.lte(0);
      const updated = await tx.goldCredit.update({
        where: { id },
        data: {
          outstanding: D(settled ? dec(0) : remaining),
          ...(settled ? { status: 'COMPLETED', settledAt: new Date() } : {}),
        },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: 'UPDATE',
          entity: 'GoldCredit',
          entityId: id,
          before: { outstanding: outstanding.toFixed() },
          after: { outstanding: updated.outstanding.toFixed() },
          summary: `ຮັບຄ່າງວດ ${credit.code} — ${applied.toFixed(0)} LAK`,
        },
        tx,
      );

      return updated;
    });
  }

  async list(status?: ApprovalStatus) {
    const rows = await this.prisma.goldCredit.findMany({
      where: { deletedAt: null, ...(status ? { status } : {}) },
      include: { customer: true, goldItem: true, receipts: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // TOR History tables carry UPDATED BY.
    return this.audit.withActorNames(rows);
  }

  /** Money in, to cash or bank depending on how it was taken. */
  private async recordReceiptMoney(
    tx: Prisma.TransactionClient,
    input: {
      receipt: { method: string; bankAccountId: string | null; currency: Currency; amount: Prisma.Decimal };
      businessDayId: string;
      note: string;
      refId: string;
      createdById: string;
    },
  ) {
    if (input.receipt.method === 'CASH') {
      await tx.cashTransaction.create({
        data: {
          businessDayId: input.businessDayId,
          type: 'IN',
          currency: input.receipt.currency,
          amount: input.receipt.amount,
          refType: 'GoldCredit',
          refId: input.refId,
          note: input.note,
          createdById: input.createdById,
        },
      });
    } else if (input.receipt.bankAccountId) {
      await tx.bankTransaction.create({
        data: {
          businessDayId: input.businessDayId,
          bankAccountId: input.receipt.bankAccountId,
          type: 'DEPOSIT',
          currency: input.receipt.currency,
          amount: input.receipt.amount,
          refType: 'GoldCredit',
          refId: input.refId,
          note: input.note,
          createdById: input.createdById,
        },
      });
    }
  }

  private async nextCode(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const prefix = `CR-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const count = await tx.goldCredit.count({ where: { code: { startsWith: prefix } } });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }
}
