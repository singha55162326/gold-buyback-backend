"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
const history_range_service_1 = require("../../common/services/history-range.service");
const approval_service_1 = require("../../common/services/approval.service");
const business_day_service_1 = require("../../common/services/business-day.service");
const apar_posting_service_1 = require("../../common/services/apar-posting.service");
const notifications_service_1 = require("../notifications/notifications.service");
const pricing_context_service_1 = require("../pricing/pricing-context.service");
const D = (value) => new client_1.Prisma.Decimal(value.toFixed());
/**
 * TOR §5.3 change limits. Foreign notes are accepted for convenience, not as
 * a currency exchange service, so the amount that can come back as LAK change
 * is capped.
 */
const CHANGE_LIMIT = {
    THB: (0, domain_1.dec)(1_000),
    USD: (0, domain_1.dec)(100),
};
/**
 * TOR §5.3 — ລາຍການສິນເຊື່ອ (Gold Credit / Installment).
 *
 *   ຍອດເງິນສິນເຊື່ອຕິດໜີ້ = ລາຄາຂາຍ − ເງິນວາງດາວ
 *
 * The outstanding balance is an AR (Cash): the shop has handed over gold and
 * is owed money. It is posted on approval and drawn down by each instalment.
 */
let CreditService = class CreditService {
    prisma;
    audit;
    approval;
    businessDay;
    apar;
    notifications;
    pricingContext;
    range;
    constructor(prisma, audit, approval, businessDay, apar, notifications, pricingContext, range) {
        this.prisma = prisma;
        this.audit = audit;
        this.approval = approval;
        this.businessDay = businessDay;
        this.apar = apar;
        this.notifications = notifications;
        this.pricingContext = pricingContext;
        this.range = range;
    }
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
    resolveReceipts(lines, rates, owed) {
        if (lines.length === 0) {
            throw new common_1.BadRequestException('ຕ້ອງມີລາຍການຮັບເງິນຢ່າງໜ້ອຍ 1 ລາຍການ');
        }
        const resolved = lines.map((dto) => {
            if (dto.method === 'BANK' && !dto.bankAccountId) {
                throw new common_1.BadRequestException('ກະລຸນາເລືອກທະນາຄານ');
            }
            const amount = (0, domain_1.dec)(dto.amount);
            if (!amount.isFinite() || amount.lte(0)) {
                throw new common_1.BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
            }
            const rate = pricing_context_service_1.PricingContextService.rateFor(rates, dto.currency, 'sell');
            return { ...dto, amount, rate, amountLak: amount.mul(rate), changeLak: (0, domain_1.dec)(0) };
        });
        const totalLak = resolved.reduce((sum, l) => sum.plus(l.amountLak), (0, domain_1.dec)(0));
        const change = totalLak.gt(owed) ? totalLak.minus(owed) : (0, domain_1.dec)(0);
        if (change.gt(0)) {
            const last = resolved[resolved.length - 1];
            last.changeLak = change;
            // §5.3: THB change ≤ 1,000 THB equivalent; USD change ≤ 100 USD.
            // Checked against the leg the change comes out of.
            const limit = CHANGE_LIMIT[last.currency];
            if (limit && change.gt(limit.mul(last.rate))) {
                throw new common_1.BadRequestException(`ເງິນທອນຈາກ ${last.currency} ປ້ອນໄດ້ບໍ່ເກີນ ${limit.toFixed(0)} ${last.currency}`);
            }
        }
        return { lines: resolved, totalLak, changeLak: change };
    }
    /**
     * The legs of a request, however the client spelled them: nested under
     * `receipt`, listed under `receipts`, or — on the receive endpoint —
     * spread across the body itself.
     */
    receiptLines(dto) {
        if (dto.receipts?.length)
            return dto.receipts;
        if (dto.receipt)
            return [dto.receipt];
        if (dto.method && dto.currency && dto.amount) {
            return [dto];
        }
        return [];
    }
    async create(dto, user, shiftId) {
        const context = await this.pricingContext.load();
        const sellPrice = (0, domain_1.dec)(dto.sellPrice);
        const downPayment = (0, domain_1.dec)(dto.downPayment);
        if (sellPrice.lte(0))
            throw new common_1.BadRequestException('ລາຄາຂາຍຕ້ອງໃຫຍ່ກວ່າ 0');
        if (downPayment.isNegative())
            throw new common_1.BadRequestException('ເງິນວາງດາວຕ້ອງບໍ່ຕິດລົບ');
        if (downPayment.gt(sellPrice)) {
            throw new common_1.BadRequestException('ເງິນວາງດາວຕ້ອງບໍ່ເກີນລາຄາຂາຍ');
        }
        const outstanding = sellPrice.minus(downPayment);
        // §5.3: the down payment received must cover the agreed down payment.
        const receipt = this.resolveReceipts(this.receiptLines(dto), context.rates, downPayment);
        if (receipt.totalLak.lt(downPayment)) {
            throw new common_1.BadRequestException(`ຮັບເງິນ (${receipt.totalLak.toFixed(0)} LAK) ຕ້ອງບໍ່ຫນ້ອຍກວ່າເງິນວາງດາວ (${downPayment.toFixed(0)} LAK)`);
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
                    weightG: D((0, domain_1.dec)(dto.weightG)),
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
            await this.audit.record({
                actorId: user.id,
                action: 'CREATE',
                entity: 'GoldCredit',
                entityId: credit.id,
                after: { code: credit.code, outstanding: outstanding.toFixed() },
                summary: `ສ້າງລາຍການສິນເຊື່ອ ${credit.code} — ຕິດໜີ້ ${outstanding.toFixed(0)} LAK`,
            }, tx);
            await this.notifications.notify({
                kind: 'CREDIT_CREATED',
                recipientRole: 'PAYMENT',
                title: 'ມີລາຍການສິນເຊື່ອລໍຖ້າອະນຸມັດ',
                body: `${credit.code} — ຕິດໜີ້ ${outstanding.toFixed(0)} LAK`,
                refType: 'GoldCredit',
                refId: credit.id,
            }, tx);
            return credit;
        });
    }
    /**
     * payment approves. On approval the down payment lands in cash/bank and the
     * outstanding balance is recognised as AR (Cash) — TOR §9.2.
     */
    async review(id, dto, user) {
        const credit = await this.prisma.goldCredit.findFirst({
            where: { id, deletedAt: null },
            include: { receipts: true },
        });
        if (!credit)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການສິນເຊື່ອ');
        const next = dto.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
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
                    amount: (0, domain_1.dec)(credit.outstanding.toFixed()),
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
            await this.audit.record({
                actorId: user.id,
                action: dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
                entity: 'GoldCredit',
                entityId: id,
                before: { status: credit.status },
                after: { status: next },
            }, tx);
            await this.notifications.notify({
                kind: 'APPROVAL_RESULT',
                recipientUserId: credit.createdById,
                title: dto.decision === 'APPROVED'
                    ? `ສິນເຊື່ອ ${credit.code} ຖືກອະນຸມັດ`
                    : `ສິນເຊື່ອ ${credit.code} ຖືກປະຕິເສດ`,
                body: dto.reason ?? undefined,
                refType: 'GoldCredit',
                refId: id,
            }, tx);
            return updated;
        });
    }
    /** An instalment against an outstanding credit — draws down the AR. */
    async addReceipt(id, dto, user) {
        const credit = await this.prisma.goldCredit.findFirst({ where: { id, deletedAt: null } });
        if (!credit)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການສິນເຊື່ອ');
        if (credit.status !== 'APPROVED' && credit.status !== 'COMPLETED') {
            throw new common_1.BadRequestException('ສິນເຊື່ອຍັງບໍ່ໄດ້ຮັບການອະນຸມັດ');
        }
        const outstanding = (0, domain_1.dec)(credit.outstanding.toFixed());
        if (outstanding.lte(0))
            throw new common_1.BadRequestException('ສິນເຊື່ອນີ້ຊຳຣະຄົບແລ້ວ');
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
                    outstanding: D(settled ? (0, domain_1.dec)(0) : remaining),
                    ...(settled ? { status: 'COMPLETED', settledAt: new Date() } : {}),
                },
            });
            await this.audit.record({
                actorId: user.id,
                action: 'UPDATE',
                entity: 'GoldCredit',
                entityId: id,
                before: { outstanding: outstanding.toFixed() },
                after: { outstanding: updated.outstanding.toFixed() },
                summary: `ຮັບຄ່າງວດ ${credit.code} — ${applied.toFixed(0)} LAK`,
            }, tx);
            return updated;
        });
    }
    async list(status, query, user) {
        const range = this.range.resolve(query, user);
        const where = {
            deletedAt: null,
            createdAt: history_range_service_1.HistoryRangeService.window(range),
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
    async recordReceiptMoney(tx, input) {
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
        }
        else if (input.receipt.bankAccountId) {
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
    async nextCode(tx) {
        const now = new Date();
        const prefix = `CR-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const count = await tx.goldCredit.count({ where: { code: { startsWith: prefix } } });
        return `${prefix}-${String(count + 1).padStart(3, '0')}`;
    }
};
exports.CreditService = CreditService;
exports.CreditService = CreditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        approval_service_1.ApprovalService,
        business_day_service_1.BusinessDayService,
        apar_posting_service_1.ApArPostingService,
        notifications_service_1.NotificationsService,
        pricing_context_service_1.PricingContextService,
        history_range_service_1.HistoryRangeService])
], CreditService);
//# sourceMappingURL=credit.service.js.map