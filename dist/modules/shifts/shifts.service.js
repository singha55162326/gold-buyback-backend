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
exports.ShiftsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
const approval_service_1 = require("../../common/services/approval.service");
const business_day_service_1 = require("../../common/services/business-day.service");
const stock_ledger_service_1 = require("../../common/services/stock-ledger.service");
const notifications_service_1 = require("../notifications/notifications.service");
/**
 * ເປີດກະ / ປິດກະ (TOR §4, §5).
 *
 * The rule that matters is one shift per user per business day: once closed,
 * a cashier cannot reopen and keep transacting on the same day. That is
 * enforced by the unique (userId, businessDayId) constraint plus the status
 * check below, and read at request time by ShiftGuard.
 */
let ShiftsService = class ShiftsService {
    prisma;
    audit;
    approval;
    businessDay;
    notifications;
    stockLedger;
    constructor(prisma, audit, approval, businessDay, notifications, stockLedger) {
        this.prisma = prisma;
        this.audit = audit;
        this.approval = approval;
        this.businessDay = businessDay;
        this.notifications = notifications;
        this.stockLedger = stockLedger;
    }
    /** The caller's shift for today, if any. */
    async currentFor(userId) {
        const day = await this.businessDay.current();
        return this.prisma.shift.findUnique({
            where: { userId_businessDayId: { userId, businessDayId: day.id } },
            include: { closingBalances: true },
        });
    }
    async open(user) {
        const day = await this.businessDay.current();
        const existing = await this.prisma.shift.findUnique({
            where: { userId_businessDayId: { userId: user.id, businessDayId: day.id } },
        });
        if (existing) {
            if (existing.status === 'OPEN')
                return existing;
            throw new common_1.ConflictException('ທ່ານໄດ້ປິດກະຂອງມື້ນີ້ແລ້ວ ບໍ່ສາມາດເປີດກະໃໝ່ໄດ້');
        }
        const shift = await this.prisma.shift.create({
            data: { userId: user.id, businessDayId: day.id, status: 'OPEN' },
        });
        await this.audit.record({
            actorId: user.id, action: 'CREATE', entity: 'Shift', entityId: shift.id,
            summary: `${user.fullName} ເປີດກະ`,
        });
        return shift;
    }
    /**
     * ປິດກະ. The shift moves to PENDING_APPROVAL and a notification goes to the
     * Financial Controller; the closing cash is not recognised in Module Cash
     * until that approval lands.
     */
    async close(user, dto) {
        const shift = await this.currentFor(user.id);
        if (!shift)
            throw new common_1.NotFoundException('ຍັງບໍ່ໄດ້ເປີດກະ');
        if (shift.status !== 'OPEN')
            throw new common_1.ConflictException('ກະນີ້ຖືກປິດແລ້ວ');
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.shiftCashBalance.deleteMany({ where: { shiftId: shift.id } });
            for (const line of dto.balances) {
                await tx.shiftCashBalance.create({
                    data: {
                        shiftId: shift.id,
                        currency: line.currency,
                        amount: new client_1.Prisma.Decimal((0, domain_1.dec)(line.amount).toFixed()),
                    },
                });
            }
            const result = await tx.shift.update({
                where: { id: shift.id },
                data: { status: 'PENDING_APPROVAL', closedAt: new Date(), note: dto.note ?? null },
                include: { closingBalances: true },
            });
            await this.audit.record({
                actorId: user.id, action: 'UPDATE', entity: 'Shift', entityId: shift.id,
                before: { status: shift.status }, after: { status: result.status },
                summary: `${user.fullName} ປິດກະ`,
            }, tx);
            await this.notifications.notify({
                kind: 'SHIFT_CLOSE',
                recipientRole: 'FINANCIAL_CONTROLLER',
                title: 'ມີການປິດກະລໍຖ້າອະນຸມັດ',
                body: `${user.fullName} ໄດ້ປິດກະ ກະລຸນາກວດສອບ ແລະ ອະນຸມັດ`,
                refType: 'Shift',
                refId: shift.id,
            }, tx);
            return result;
        });
        return updated;
    }
    /** Financial Controller approves or rejects a shift close (TOR §6). */
    async review(id, dto, reviewer) {
        if (!['ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER'].includes(reviewer.role)) {
            throw new common_1.ForbiddenException('ທ່ານບໍ່ມີສິດອະນຸມັດການປິດກະ');
        }
        const shift = await this.prisma.shift.findUnique({
            where: { id },
            include: { user: true, closingBalances: true },
        });
        if (!shift)
            throw new common_1.NotFoundException('ບໍ່ພົບກະ');
        if (shift.status !== 'PENDING_APPROVAL') {
            throw new common_1.ConflictException('ກະນີ້ບໍ່ໄດ້ຢູ່ໃນສະຖານະລໍຖ້າອະນຸມັດ');
        }
        const day = await this.businessDay.current();
        const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.shift.update({
                where: { id },
                data: {
                    status: dto.decision === 'APPROVED' ? 'CLOSED' : 'REJECTED',
                    approvedById: reviewer.id,
                    approvedAt: new Date(),
                    rejectReason: dto.decision === 'REJECTED' ? (dto.reason ?? null) : null,
                },
            });
            if (dto.decision === 'APPROVED') {
                // §4.1 — ຍອດ LAK, THB, USD ຈະເຂົ້າຄັງ Module Cash.
                // Posted on approval, not at close: until the Financial Controller
                // has counted it, the cashier's declared figure is a claim, not cash.
                for (const balance of shift.closingBalances) {
                    if (balance.amount.lte(0))
                        continue;
                    await tx.cashTransaction.create({
                        data: {
                            businessDayId: day.id,
                            shiftId: shift.id,
                            type: 'IN',
                            currency: balance.currency,
                            amount: balance.amount,
                            refType: 'ShiftClose',
                            refId: shift.id,
                            note: `ປິດກະ ${shift.user.fullName}`,
                            createdById: reviewer.id,
                        },
                    });
                }
                // §4.2 — ຍອດຄຳເກົ່າຄົງເຫຼືອຈະເຂົ້າ Module Stock (OLD) ແຍກຕາມປະເພດຄຳ.
                await this.postRemainingOldGold(tx, shift.id, day.id, reviewer.id);
            }
            await this.audit.record({
                actorId: reviewer.id,
                action: dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
                entity: 'Shift',
                entityId: id,
                summary: `${dto.decision === 'APPROVED' ? 'ອະນຸມັດ' : 'ປະຕິເສດ'}ການປິດກະຂອງ ${shift.user.fullName}`,
            }, tx);
            await this.notifications.notify({
                kind: 'APPROVAL_RESULT',
                recipientUserId: shift.userId,
                title: dto.decision === 'APPROVED' ? 'ການປິດກະຖືກອະນຸມັດ' : 'ການປິດກະຖືກປະຕິເສດ',
                body: dto.reason ?? undefined,
                refType: 'Shift',
                refId: id,
            }, tx);
            return result;
        });
        return updated;
    }
    /**
     * §4.2 — on shift approval, the old gold still on the counter moves into
     * Stock (OLD), split by ປະເພດຄຳ.
     *
     * "Remaining" is what the shift bought back MINUS what was already handed
     * to the warehouse mid-day (ມອບຄຳລະຫວ່າງມື້), so gold cannot be booked into
     * the vault twice.
     */
    async postRemainingOldGold(tx, shiftId, businessDayId, actorId) {
        const [buybacks, handovers] = await Promise.all([
            tx.buyback.findMany({
                where: { shiftId, status: 'COMPLETED', deletedAt: null },
                select: { goldTypeId: true, weightG: true, quantity: true, payableAmount: true },
            }),
            tx.goldHandover.findMany({
                where: { shiftId, status: 'APPROVED', deletedAt: null },
                select: { goldTypeId: true, weightG: true },
            }),
        ]);
        const bought = new Map();
        for (const row of buybacks) {
            const weight = (0, domain_1.dec)(row.weightG.toFixed()).mul(row.quantity);
            const current = bought.get(row.goldTypeId) ?? { weight: (0, domain_1.dec)(0), cost: (0, domain_1.dec)(0) };
            bought.set(row.goldTypeId, {
                weight: current.weight.plus(weight),
                cost: current.cost.plus((0, domain_1.dec)(row.payableAmount.toFixed())),
            });
        }
        for (const row of handovers) {
            const current = bought.get(row.goldTypeId);
            if (!current)
                continue;
            bought.set(row.goldTypeId, {
                weight: current.weight.minus((0, domain_1.dec)(row.weightG.toFixed())),
                cost: current.cost,
            });
        }
        for (const [goldTypeId, totals] of bought) {
            if (totals.weight.lte(0))
                continue;
            await this.stockLedger.postOld(tx, {
                goldTypeId,
                businessDayId,
                goldInG: totals.weight,
                priceIn: totals.cost,
                partnerLabel: 'Cashier',
                typeLabel: 'ປິດກະ — ຄຳເກົ່າຄົງເຫຼືອ',
                createdById: actorId,
            });
        }
    }
    /** Shifts awaiting the Financial Controller (TOR §6 Notification Center). */
    pending() {
        return this.prisma.shift.findMany({
            where: { status: 'PENDING_APPROVAL' },
            include: { user: true, closingBalances: true, businessDay: true },
            orderBy: { closedAt: 'asc' },
        });
    }
};
exports.ShiftsService = ShiftsService;
exports.ShiftsService = ShiftsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        approval_service_1.ApprovalService,
        business_day_service_1.BusinessDayService,
        notifications_service_1.NotificationsService,
        stock_ledger_service_1.StockLedgerService])
], ShiftsService);
//# sourceMappingURL=shifts.service.js.map