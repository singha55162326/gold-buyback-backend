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
exports.CashService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
const approval_service_1 = require("../../common/services/approval.service");
const business_day_service_1 = require("../../common/services/business-day.service");
const notifications_service_1 = require("../notifications/notifications.service");
const D = (value) => new client_1.Prisma.Decimal(value.toFixed());
const CURRENCIES = ['LAK', 'THB', 'USD'];
/** Signs for the four cash movement types (TOR §3.7). */
const CASH_SIGN = {
    IN: 1,
    OTHER_INCOME: 1,
    OUT: -1,
    OTHER_EXPENSE: -1,
};
/** Signs for the four bank movement types (TOR §3.7). */
const BANK_SIGN = {
    DEPOSIT: 1,
    INCOME: 1,
    WITHDRAW: -1,
    EXPENSE: -1,
};
/**
 * TOR §3.7 Module Cash / Module Bank, §4.1 ກະເປົ໋າເງິນສົດ and §6 approvals.
 *
 * The rule that shapes this module is §6's withdrawal workflow:
 *
 *   payment ກົດເບີກ -> FC ກົດ Approve -> payment ກົດຢືນຢັນຮັບເງິນ
 *     -> ຍອດເງິນຈຶ່ງຈະລົບອອກຈາກ Module Cash ຕົວຈິງ
 *
 * Money moves on the THIRD step, not the second. An approved-but-unconfirmed
 * request is a promise, not a transaction, so the cash ledger keeps matching
 * the notes actually in the drawer.
 */
