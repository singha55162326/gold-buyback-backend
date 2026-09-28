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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const argon2_1 = require("@node-rs/argon2");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
const business_day_service_1 = require("../../common/services/business-day.service");
/** Tables carrying a soft-delete flag, for the Deleted List module (§3.7). */
const SOFT_DELETE_SOURCES = [
    { entity: 'Buyback', labelLo: 'Buyback' },
    { entity: 'GoldExchange', labelLo: 'ປ່ຽນເປັນເງິນ' },
    { entity: 'GoldCredit', labelLo: 'ສິນເຊື່ອ' },
    { entity: 'Order', labelLo: 'Order' },
    { entity: 'StockMovement', labelLo: 'Stock Movement' },
    { entity: 'GoldSku', labelLo: 'SKU' },
    { entity: 'CashTransaction', labelLo: 'Cash' },
    { entity: 'BankTransaction', labelLo: 'Bank' },
];
/**
 * User Setting and Deleted List (TOR §3.7), plus the day-rollover job that
 * §7.1, §7.2 and §9.2 all depend on.
 */
let AdminService = class AdminService {
    prisma;
    audit;
    businessDay;
    constructor(prisma, audit, businessDay) {
        this.prisma = prisma;
        this.audit = audit;
        this.businessDay = businessDay;
    }
    /* ---------------------------------------------------------------- *
     * User Setting
     * ---------------------------------------------------------------- */
    listUsers() {
        return this.prisma.user.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                phone: true,
                whatsappNumber: true,
                notifyWhatsApp: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
            orderBy: [{ role: 'asc' }, { username: 'asc' }],
        });
    }
    async createUser(dto, actor) {
        const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
        if (existing)
            throw new common_1.ConflictException('ຊື່ຜູ້ໃຊ້ນີ້ມີຢູ່ແລ້ວ');
        const created = await this.prisma.user.create({
            data: {
                username: dto.username.trim(),
                fullName: dto.fullName.trim(),
                role: dto.role,
                phone: dto.phone ?? null,
                whatsappNumber: dto.whatsappNumber ?? null,
                notifyWhatsApp: dto.notifyWhatsApp ?? false,
                passwordHash: await (0, argon2_1.hash)(dto.password),
            },
            select: { id: true, username: true, fullName: true, role: true, isActive: true },
        });
        await this.audit.record({
            actorId: actor.id,
            action: 'CREATE',
            entity: 'User',
            entityId: created.id,
            after: { username: created.username, role: created.role },
            summary: `ເພີ່ມຜູ້ໃຊ້ ${created.username} (${created.role})`,
        });
        return created;
    }
    async updateUser(id, dto, actor) {
        const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
        if (!user)
            throw new common_1.NotFoundException('ບໍ່ພົບຜູ້ໃຊ້');
        // The last active administrator cannot be locked out of the system.
        if (dto.isActive === false && user.role === 'ADMIN') {
            const activeAdmins = await this.prisma.user.count({
                where: { role: 'ADMIN', isActive: true, deletedAt: null },
            });
            if (activeAdmins <= 1) {
                throw new common_1.BadRequestException('ບໍ່ສາມາດປິດການນຳໃຊ້ Admin ຄົນສຸດທ້າຍໄດ້');
            }
        }
        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
                ...(dto.role ? { role: dto.role } : {}),
                ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
                ...(dto.whatsappNumber !== undefined ? { whatsappNumber: dto.whatsappNumber } : {}),
                ...(dto.notifyWhatsApp !== undefined ? { notifyWhatsApp: dto.notifyWhatsApp } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
            select: { id: true, username: true, fullName: true, role: true, isActive: true },
        });
        await this.audit.record({
            actorId: actor.id,
            action: 'UPDATE',
            entity: 'User',
            entityId: id,
            before: { role: user.role, isActive: user.isActive },
            after: { role: updated.role, isActive: updated.isActive },
        });
        return updated;
    }
    async resetPassword(id, dto, actor) {
        const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
        if (!user)
            throw new common_1.NotFoundException('ບໍ່ພົບຜູ້ໃຊ້');
        await this.prisma.user.update({
            where: { id },
            data: { passwordHash: await (0, argon2_1.hash)(dto.password) },
        });
        // Force re-authentication everywhere so a compromised session cannot
        // outlive the password it was issued against.
        await this.prisma.session.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        await this.audit.record({
            actorId: actor.id,
            action: 'UPDATE',
            entity: 'User',
            entityId: id,
            summary: `ປ່ຽນລະຫັດຜ່ານຂອງ ${user.username}`,
        });
        return { message: 'ປ່ຽນລະຫັດຜ່ານແລ້ວ' };
    }
    /* ---------------------------------------------------------------- *
     * Deleted List (§3.7)
     * ---------------------------------------------------------------- */
    /**
     * Everything soft-deleted across the system, newest first.
     *
     * Soft deletion is what makes this possible: a voided transaction stays in
     * the database so the ledger it touched can still be explained, and so a
     * mistaken deletion can be reviewed.
     */
    async deletedList() {
        const [buybacks, exchanges, credits, orders, movements, skus] = await Promise.all([
            this.prisma.buyback.findMany({
                where: { deletedAt: { not: null } },
                select: { id: true, code: true, deletedAt: true, payableAmount: true },
            }),
            this.prisma.goldExchange.findMany({
                where: { deletedAt: { not: null } },
                select: { id: true, code: true, deletedAt: true, totalPayable: true },
            }),
            this.prisma.goldCredit.findMany({
                where: { deletedAt: { not: null } },
                select: { id: true, code: true, deletedAt: true, outstanding: true },
            }),
            this.prisma.order.findMany({
                where: { deletedAt: { not: null } },
                select: { id: true, code: true, deletedAt: true, totalAmount: true },
            }),
            this.prisma.stockMovement.findMany({
                where: { deletedAt: { not: null } },
                select: { id: true, code: true, deletedAt: true, totalGoldG: true },
            }),
            this.prisma.goldSku.findMany({
                where: { deletedAt: { not: null } },
                select: { id: true, fullSkuName: true, deletedAt: true },
            }),
        ]);
        const rows = [
            ...buybacks.map((r) => ({
                entity: 'Buyback',
                labelLo: 'Buyback',
                id: r.id,
                code: r.code,
                detail: `${r.payableAmount.toFixed(0)} LAK`,
                deletedAt: r.deletedAt,
            })),
            ...exchanges.map((r) => ({
                entity: 'GoldExchange',
                labelLo: 'ປ່ຽນເປັນເງິນ',
                id: r.id,
                code: r.code,
                detail: `${r.totalPayable.toFixed(0)} LAK`,
                deletedAt: r.deletedAt,
            })),
            ...credits.map((r) => ({
                entity: 'GoldCredit',
                labelLo: 'ສິນເຊື່ອ',
                id: r.id,
                code: r.code,
                detail: `${r.outstanding.toFixed(0)} LAK`,
                deletedAt: r.deletedAt,
            })),
            ...orders.map((r) => ({
                entity: 'Order',
                labelLo: 'Order',
                id: r.id,
                code: r.code,
                detail: `${r.totalAmount.toFixed(0)} LAK`,
                deletedAt: r.deletedAt,
            })),
            ...movements.map((r) => ({
                entity: 'StockMovement',
                labelLo: 'Stock Movement',
                id: r.id,
                code: r.code,
                detail: `${r.totalGoldG.toFixed()} g`,
                deletedAt: r.deletedAt,
            })),
            ...skus.map((r) => ({
                entity: 'GoldSku',
                labelLo: 'SKU',
                id: r.id,
                code: r.fullSkuName,
                detail: '',
                deletedAt: r.deletedAt,
            })),
        ];
        return rows.sort((a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0));
    }
    /* ---------------------------------------------------------------- *
     * Day rollover (§7.1, §7.2, §9.2)
     * ---------------------------------------------------------------- */
    /**
     * Close today and open tomorrow.
     *
     *   ມື້ໃໝ່ Balance ຈະກາຍເປັນ ຈຳນວນຕັ້ງຕົ້ນ           (§7.1, §7.2)
     *   ຍອດສຸດທິທ້າຍມື້ ຈະຖືກຍົກໄປເປັນ ຍອດຕັ້ງຕົ້ນ ຂອງມື້ທັດໄປ  (§9.2)
     *
     * Idempotent: re-running for an already-closed day changes nothing, so a
     * retried job cannot double-carry a balance.
     */
    async rolloverDay(actor) {
        const today = await this.businessDay.current();
        if (today.isClosed) {
            throw new common_1.ConflictException('ມື້ນີ້ຖືກປິດແລ້ວ');
        }
        const tomorrowDate = new Date(today.date);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        return this.prisma.$transaction(async (tx) => {
            const tomorrow = await tx.businessDay.upsert({
                where: { date: tomorrowDate },
                update: {},
                create: { date: tomorrowDate },
            });
            // §7.1 — per-SKU counts carry forward as tomorrow's opening.
            const skuBalances = await tx.stockNewSkuBalance.findMany({
                where: { businessDayId: today.id },
            });
            for (const balance of skuBalances) {
                await tx.stockNewSkuBalance.upsert({
                    where: {
                        businessDayId_goldSkuId: {
                            businessDayId: tomorrow.id,
                            goldSkuId: balance.goldSkuId,
                        },
                    },
                    update: { openingQty: balance.balanceQty, balanceQty: balance.balanceQty },
                    create: {
                        businessDayId: tomorrow.id,
                        goldSkuId: balance.goldSkuId,
                        openingQty: balance.balanceQty,
                        balanceQty: balance.balanceQty,
                        totalWeightG: balance.totalWeightG,
                    },
                });
            }
            // §7.2 — per-ປະເພດຄຳ weight and cost carry forward.
            const typeBalances = await tx.stockOldTypeBalance.findMany({
                where: { businessDayId: today.id },
            });
            for (const balance of typeBalances) {
                await tx.stockOldTypeBalance.upsert({
                    where: {
                        businessDayId_goldTypeId: {
                            businessDayId: tomorrow.id,
                            goldTypeId: balance.goldTypeId,
                        },
                    },
                    update: {
                        openingWeightG: balance.closingWeightG,
                        openingCost: balance.closingCost,
                        closingWeightG: balance.closingWeightG,
                        closingCost: balance.closingCost,
                    },
                    create: {
                        businessDayId: tomorrow.id,
                        goldTypeId: balance.goldTypeId,
                        openingWeightG: balance.closingWeightG,
                        openingCost: balance.closingCost,
                        closingWeightG: balance.closingWeightG,
                        closingCost: balance.closingCost,
                    },
                });
            }
            // §9.2 — AP/AR (Cash) net becomes tomorrow's opening.
            const cashOpenings = await tx.cashApArOpening.findMany({
                where: { businessDayId: today.id },
            });
            for (const opening of cashOpenings) {
                await tx.cashApArOpening.upsert({
                    where: {
                        businessDayId_side_currency: {
                            businessDayId: tomorrow.id,
                            side: opening.side,
                            currency: opening.currency,
                        },
                    },
                    update: { openingAmount: opening.closingAmount, closingAmount: opening.closingAmount },
                    create: {
                        businessDayId: tomorrow.id,
                        side: opening.side,
                        currency: opening.currency,
                        openingAmount: opening.closingAmount,
                        closingAmount: opening.closingAmount,
                    },
                });
            }
            // §8 — AP/AR (GOLD) per partner.
            const goldOpenings = await tx.goldApArOpening.findMany({
                where: { businessDayId: today.id },
            });
            for (const opening of goldOpenings) {
                await tx.goldApArOpening.upsert({
                    where: {
                        businessDayId_partnerId_side: {
                            businessDayId: tomorrow.id,
                            partnerId: opening.partnerId,
                            side: opening.side,
                        },
                    },
                    update: {
                        openingWeightG: opening.closingWeightG,
                        openingCost: opening.closingCost,
                        closingWeightG: opening.closingWeightG,
                        closingCost: opening.closingCost,
                    },
                    create: {
                        businessDayId: tomorrow.id,
                        partnerId: opening.partnerId,
                        side: opening.side,
                        openingWeightG: opening.closingWeightG,
                        openingCost: opening.closingCost,
                        closingWeightG: opening.closingWeightG,
                        closingCost: opening.closingCost,
                    },
                });
            }
            const closed = await tx.businessDay.update({
                where: { id: today.id },
                data: { isClosed: true, closedAt: new Date(), closedById: actor.id },
            });
            await this.audit.record({
                actorId: actor.id,
                action: 'UPDATE',
                entity: 'BusinessDay',
                entityId: today.id,
                summary: `ປິດມື້ ແລະ ຍົກຍອດໄປມື້ທັດໄປ (${skuBalances.length} SKU, ${typeBalances.length} ປະເພດຄຳ)`,
            }, tx);
            return { closed, next: tomorrow, carriedSkus: skuBalances.length, carriedTypes: typeBalances.length };
        });
    }
    /** Audit trail for one entity (§3.2, §3.4 VIEW buttons). */
    auditForEntity(entity, entityId) {
        return this.audit.forEntity(entity, entityId);
    }
    /** Audit Logs viewer (§10). */
    auditLog(limit = 200) {
        return this.prisma.auditLog.findMany({
            include: { actor: { select: { username: true, fullName: true } } },
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit, 1000),
        });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        business_day_service_1.BusinessDayService])
], AdminService);
//# sourceMappingURL=admin.service.js.map