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
exports.FeesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
const pricing_service_1 = require("../pricing/pricing.service");
/**
 * The fee tables of TOR §3.2 and §3.4.
 *
 * Every one of them is append-only and versioned by `effectiveAt`. Reading
 * the "current" value therefore means taking the newest row per key, and a
 * price quoted last month can still be reproduced exactly.
 */
let FeesService = class FeesService {
    prisma;
    audit;
    pricing;
    constructor(prisma, audit, pricing) {
        this.prisma = prisma;
        this.audit = audit;
        this.pricing = pricing;
    }
    toDecimal(raw, label, allowZero = true) {
        const value = (0, domain_1.dec)(raw);
        if (!value.isFinite() || value.isNegative() || (!allowZero && value.isZero())) {
            throw new common_1.BadRequestException(`${label} ບໍ່ຖືກຕ້ອງ`);
        }
        return new client_1.Prisma.Decimal(value.toFixed());
    }
    /**
     * Attach the editor's display name to history rows. One query for the whole
     * page rather than an include per row, which would fan out to a join on
     * every version of every weight.
     */
    async withEditorNames(rows) {
        const users = await this.prisma.user.findMany({
            where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
            select: { id: true, fullName: true },
        });
        const nameById = new Map(users.map((u) => [u.id, u.fullName]));
        return rows.map((r) => ({ ...r, updatedBy: nameById.get(r.createdById) ?? '—' }));
    }
    /** Keep only the newest row per key from an append-only table. */
    newestPerKey(rows, key) {
        const seen = new Set();
        const out = [];
        for (const row of rows) {
            const k = key(row);
            if (seen.has(k))
                continue;
            seen.add(k);
            out.push(row);
        }
        return out;
    }
    // --- §3.4 ຄ່າປ່ຽນຮູບປະພັນ --------------------------------------------------
    async currentJewelryFees() {
        const rows = await this.prisma.jewelryConversionFee.findMany({
            orderBy: { effectiveAt: 'desc' },
            include: { tier: true },
        });
        // Retiring a tier appends a tombstone rather than deleting rows, so the
        // newest version has to be inspected before it counts as current.
        return this.newestPerKey(rows, (r) => r.tierCode)
            .filter((r) => r.deletedAt === null)
            .sort((a, b) => a.tier.sortOrder - b.tier.sortOrder);
    }
    async jewelryFeeHistory(limit = 60) {
        const rows = await this.prisma.jewelryConversionFee.findMany({
            orderBy: { effectiveAt: 'desc' },
            include: { tier: true },
            take: Math.min(limit, 500),
        });
        return this.withEditorNames(rows);
    }
    /**
     * Retire a tier's fee. The exchange engine falls back to 0 for a weight it
     * cannot find a fee for, so this silently zeroes ຄ່າຫຍຸບ for that tier —
     * which is why the UI asks for confirmation rather than offering a plain
     * delete button.
     */
    async deleteJewelryFee(tierCode, actorId) {
        const rows = await this.prisma.jewelryConversionFee.findMany({
            where: { tierCode },
            orderBy: { effectiveAt: 'desc' },
            include: { tier: true },
            take: 1,
        });
        const newest = rows[0];
        if (!newest || newest.deletedAt !== null) {
            throw new common_1.NotFoundException('ບໍ່ພົບຄ່າປ່ຽນຂອງນ້ຳໜັກນີ້');
        }
        const created = await this.prisma.jewelryConversionFee.create({
            data: {
                tierCode: newest.tierCode,
                weightG: newest.weightG,
                feeGoodShape: newest.feeGoodShape,
                feeDamagedShape: newest.feeDamagedShape,
                createdById: actorId,
                deletedAt: new Date(),
            },
        });
        await this.audit.record({
            actorId, action: 'DELETE', entity: 'JewelryConversionFee', entityId: created.id,
            before: newest, after: created,
            summary: `ລຶບຄ່າປ່ຽນຮູບປະພັນ ${newest.tier.labelLo}`,
        });
        return created;
    }
    async upsertJewelryFee(dto, actorId) {
        const tier = await this.prisma.weightTier.findUnique({ where: { code: dto.tierCode } });
        if (!tier)
            throw new common_1.NotFoundException('ບໍ່ພົບນ້ຳໜັກ SKU ທີ່ເລືອກ');
        const created = await this.prisma.jewelryConversionFee.create({
            data: {
                tierCode: dto.tierCode,
                weightG: this.toDecimal(dto.weightG, 'ນ້ຳໜັກ', false),
                feeGoodShape: this.toDecimal(dto.feeGoodShape, 'ຄ່າປ່ຽນຮູບປະພັນດີ'),
                feeDamagedShape: this.toDecimal(dto.feeDamagedShape, 'ຄ່າປ່ຽນເສຍຮູບ'),
                createdById: actorId,
            },
        });
        await this.audit.record({
            actorId, action: 'UPDATE', entity: 'JewelryConversionFee', entityId: created.id,
            after: created, summary: `ອັບເດດຄ່າປ່ຽນຮູບປະພັນ ${tier.labelLo}`,
        });
        return created;
    }
    // --- §3.4 ຄ່າປ່ຽນຄຳແທ່ງ ---------------------------------------------------
    async currentBarFees() {
        const rows = await this.prisma.barConversionFee.findMany({ orderBy: { effectiveAt: 'desc' } });
        return this.newestPerKey(rows, (r) => r.weightG.toFixed())
            .filter((r) => r.deletedAt === null)
            .sort((a, b) => Number(b.weightG) - Number(a.weightG));
    }
    async barFeeHistory(limit = 60) {
        const rows = await this.prisma.barConversionFee.findMany({
            orderBy: { effectiveAt: 'desc' },
            take: Math.min(limit, 500),
        });
        return this.withEditorNames(rows);
    }
    /** Retire a bar weight. See deleteJewelryFee — same tombstone, same caveat. */
    async deleteBarFee(weightG, actorId) {
        const weight = this.toDecimal(weightG, 'ນ້ຳໜັກ', false);
        const rows = await this.prisma.barConversionFee.findMany({
            where: { weightG: weight },
            orderBy: { effectiveAt: 'desc' },
            take: 1,
        });
        const newest = rows[0];
        if (!newest || newest.deletedAt !== null) {
            throw new common_1.NotFoundException('ບໍ່ພົບຄ່າປ່ຽນຂອງນ້ຳໜັກນີ້');
        }
        const created = await this.prisma.barConversionFee.create({
            data: {
                weightG: newest.weightG,
                barToJewelry: newest.barToJewelry,
                barToBar: newest.barToBar,
                createdById: actorId,
                deletedAt: new Date(),
            },
        });
        await this.audit.record({
            actorId, action: 'DELETE', entity: 'BarConversionFee', entityId: created.id,
            before: newest, after: created,
            summary: `ລຶບຄ່າປ່ຽນຄຳແທ່ງ ${newest.weightG.toFixed()} g`,
        });
        return created;
    }
    async upsertBarFee(dto, actorId) {
        const created = await this.prisma.barConversionFee.create({
            data: {
                weightG: this.toDecimal(dto.weightG, 'ນ້ຳໜັກ', false),
                barToJewelry: this.toDecimal(dto.barToJewelry, 'ຄຳແທ່ງ-ຮູບປະພັນ'),
                barToBar: this.toDecimal(dto.barToBar, 'ຄຳແທ່ງ-ຄຳແທ່ງ'),
                createdById: actorId,
            },
        });
        await this.audit.record({
            actorId, action: 'UPDATE', entity: 'BarConversionFee', entityId: created.id,
            after: created, summary: `ອັບເດດຄ່າປ່ຽນຄຳແທ່ງ ${created.weightG.toFixed()} g`,
        });
        return created;
    }
    // --- §3.4 ຄ່າອ່ອນ ---------------------------------------------------------
    async currentSoftGoldFee() {
        const row = await this.prisma.softGoldFeeSnapshot.findFirst({
            orderBy: { effectiveAt: 'desc' },
        });
        if (!row)
            throw new common_1.NotFoundException('ຍັງບໍ່ມີການຕັ້ງຄ່າອ່ອນ');
        return row;
    }
    async updateSoftGoldFee(dto, actorId) {
        const created = await this.prisma.softGoldFeeSnapshot.create({
            data: { value: this.toDecimal(dto.value, 'ຄ່າຄຳອ່ອນ'), createdById: actorId },
        });
        await this.audit.record({
            actorId, action: 'UPDATE', entity: 'SoftGoldFeeSnapshot', entityId: created.id,
            after: created, summary: `ອັບເດດຄ່າອ່ອນ = ${created.value.toFixed(0)}`,
        });
        return created;
    }
    async softGoldFeeHistory(limit = 30) {
        const rows = await this.prisma.softGoldFeeSnapshot.findMany({
            orderBy: { effectiveAt: 'desc' },
            take: Math.min(limit, 200),
        });
        const users = await this.prisma.user.findMany({
            where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
            select: { id: true, fullName: true },
        });
        const nameById = new Map(users.map((u) => [u.id, u.fullName]));
        return rows.map((r) => ({ ...r, updatedBy: nameById.get(r.createdById) ?? '—' }));
    }
    // --- §3.2 ຫັກອອກ (%) / ລາຄາລົບອອກ -----------------------------------------
    async currentDeductions() {
        const rows = await this.prisma.buybackDeductionRule.findMany({
            orderBy: { effectiveAt: 'desc' },
            include: { tier: true },
        });
        return this.newestPerKey(rows, (r) => r.tierCode).sort((a, b) => a.tier.sortOrder - b.tier.sortOrder);
    }
    async updateDeduction(dto, actorId) {
        const tier = await this.prisma.weightTier.findUnique({ where: { code: dto.tierCode } });
        if (!tier)
            throw new common_1.NotFoundException('ບໍ່ພົບນ້ຳໜັກ SKU ທີ່ເລືອກ');
        const value = (0, domain_1.dec)(dto.value);
        if (dto.kind === 'PERCENT' && (value.lt(0) || value.gte(100))) {
            throw new common_1.BadRequestException('ຫັກອອກ (%) ຕ້ອງຢູ່ລະຫວ່າງ 0 ຫາ 100');
        }
        const created = await this.prisma.buybackDeductionRule.create({
            data: {
                tierCode: dto.tierCode,
                kind: dto.kind,
                value: this.toDecimal(dto.value, 'ຄ່າຫັກ'),
                createdById: actorId,
            },
        });
        await this.audit.record({
            actorId, action: 'UPDATE', entity: 'BuybackDeductionRule', entityId: created.id,
            after: created,
            summary: `ອັບເດດຄ່າຫັກຊື້ຄືນ ${tier.labelLo}`,
        });
        /*
         * Re-price immediately.
         *
         * ລາຄາຊື້ຄືນ is derived from this rule, but it is READ from a price
         * snapshot — so changing the rule used to leave every quoted buyback
         * price on the old figure until someone retyped the gold price. The
         * shop would have edited the rule, seen ຈັດການ Products unchanged, and
         * reasonably concluded the edit had not saved.
         *
         * Both tables are append-only, so this keeps BOTH histories: the rule
         * change is its own row, and the re-priced board is a new snapshot
         * beside the old ones. Nothing is overwritten and every past quote can
         * still be re-derived from the snapshot that was current at the time.
         */
        const board = await this.pricing.recalculate(actorId);
        return { ...created, board };
    }
};
exports.FeesService = FeesService;
exports.FeesService = FeesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        pricing_service_1.PricingService])
], FeesService);
//# sourceMappingURL=fees.service.js.map