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
exports.BuybackService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
const approval_service_1 = require("../../common/services/approval.service");
const business_day_service_1 = require("../../common/services/business-day.service");
const stock_ledger_service_1 = require("../../common/services/stock-ledger.service");
const notifications_service_1 = require("../notifications/notifications.service");
const pricing_context_service_1 = require("../pricing/pricing-context.service");
/** Maps a ປະເພດຄຳ row to the pricing branch it takes in §5.1. */
const KIND_BY_CODE = {
    GOOD: 'GOOD',
    HUMP: 'HUMP',
    BAR: 'BAR',
    BOILED: 'BOILED',
};
const D = (value) => new client_1.Prisma.Decimal(value.toFixed());
/**
 * TOR §5.1 — Buyback (ການຊື້ຄຳຄືນ).
 *
 * Workflow:
 *   ຜູ້ປະເມີນ ສ້າງລາຍການ (PENDING)
 *     -> payment ກົດ Approve (APPROVED)
 *       -> ຜູ້ປະເມີນ ກົດຢືນຢັນອີກຄັ້ງ (COMPLETED)
 *
 * Nothing moves until COMPLETED. At that point the cash/bank payout and the
 * Stock (OLD) receipt are written in ONE transaction, so the shop can never
 * end up having paid for gold it did not book, or booked gold it did not pay
 * for.
 */
