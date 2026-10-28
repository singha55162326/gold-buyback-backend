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
    async listUsers() {
        const rows = await this.prisma.user.findMany({
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
        // ຜູ້ບັນທຶກ — ຕາຕະລາງຜູ້ໃຊ້ບໍ່ມີຖັນນີ້ ຈຶ່ງອ່ານຈາກ Audit Log.
        return this.audit.withCreatorsFromAudit('User', rows);
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
        // The last active administrator cannot be locked out of the system —
        // whether by deactivating them or by demoting them, which has exactly
        // the same effect and used not to be checked.
        const losesAdmin = user.role === 'ADMIN' &&
            (dto.isActive === false || (dto.role !== undefined && dto.role !== 'ADMIN'));
        if (losesAdmin) {
            await this.assertNotLastAdmin(id);
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
    /**
     * Module Deleted List — ທຸກລາຍການທີ່ຖືກລຶບ ຈາກທຸກ Module.
     *
     * ລະບົບລຶບແບບ tombstone (ຕັ້ງ deletedAt) ທົ່ວທັງລະບົບ, ສະນັ້ນໜ້ານີ້ຈຶ່ງ
     * ກວາດທຸກຕາຕະລາງທີ່ມີ deletedAt ແທນທີ່ຈະເລືອກມາບາງອັນ — ລູກຄ້າແຈ້ງວ່າ
     * ເຫັນແຕ່ SKU ເພາະແຕ່ກ່ອນລະບຸໄວ້ພຽງ 6 ຕາຕະລາງ.
     *
     * ຊື່ຜູ້ລຶບ ດຶງຈາກ Audit Log ເປັນ query ດຽວ (ບໍ່ແມ່ນຕໍ່ແຖວ): ຕາຕະລາງສ່ວນ
     * ຫຼາຍບໍ່ໄດ້ເກັບ deletedById ໄວ້ ແຕ່ການລຶບທຸກຄັ້ງຂຽນ Audit Log ສະເໝີ.
     */
    async deletedList() {
        const gone = { deletedAt: { not: null } };
        const pick = { id: true, deletedAt: true };
        const [buybacks, exchanges, credits, orders, movements, skus, goldTypes, goldItems, cabinets, partners, ieCategories, ieTransactions, aparCategories, consignments, handovers, users, jewelryFees, barFees, cashTxns, bankTxns,] = await Promise.all([
            this.prisma.buyback.findMany({ where: gone, select: { ...pick, code: true, payableAmount: true } }),
            this.prisma.goldExchange.findMany({ where: gone, select: { ...pick, code: true, totalPayable: true } }),
            this.prisma.goldCredit.findMany({ where: gone, select: { ...pick, code: true, outstanding: true } }),
            this.prisma.order.findMany({ where: gone, select: { ...pick, code: true, totalAmount: true } }),
            this.prisma.stockMovement.findMany({ where: gone, select: { ...pick, code: true, totalGoldG: true } }),
            this.prisma.goldSku.findMany({ where: gone, select: { ...pick, code: true, fullSkuName: true } }),
            this.prisma.goldType.findMany({ where: gone, select: { ...pick, code: true, nameLo: true } }),
            this.prisma.goldItem.findMany({ where: gone, select: { ...pick, code: true, nameLo: true } }),
            this.prisma.cabinet.findMany({ where: gone, select: { ...pick, code: true, nameLo: true } }),
            this.prisma.partnerSource.findMany({ where: gone, select: { ...pick, code: true, nameLo: true } }),
            this.prisma.incomeExpenseCategory.findMany({ where: gone, select: { ...pick, code: true, nameLo: true } }),
            this.prisma.incomeExpenseTransaction.findMany({ where: gone, select: { ...pick, code: true, amount: true, currency: true } }),
            this.prisma.apArCashCategory.findMany({ where: gone, select: { ...pick, code: true, nameLo: true } }),
            this.prisma.consignment.findMany({ where: gone, select: { ...pick, code: true, totalWeightG: true } }),
            this.prisma.goldHandover.findMany({ where: gone, select: { ...pick, code: true, weightG: true } }),
            this.prisma.user.findMany({ where: gone, select: { ...pick, username: true, fullName: true } }),
            this.prisma.jewelryConversionFee.findMany({ where: gone, select: { ...pick, tierCode: true } }),
            this.prisma.barConversionFee.findMany({ where: gone, select: { ...pick, weightG: true } }),
            this.prisma.cashTransaction.findMany({ where: gone, select: { ...pick, amount: true, currency: true } }),
            this.prisma.bankTransaction.findMany({ where: gone, select: { ...pick, amount: true, currency: true } }),
        ]);
        const money = (v, currency = 'LAK') => `${v.toFixed(0)} ${currency}`;
        const rows = [
            ...buybacks.map((r) => ({ entity: 'Buyback', labelLo: 'Buyback', id: r.id, code: r.code, detail: money(r.payableAmount), deletedAt: r.deletedAt })),
            ...exchanges.map((r) => ({ entity: 'GoldExchange', labelLo: 'ປ່ຽນເປັນເງິນ', id: r.id, code: r.code, detail: money(r.totalPayable), deletedAt: r.deletedAt })),
            ...credits.map((r) => ({ entity: 'GoldCredit', labelLo: 'ສິນເຊື່ອ', id: r.id, code: r.code, detail: money(r.outstanding), deletedAt: r.deletedAt })),
            ...orders.map((r) => ({ entity: 'Order', labelLo: 'Order', id: r.id, code: r.code, detail: money(r.totalAmount), deletedAt: r.deletedAt })),
            ...movements.map((r) => ({ entity: 'StockMovement', labelLo: 'ລາຍການເຄື່ອນໄຫວສາງ', id: r.id, code: r.code, detail: `${r.totalGoldG.toFixed()} g`, deletedAt: r.deletedAt })),
            ...skus.map((r) => ({ entity: 'GoldSku', labelLo: 'SKU ນ້ຳໜັກຄຳ', id: r.id, code: r.code ?? '—', detail: r.fullSkuName, deletedAt: r.deletedAt })),
            ...goldTypes.map((r) => ({ entity: 'GoldType', labelLo: 'ປະເພດຄຳ', id: r.id, code: r.code, detail: r.nameLo, deletedAt: r.deletedAt })),
            ...goldItems.map((r) => ({ entity: 'GoldItem', labelLo: 'ລາຍການຄຳ', id: r.id, code: r.code, detail: r.nameLo, deletedAt: r.deletedAt })),
            ...cabinets.map((r) => ({ entity: 'Cabinet', labelLo: 'ຕູ້ເຄື່ອງ', id: r.id, code: r.code, detail: r.nameLo, deletedAt: r.deletedAt })),
            ...partners.map((r) => ({ entity: 'PartnerSource', labelLo: 'ແຫຼ່ງຮັບເຂົ້າ/ສົ່ງອອກ', id: r.id, code: r.code, detail: r.nameLo, deletedAt: r.deletedAt })),
            ...ieCategories.map((r) => ({ entity: 'IncomeExpenseCategory', labelLo: 'ລາຍການຮັບຈ່າຍ', id: r.id, code: r.code, detail: r.nameLo, deletedAt: r.deletedAt })),
            ...ieTransactions.map((r) => ({ entity: 'IncomeExpenseTransaction', labelLo: 'ທຸລະກຳ ຮັບ/ຈ່າຍ', id: r.id, code: r.code, detail: money(r.amount, r.currency), deletedAt: r.deletedAt })),
            ...aparCategories.map((r) => ({ entity: 'ApArCashCategory', labelLo: 'ລາຍການ AP-AR (Cash)', id: r.id, code: r.code, detail: r.nameLo, deletedAt: r.deletedAt })),
            ...consignments.map((r) => ({ entity: 'Consignment', labelLo: 'ຝາກສິນຄ້າ', id: r.id, code: r.code, detail: `${r.totalWeightG.toFixed()} g`, deletedAt: r.deletedAt })),
            ...handovers.map((r) => ({ entity: 'GoldHandover', labelLo: 'ມອບຄຳລະຫວ່າງມື້', id: r.id, code: r.code, detail: `${r.weightG.toFixed()} g`, deletedAt: r.deletedAt })),
            ...users.map((r) => ({ entity: 'User', labelLo: 'ຜູ້ໃຊ້ງານ', id: r.id, code: r.username, detail: r.fullName, deletedAt: r.deletedAt })),
            ...jewelryFees.map((r) => ({ entity: 'JewelryConversionFee', labelLo: 'ຄ່າປ່ຽນຮູບປະພັນ', id: r.id, code: r.tierCode, detail: '', deletedAt: r.deletedAt })),
            ...barFees.map((r) => ({ entity: 'BarConversionFee', labelLo: 'ຄ່າປ່ຽນຄຳແທ່ງ', id: r.id, code: `${r.weightG.toFixed()} g`, detail: '', deletedAt: r.deletedAt })),
            ...cashTxns.map((r) => ({ entity: 'CashTransaction', labelLo: 'ທຸລະກຳເງິນສົດ', id: r.id, code: '—', detail: money(r.amount, r.currency), deletedAt: r.deletedAt })),
            ...bankTxns.map((r) => ({ entity: 'BankTransaction', labelLo: 'ທຸລະກຳ Bank', id: r.id, code: '—', detail: money(r.amount, r.currency), deletedAt: r.deletedAt })),
        ];
        // ຜູ້ລຶບ — ຈາກ Audit Log ຂອງແຖວທີ່ກຳລັງສະແດງ.
        const logs = rows.length
            ? await this.prisma.auditLog.findMany({
                where: { action: 'DELETE', entityId: { in: rows.map((r) => r.id) } },
                orderBy: { createdAt: 'desc' },
                select: { entityId: true, actor: { select: { fullName: true } } },
            })
            : [];
        const deletedBy = new Map();
        for (const log of logs) {
            if (!log.entityId || deletedBy.has(log.entityId))
                continue;
            deletedBy.set(log.entityId, log.actor?.fullName ?? '—');
        }
        return rows
            .map((r) => ({ ...r, deletedBy: deletedBy.get(r.id) ?? '—' }))
            .sort((a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0));
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
    /** The system must keep at least one administrator who can still sign in. */
    async assertNotLastAdmin(excludingId) {
        const others = await this.prisma.user.count({
            where: { role: 'ADMIN', isActive: true, deletedAt: null, id: { not: excludingId } },
        });
        if (others === 0) {
            throw new common_1.BadRequestException('ບໍ່ສາມາດປິດການນຳໃຊ້ ຫຼື ລຶບ Admin ຄົນສຸດທ້າຍໄດ້');
        }
    }
    /**
     * ລຶບ = ປິດການນຳໃຊ້.
     *
     * A user id is stamped on every audit row, shift and transaction they ever
     * touched; removing the row would leave those unreadable. Soft-deleting
     * keeps the history intact and takes the account out of every picker.
     */
    async deleteUser(id, actor) {
        if (id === actor.id) {
            throw new common_1.BadRequestException('ລຶບບັນຊີຕົນເອງບໍ່ໄດ້');
        }
        const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
        if (!user)
            throw new common_1.NotFoundException('ບໍ່ພົບຜູ້ໃຊ້');
        if (user.role === 'ADMIN')
            await this.assertNotLastAdmin(id);
        const updated = await this.prisma.user.update({
            where: { id },
            data: { isActive: false, deletedAt: new Date() },
            select: { id: true, username: true, fullName: true, role: true, isActive: true },
        });
        // Signing them out now, rather than when their token happens to expire.
        await this.prisma.session.deleteMany({ where: { userId: id } });
        await this.audit.record({
            actorId: actor.id,
            action: 'DELETE',
            entity: 'User',
            entityId: id,
            before: user,
            after: updated,
            summary: `ລຶບຜູ້ໃຊ້ ${user.fullName} (${user.username})`,
        });
        return updated;
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