let CashService = class CashService {
    prisma;
    audit;
    approval;
    businessDay;
    notifications;
    constructor(prisma, audit, approval, businessDay, notifications) {
        this.prisma = prisma;
        this.audit = audit;
        this.approval = approval;
        this.businessDay = businessDay;
        this.notifications = notifications;
    }
    /* ---------------------------------------------------------------- *
     * §4.1 / §6 — ເບີກເງິນ (+) / ມອບເງິນ (-)
     * ---------------------------------------------------------------- */
    async createRequest(dto, user, shiftId) {
        const lines = dto.lines.map((line) => {
            const amount = (0, domain_1.dec)(line.amount);
            if (!amount.isFinite() || amount.lte(0)) {
                throw new common_1.BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
            }
            return { currency: line.currency, amount };
        });
        const seen = new Set(lines.map((l) => l.currency));
        if (seen.size !== lines.length) {
            throw new common_1.BadRequestException('ແຕ່ລະສະກຸນເງິນປ້ອນໄດ້ພຽງຄັ້ງດຽວ');
        }
        const request = await this.prisma.$transaction(async (tx) => {
            const created = await tx.cashRequest.create({
                data: {
                    shiftId,
                    direction: dto.direction,
                    status: 'PENDING',
                    note: dto.note ?? null,
                    requestedById: user.id,
                    lines: { create: lines.map((l) => ({ currency: l.currency, amount: D(l.amount) })) },
                },
                include: { lines: true },
            });
            const label = dto.direction === 'WITHDRAW' ? 'ເບີກເງິນ' : 'ມອບເງິນ';
            await this.audit.record({
                actorId: user.id,
                action: 'CREATE',
                entity: 'CashRequest',
                entityId: created.id,
                after: { direction: dto.direction, lines: lines.map((l) => `${l.currency} ${l.amount.toFixed()}`) },
                summary: `${user.fullName} ຮ້ອງຂໍ${label}`,
            }, tx);
            await this.notifications.notify({
                kind: 'CASH_REQUEST',
                recipientRole: 'FINANCIAL_CONTROLLER',
                title: `ມີການ${label}ລໍຖ້າອະນຸມັດ`,
                body: lines.map((l) => `${l.currency} ${l.amount.toFixed(0)}`).join(' · '),
                refType: 'CashRequest',
                refId: created.id,
            }, tx);
            return created;
        });
        return request;
    }
    /** Financial Controller approves or rejects (TOR §6). */
    async reviewRequest(id, dto, user) {
        const request = await this.prisma.cashRequest.findFirst({
            where: { id, deletedAt: null },
            include: { lines: true, shift: true },
        });
        if (!request)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການ');
        const next = dto.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        this.approval.assertTransition(request.status, next);
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.cashRequest.update({
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
                entity: 'CashRequest',
                entityId: id,
                before: { status: request.status },
                after: { status: next },
            }, tx);
            await this.notifications.notify({
                kind: 'APPROVAL_RESULT',
                recipientUserId: request.requestedById,
                title: dto.decision === 'APPROVED'
                    ? 'ການເບີກ/ມອບເງິນຖືກອະນຸມັດ — ກະລຸນາກົດຢືນຢັນ'
                    : 'ການເບີກ/ມອບເງິນຖືກປະຕິເສດ',
                body: dto.reason ?? undefined,
                refType: 'CashRequest',
                refId: id,
            }, tx);
            return updated;
        });
    }
    /**
     * payment ກົດ 'Completed' — the point at which cash actually moves.
     *
     * ເບີກເງິນ (+) takes money OUT of the shop's cash into the cashier's float;
     * ມອບເງິນ (-) returns it. Both are recorded from the shop's perspective.
     */
    async completeRequest(id, user) {
        const request = await this.prisma.cashRequest.findFirst({
            where: { id, deletedAt: null },
            include: { lines: true },
        });
        if (!request)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການ');
        if (request.requestedById !== user.id && !['ADMIN', 'MANAGER'].includes(user.role)) {
            throw new common_1.ConflictException('ມີພຽງຜູ້ຮ້ອງຂໍເທົ່ານັ້ນທີ່ຢືນຢັນໄດ້');
        }
        this.approval.assertTransition(request.status, 'COMPLETED');
        const day = await this.businessDay.current();
        const type = request.direction === 'WITHDRAW' ? 'OUT' : 'IN';
        return this.prisma.$transaction(async (tx) => {
            for (const line of request.lines) {
                await tx.cashTransaction.create({
                    data: {
                        businessDayId: day.id,
                        shiftId: request.shiftId,
                        type,
                        currency: line.currency,
                        amount: line.amount,
                        refType: 'CashRequest',
                        refId: request.id,
                        note: request.note ?? null,
                        createdById: user.id,
                    },
                });
            }
            const updated = await tx.cashRequest.update({
                where: { id },
                data: { status: 'COMPLETED', completedAt: new Date() },
            });
            await this.audit.record({
                actorId: user.id,
                action: 'COMPLETE',
                entity: 'CashRequest',
                entityId: id,
                summary: `ຢືນຢັນ${request.direction === 'WITHDRAW' ? 'ຮັບເງິນ' : 'ມອບເງິນ'} — ${request.lines
                    .map((l) => `${l.currency} ${l.amount.toFixed(0)}`)
                    .join(' · ')}`,
            }, tx);
            return updated;
        });
    }
    listRequests(status) {
        return this.prisma.cashRequest.findMany({
            where: { deletedAt: null, ...(status ? { status } : {}) },
            include: { lines: true, shift: { include: { user: true } } },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
    }
    /* ---------------------------------------------------------------- *
     * §3.7 — Module Cash
     * ---------------------------------------------------------------- */
    async createCashTransaction(dto, user) {
        const amount = (0, domain_1.dec)(dto.amount);
        if (!amount.isFinite() || amount.lte(0)) {
            throw new common_1.BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
        }
        const day = await this.businessDay.current();
        const created = await this.prisma.cashTransaction.create({
            data: {
                businessDayId: day.id,
                type: dto.type,
                currency: dto.currency,
                amount: D(amount),
                note: dto.note ?? null,
                createdById: user.id,
            },
        });
        await this.audit.record({
            actorId: user.id,
            action: 'CREATE',
            entity: 'CashTransaction',
            entityId: created.id,
            after: { type: dto.type, currency: dto.currency, amount: amount.toFixed() },
        });
        return created;
    }
    /** ຍອດເງິນສົດຄົງເຫຼືອ per currency, for today (TOR §3.7). */
    async cashBalances() {
        const day = await this.businessDay.current();
        const rows = await this.prisma.cashTransaction.groupBy({
            by: ['currency', 'type'],
            where: { businessDayId: day.id, deletedAt: null },
            _sum: { amount: true },
        });
        return CURRENCIES.map((currency) => {
            let inflow = (0, domain_1.dec)(0);
            let outflow = (0, domain_1.dec)(0);
            for (const row of rows) {
                if (row.currency !== currency)
                    continue;
                const amount = (0, domain_1.dec)(row._sum.amount?.toFixed() ?? 0);
                if (CASH_SIGN[row.type] === 1)
                    inflow = inflow.plus(amount);
                else
                    outflow = outflow.plus(amount);
            }
            return {
                currency,
                inflow: inflow.toFixed(),
                outflow: outflow.toFixed(),
                balance: inflow.minus(outflow).toFixed(),
            };
        });
    }
    cashHistory(limit = 200) {
        return this.prisma.cashTransaction.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit, 500),
        });
    }
    /* ---------------------------------------------------------------- *
     * §3.7 — Module Bank
     * ---------------------------------------------------------------- */
    async createBankTransaction(dto, user) {
        const amount = (0, domain_1.dec)(dto.amount);
        if (!amount.isFinite() || amount.lte(0)) {
            throw new common_1.BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
        }
        const bank = await this.prisma.bankAccount.findUnique({ where: { id: dto.bankAccountId } });
        if (!bank)
            throw new common_1.NotFoundException('ບໍ່ພົບບັນຊີທະນາຄານ');
        const day = await this.businessDay.current();
        const created = await this.prisma.bankTransaction.create({
            data: {
                businessDayId: day.id,
                bankAccountId: dto.bankAccountId,
                type: dto.type,
                currency: dto.currency,
                amount: D(amount),
                note: dto.note ?? null,
                createdById: user.id,
            },
        });
        await this.audit.record({
            actorId: user.id,
            action: 'CREATE',
            entity: 'BankTransaction',
            entityId: created.id,
            after: { bank: bank.code, type: dto.type, currency: dto.currency, amount: amount.toFixed() },
        });
        return created;
    }
    /**
     * Per-bank, per-currency actual balance beside the ເງິນ Bank ສຸດທິ figure.
     *
     *   ຍອດເງິນຂາດດຸນ = ຍອດຕົວຈິງ − ຍອດສຸດທິ
     *
     * A non-zero variance is the shop's signal that the ledger and the bank
     * statement have diverged, so it is surfaced rather than reconciled away.
     */
    async bankBalances() {
        const day = await this.businessDay.current();
        const [accounts, rows, netBalances] = await Promise.all([
            this.prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
            this.prisma.bankTransaction.groupBy({
                by: ['bankAccountId', 'currency', 'type'],
                where: { businessDayId: day.id, deletedAt: null },
                _sum: { amount: true },
            }),
            this.prisma.bankNetBalance.findMany({ where: { businessDayId: day.id } }),
        ]);
        const netByKey = new Map(netBalances.map((n) => [`${n.bankAccountId}:${n.currency}`, (0, domain_1.dec)(n.netAmount.toFixed())]));
        return accounts.flatMap((account) => CURRENCIES.map((currency) => {
            let inflow = (0, domain_1.dec)(0);
            let outflow = (0, domain_1.dec)(0);
            for (const row of rows) {
                if (row.bankAccountId !== account.id || row.currency !== currency)
                    continue;
                const amount = (0, domain_1.dec)(row._sum.amount?.toFixed() ?? 0);
                if (BANK_SIGN[row.type] === 1)
                    inflow = inflow.plus(amount);
                else
                    outflow = outflow.plus(amount);
            }
            const actual = inflow.minus(outflow);
            const net = netByKey.get(`${account.id}:${currency}`);
            return {
                bankAccountId: account.id,
                bankCode: account.code,
                bankNameLo: account.nameLo,
                currency,
                inflow: inflow.toFixed(),
                outflow: outflow.toFixed(),
                actual: actual.toFixed(),
                net: net ? net.toFixed() : null,
                variance: net ? actual.minus(net).toFixed() : null,
            };
        }));
    }
    /** ADMIN/MANAGER only — enforced by @Roles on the controller. */
    async setBankNetBalance(dto, user) {
        const day = await this.businessDay.current();
        const netAmount = (0, domain_1.dec)(dto.netAmount);
        const saved = await this.prisma.bankNetBalance.upsert({
            where: {
                businessDayId_bankAccountId_currency: {
                    businessDayId: day.id,
                    bankAccountId: dto.bankAccountId,
                    currency: dto.currency,
                },
            },
            update: { netAmount: D(netAmount), enteredById: user.id },
            create: {
                businessDayId: day.id,
                bankAccountId: dto.bankAccountId,
                currency: dto.currency,
                netAmount: D(netAmount),
                enteredById: user.id,
            },
        });
        await this.audit.record({
            actorId: user.id,
            action: 'UPDATE',
            entity: 'BankNetBalance',
            entityId: saved.id,
            after: { currency: dto.currency, netAmount: netAmount.toFixed() },
            summary: `ຕັ້ງເງິນ Bank ສຸດທິ ${dto.currency} = ${netAmount.toFixed(0)}`,
        });
        return saved;
    }
    bankHistory(limit = 200) {
        return this.prisma.bankTransaction.findMany({
            where: { deletedAt: null },
            include: { bankAccount: true },
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit, 500),
        });
    }
};
exports.CashService = CashService;
exports.CashService = CashService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        approval_service_1.ApprovalService,
        business_day_service_1.BusinessDayService,
        notifications_service_1.NotificationsService])
], CashService);
//# sourceMappingURL=cash.service.js.map