let BuybackService = class BuybackService {
    prisma;
    audit;
    approval;
    businessDay;
    notifications;
    pricingContext;
    stockLedger;
    constructor(prisma, audit, approval, businessDay, notifications, pricingContext, stockLedger) {
        this.prisma = prisma;
        this.audit = audit;
        this.approval = approval;
        this.businessDay = businessDay;
        this.notifications = notifications;
        this.pricingContext = pricingContext;
        this.stockLedger = stockLedger;
    }
    kindFor(code) {
        const kind = KIND_BY_CODE[code];
        if (!kind) {
            throw new common_1.BadRequestException(`ປະເພດຄຳ "${code}" ບໍ່ຮອງຮັບການຊື້ຄືນ`);
        }
        return kind;
    }
    /**
     * Run the §5.1 calculation without writing anything — backs the live
     * preview on the Valuer's form.
     */
    async preview(dto) {
        const goldType = await this.prisma.goldType.findFirst({
            where: { id: dto.goldTypeId, deletedAt: null },
        });
        if (!goldType)
            throw new common_1.NotFoundException('ບໍ່ພົບປະເພດຄຳ');
        const context = await this.pricingContext.load();
        const kind = dto.source === 'OTHER_SHOP' ? 'BOILED' : this.kindFor(goldType.code);
        if (kind === 'BOILED' && !dto.goldPercent) {
            throw new common_1.BadRequestException('ຄຳຕົ້ມຕ້ອງປ້ອນ %ຄຳ');
        }
        const result = (0, domain_1.calculateBuyback)({
            kind,
            weightG: dto.weightG,
            quantity: dto.quantity,
            goldPercent: dto.goldPercent,
            deduction: dto.deduction,
        }, context.source, context.table);
        return {
            snapshotId: context.snapshot.id,
            goldTypeCode: goldType.code,
            kind,
            shopBuybackPrice: result.shopBuybackPrice.toFixed(),
            deduction: result.deduction.toFixed(),
            payableAmount: result.payableAmount.toFixed(),
            branch: result.branch,
        };
    }
    /**
     * ຜູ້ປະເມີນ creates the line. The price is recomputed server-side rather
     * than trusting what the browser previewed.
     */
    async create(dto, user, shiftId) {
        const goldType = await this.prisma.goldType.findFirst({
            where: { id: dto.goldTypeId, deletedAt: null },
        });
        if (!goldType)
            throw new common_1.NotFoundException('ບໍ່ພົບປະເພດຄຳ');
        const context = await this.pricingContext.load();
        const kind = dto.source === 'OTHER_SHOP' ? 'BOILED' : this.kindFor(goldType.code);
        if (kind === 'BOILED' && !dto.goldPercent) {
            throw new common_1.BadRequestException('ຄຳຕົ້ມຕ້ອງປ້ອນ %ຄຳ');
        }
        const result = (0, domain_1.calculateBuyback)({
            kind,
            weightG: dto.weightG,
            quantity: dto.quantity,
            goldPercent: dto.goldPercent,
            deduction: dto.deduction,
        }, context.source, context.table);
        if (result.payableAmount.lte(0)) {
            throw new common_1.BadRequestException(`ຄິດໄລ່ລາຄາບໍ່ໄດ້ (${result.branch}) — ກະລຸນາກວດສອບນ້ຳໜັກ ແລະ ປະເພດຄຳ`);
        }
        const payments = this.resolvePayments(dto.payments, result.payableAmount, context.rates);
        const customer = await this.prisma.customer.upsert({
            where: { phone: dto.phone },
            update: {},
            create: { phone: dto.phone },
        });
        const created = await this.prisma.$transaction(async (tx) => {
            const buyback = await tx.buyback.create({
                data: {
                    code: await this.nextCode(tx),
                    shiftId,
                    customerId: customer.id,
                    snapshotId: context.snapshot.id,
                    source: dto.source,
                    goldTypeId: dto.goldTypeId,
                    goldItemId: dto.goldItemId ?? null,
                    weightG: new client_1.Prisma.Decimal((0, domain_1.dec)(dto.weightG).toFixed()),
                    quantity: dto.quantity,
                    goldPercent: dto.goldPercent
                        ? new client_1.Prisma.Decimal((0, domain_1.dec)(dto.goldPercent).toFixed())
                        : null,
                    shopBuybackPrice: D(result.shopBuybackPrice),
                    deduction: D(result.deduction),
                    payableAmount: D(result.payableAmount),
                    // TOR §5.1 History carries ຍອດເງິນຄ້າງຈ່າຍ, so a partly-paid
                    // buyback is visible rather than looking settled.
                    paidAmount: D(payments.totalLak.minus(payments.changeLak)),
                    outstandingAmount: D(result.payableAmount.minus(payments.totalLak.minus(payments.changeLak))),
                    status: 'PENDING',
                    createdById: user.id,
                    payments: {
                        create: payments.lines.map((line) => ({
                            method: line.method,
                            bankAccountId: line.bankAccountId ?? null,
                            currency: line.currency,
                            rate: D(line.rate),
                            amount: D(line.amount),
                            amountLak: D(line.amountLak),
                            changeLak: D(line.changeLak),
                        })),
                    },
                },
                include: { payments: true, customer: true, goldType: true },
            });
            await this.audit.record({
                actorId: user.id,
                action: 'CREATE',
                entity: 'Buyback',
                entityId: buyback.id,
                after: {
                    code: buyback.code,
                    payableAmount: buyback.payableAmount.toFixed(),
                    branch: result.branch,
                },
                summary: `ສ້າງລາຍການ Buyback ${buyback.code} — ${result.payableAmount.toFixed(0)} LAK`,
            }, tx);
            await this.notifications.notify({
                kind: 'BUYBACK_CREATED',
                recipientRole: 'PAYMENT',
                title: 'ມີລາຍການ Buyback ໃໝ່ລໍຖ້າອະນຸມັດ',
                body: `${buyback.code} — ${result.payableAmount.toFixed(0)} LAK`,
                refType: 'Buyback',
                refId: buyback.id,
            }, tx);
            return buyback;
        });
        return { ...created, branch: result.branch };
    }
    /** payment ກົດ Approve / Reject (TOR §4.2). */
    async review(id, dto, user) {
        const buyback = await this.prisma.buyback.findFirst({
            where: { id, deletedAt: null },
        });
        if (!buyback)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການ Buyback');
        const next = dto.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        this.approval.assertTransition(buyback.status, next);
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.buyback.update({
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
                entity: 'Buyback',
                entityId: id,
                before: { status: buyback.status },
                after: { status: next },
                summary: `${dto.decision === 'APPROVED' ? 'ອະນຸມັດ' : 'ປະຕິເສດ'} Buyback ${buyback.code}`,
            }, tx);
            await this.notifications.notify({
                kind: 'APPROVAL_RESULT',
                recipientUserId: buyback.createdById,
                title: dto.decision === 'APPROVED'
                    ? `Buyback ${buyback.code} ຖືກອະນຸມັດ — ກະລຸນາກົດຢືນຢັນ`
                    : `Buyback ${buyback.code} ຖືກປະຕິເສດ`,
                body: dto.reason ?? undefined,
                refType: 'Buyback',
                refId: id,
            }, tx);
            return updated;
        });
    }
    /**
     * ຜູ້ປະເມີນ ກົດຢືນຢັນອີກຄັ້ງ -> COMPLETED.
     *
     * This is the only point at which anything moves. Cash/bank out and Stock
     * (OLD) in are posted together; if either fails, neither happens.
     */
    async confirm(id, user) {
        const buyback = await this.prisma.buyback.findFirst({
            where: { id, deletedAt: null },
            include: { payments: true, goldType: true },
        });
        if (!buyback)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການ Buyback');
        if (buyback.createdById !== user.id && !['ADMIN', 'MANAGER'].includes(user.role)) {
            throw new common_1.ConflictException('ມີພຽງຜູ້ສ້າງລາຍການເທົ່ານັ້ນທີ່ຢືນຢັນໄດ້');
        }
        this.approval.assertTransition(buyback.status, 'COMPLETED');
        const day = await this.businessDay.current();
        return this.prisma.$transaction(async (tx) => {
            // 1. Money leaves the shop, split across the recorded payment legs.
            for (const payment of buyback.payments) {
                if (payment.method === 'CASH') {
                    await tx.cashTransaction.create({
                        data: {
                            businessDayId: day.id,
                            shiftId: buyback.shiftId,
                            type: 'OUT',
                            currency: payment.currency,
                            amount: payment.amount,
                            refType: 'Buyback',
                            refId: buyback.id,
                            note: `ຈ່າຍ Buyback ${buyback.code}`,
                            createdById: user.id,
                        },
                    });
                }
                else if (payment.bankAccountId) {
                    await tx.bankTransaction.create({
                        data: {
                            businessDayId: day.id,
                            bankAccountId: payment.bankAccountId,
                            type: 'WITHDRAW',
                            currency: payment.currency,
                            amount: payment.amount,
                            refType: 'Buyback',
                            refId: buyback.id,
                            note: `ຈ່າຍ Buyback ${buyback.code}`,
                            createdById: user.id,
                        },
                    });
                }
            }
            // 2. The gold lands in Stock (OLD) under its ປະເພດຄຳ, at what was paid
            //    for it — so WAC reflects the real acquisition cost immediately.
            const goldG = (0, domain_1.dec)(buyback.weightG.toFixed()).mul(buyback.quantity);
            await this.stockLedger.postOld(tx, {
                goldTypeId: buyback.goldTypeId,
                businessDayId: day.id,
                goldInG: goldG,
                priceIn: (0, domain_1.dec)(buyback.payableAmount.toFixed()),
                partnerLabel: 'Cashier',
                typeLabel: `Buyback ${buyback.code}`,
                createdById: user.id,
            });
            const updated = await tx.buyback.update({
                where: { id },
                data: { status: 'COMPLETED', confirmedAt: new Date() },
            });
            await this.audit.record({
                actorId: user.id,
                action: 'COMPLETE',
                entity: 'Buyback',
                entityId: id,
                before: { status: buyback.status },
                after: { status: 'COMPLETED' },
                summary: `ຢືນຢັນ Buyback ${buyback.code} — ຈ່າຍ ${buyback.payableAmount.toFixed(0)} LAK, ຮັບຄຳ ${goldG.toFixed()} g`,
            }, tx);
            return updated;
        });
    }
    async list(status) {
        const rows = await this.prisma.buyback.findMany({
            where: { deletedAt: null, ...(status ? { status } : {}) },
            include: { customer: true, goldType: true, goldItem: true, payments: true },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        // TOR History tables carry UPDATED BY.
        return this.audit.withActorNames(rows);
    }
    /* ---------------------------------------------------------------- *
     * Helpers
     * ---------------------------------------------------------------- */
    /**
     * Convert each payment leg to LAK at the BUYBACK rate (the shop is paying
     * out) and apply the §5.1 rules:
     *   CHANGE (LAK ONLY) = (Amount × Rate) − ລວມເງິນທີ່ຕ້ອງຈ່າຍ (LAK)
     *   Amount LAK ຕ້ອງ ≤ TOTAL(LAK) ຈຶ່ງບັນທຶກໄດ້
     */
    resolvePayments(lines, payableAmount, rates) {
        const resolved = lines.map((line) => {
            if (line.method === 'BANK' && !line.bankAccountId) {
                throw new common_1.BadRequestException('ກະລຸນາເລືອກທະນາຄານ');
            }
            const amount = (0, domain_1.dec)(line.amount);
            if (!amount.isFinite() || amount.lte(0)) {
                throw new common_1.BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
            }
            const rate = pricing_context_service_1.PricingContextService.rateFor(rates, line.currency, 'buyback');
            const amountLak = amount.mul(rate);
            // §5.1: a LAK leg may not exceed the amount owed.
            if (line.currency === 'LAK' && amount.gt(payableAmount)) {
                throw new common_1.BadRequestException(`ຈຳນວນເງິນ LAK (${amount.toFixed(0)}) ຕ້ອງບໍ່ເກີນລວມເງິນທີ່ຕ້ອງຈ່າຍ (${payableAmount.toFixed(0)})`);
            }
            return { ...line, rate, amount, amountLak, changeLak: (0, domain_1.dec)(0) };
        });
        const totalLak = resolved.reduce((sum, line) => sum.plus(line.amountLak), (0, domain_1.dec)(0));
        const change = totalLak.minus(payableAmount);
        // Change is LAK-only and is attributed to the last leg, so the legs still
        // sum to exactly what was owed.
        if (change.gt(0) && resolved.length > 0) {
            resolved[resolved.length - 1].changeLak = change;
        }
        return { lines: resolved, totalLak, changeLak: change.gt(0) ? change : (0, domain_1.dec)(0) };
    }
    /** Sequential, human-readable code: BB-YYMMDD-NNN. */
    async nextCode(tx) {
        const now = new Date();
        const prefix = `BB-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const count = await tx.buyback.count({ where: { code: { startsWith: prefix } } });
        return `${prefix}-${String(count + 1).padStart(3, '0')}`;
    }
};
exports.BuybackService = BuybackService;
exports.BuybackService = BuybackService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        approval_service_1.ApprovalService,
        business_day_service_1.BusinessDayService,
        notifications_service_1.NotificationsService,
        pricing_context_service_1.PricingContextService,
        stock_ledger_service_1.StockLedgerService])
], BuybackService);
//# sourceMappingURL=buyback.service.js.map