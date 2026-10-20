import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ApprovalStatus, type Currency } from '@prisma/client';
import { dec, type Decimal } from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { HistoryRangeService } from '../../common/services/history-range.service';
import type { HistoryRangeDto } from '../../common/dto/history-range.dto';
import { ApprovalService } from '../../common/services/approval.service';
import { BusinessDayService } from '../../common/services/business-day.service';
import { ApArPostingService } from '../../common/services/apar-posting.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingContextService } from '../pricing/pricing-context.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type {
  CreateCreditDto,
  CreditReceiptDto,
  ReceiveCreditDto,
  ReviewCreditDto,
} from './dto/credit.dto';

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
    private readonly range: HistoryRangeService,
  ) {}

  /**
   * Convert a receipt to LAK at the SELL rate (the shop is taking money in)
   * and apply the §5.3 change caps.
   */
  /**
   * Resolve every leg of one receipt.
   *
   * A customer may pay part in cash and part by transfer, in more than one
   * currency, against a single instalment. Each leg converts at its own
   * rate; the change is computed on the TOTAL and charged to the last leg,
   * so the legs still sum to exactly what was taken in.
   */
  private resolveReceipts(
    lines: CreditReceiptDto[],
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
    const change = totalLak.gt(owed) ? totalLak.minus(owed) : dec(0);

    if (change.gt(0)) {
      const last = resolved[resolved.length - 1]!;
      last.changeLak = change;

      // §5.3: THB change ≤ 1,000 THB equivalent; USD change ≤ 100 USD.
      // Checked against the leg the change comes out of.
      const limit = CHANGE_LIMIT[last.currency];
      if (limit && change.gt(limit.mul(last.rate))) {
        throw new BadRequestException(
          `ເງິນທອນຈາກ ${last.currency} ປ້ອນໄດ້ບໍ່ເກີນ ${limit.toFixed(0)} ${last.currency}`,
        );
      }
    }

    return { lines: resolved, totalLak, changeLak: change };
  }

  /**
   * The legs of a request, however the client spelled them: nested under
   * `receipt`, listed under `receipts`, or — on the receive endpoint —
   * spread across the body itself.
   */
  private receiptLines(dto: {
    receipt?: CreditReceiptDto;
    receipts?: CreditReceiptDto[];
    method?: string;
    bankAccountId?: string;
    currency?: string;
    amount?: string;
  }): CreditReceiptDto[] {
    if (dto.receipts?.length) return dto.receipts;
    if (dto.receipt) return [dto.receipt];
    if (dto.method && dto.currency && dto.amount) {
      return [dto as unknown as CreditReceiptDto];
    }
    return [];
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
    const receipt = this.resolveReceipts(this.receiptLines(dto), context.rates, downPayment);
    if (receipt.totalLak.lt(downPayment)) {
      throw new BadRequestException(
        `ຮັບເງິນ (${receipt.totalLak.toFixed(0)} LAK) ຕ້ອງບໍ່ຫນ້ອຍກວ່າເງິນວາງດາວ (${downPayment.toFixed(0)} LAK)`,
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
            create: receipt.lines.map((line) => ({
              method: line.method,
              bankAccountId: line.bankAccountId ?? null,
              currency: line.currency,
              rate: D(line.rate),
              amount: D(line.amount),
              amountLak: D(line.amountLak),
              changeLak: D(line.changeLak),
              isDownPayment: true,
              createdById: user.id,
            })),
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
  async addReceipt(id: string, dto: ReceiveCreditDto, user: AuthenticatedUser) {
    const credit = await this.prisma.goldCredit.findFirst({ where: { id, deletedAt: null } });
    if (!credit) throw new NotFoundException('ບໍ່ພົບລາຍການສິນເຊື່ອ');
    if (credit.status !== 'APPROVED' && credit.status !== 'COMPLETED') {
      throw new BadRequestException('ສິນເຊື່ອຍັງບໍ່ໄດ້ຮັບການອະນຸມັດ');
    }

    const outstanding = dec(credit.outstanding.toFixed());
    if (outstanding.lte(0)) throw new BadRequestException('ສິນເຊື່ອນີ້ຊຳຣະຄົບແລ້ວ');

    const context = await this.pricingContext.load();
    const receipt = this.resolveReceipts(this.receiptLines(dto), context.rates, outstanding);
    const applied = receipt.totalLak.minus(receipt.changeLak);
    const remaining = outstanding.minus(applied);
    const day = await this.businessDay.current();

    return this.prisma.$transaction(async (tx) => {
      // One row and one cash/bank movement per leg, so Module Cash and
      // Module Bank each show what actually arrived in them.
      for (const line of receipt.lines) {
        const created = await tx.creditReceipt.create({
          data: {
            creditId: id,
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
          receipt: created,
          businessDayId: day.id,
          note: `ຮັບຄ່າງວດສິນເຊື່ອ ${credit.code}`,
          refId: credit.id,
          createdById: user.id,
        });
      }

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

  async list(status: ApprovalStatus | undefined, query: HistoryRangeDto, user?: AuthenticatedUser) {
    const range = this.range.resolve(query, user);
    const where = {
      deletedAt: null,
      createdAt: HistoryRangeService.window(range),
      ...(status ? { status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.goldCredit.findMany({
        where,
        include: { customer: true, goldItem: true, receipts: true },
        orderBy: { createdAt: 'desc' },
        skip: range.skip,
        take: range.take,
      }),
      this.prisma.goldCredit.count({ where }),
    ]);

    // TOR History tables carry UPDATED BY.
    return this.range.page(await this.audit.withActorNames(rows), total, range);
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
