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
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
const code_generator_service_1 = require("../../common/services/code-generator.service");
/**
 * Simple reference data shared across the whole system:
 * ປະເພດຄຳ (§3.5), ລາຍການຄຳ (§3.5), ຕູ້ເຄື່ອງ (§3.7),
 * ແຫຼ່ງຮັບເຂົ້າ/ສົ່ງອອກ (§3.7) and bank accounts.
 *
 * All five behave identically — list, create, rename, soft-delete — so they
 * share one service rather than five near-copies.
 */
let CatalogService = class CatalogService {
    prisma;
    audit;
    codes;
    constructor(prisma, audit, codes) {
        this.prisma = prisma;
        this.audit = audit;
        this.codes = codes;
    }
    /**
     * Refuse a delete that would orphan history.
     *
     * Reference data is pointed at by ledgers and receipts that must stay
     * readable years later, so "ລົບ" here means retiring a row nothing has
     * used yet. Anything already in use is deactivated instead, which keeps it
     * out of the pickers without breaking the rows that name it.
     */
    async assertUnused(labelLo, counts) {
        const used = [];
        for (const [what, pending] of counts) {
            if ((await pending) > 0)
                used.push(what);
        }
        if (used.length > 0) {
            throw new common_1.BadRequestException(`ລຶບ${labelLo}ນີ້ບໍ່ໄດ້ — ຖືກໃຊ້ຢູ່ໃນ ${used.join(', ')}. ປິດການນຳໃຊ້ແທນ.`);
        }
    }
    // --- ປະເພດຄຳ -------------------------------------------------------------
    listGoldTypes(stockOnly = false) {
        return this.prisma.goldType.findMany({
            where: { deletedAt: null, isActive: true, ...(stockOnly ? { isStockType: true } : {}) },
            orderBy: { sortOrder: 'asc' },
        });
    }
    async createGoldType(data, actorId) {
        const max = await this.prisma.goldType.aggregate({ _max: { sortOrder: true } });
        const code = await this.codes.nextFor('GOLD_TYPE', this.prisma.goldType);
        const created = await this.prisma.goldType.create({
            data: {
                code,
                nameLo: data.nameLo.trim(),
                isStockType: data.isStockType ?? false,
                sortOrder: (max._max.sortOrder ?? 0) + 1,
            },
        });
        await this.audit.record({
            actorId, action: 'CREATE', entity: 'GoldType', entityId: created.id,
            after: created, summary: `ເພີ່ມປະເພດຄຳ ${created.nameLo}`,
        });
        return created;
    }
    // --- ລາຍການຄຳ -----------------------------------------------------------
    listGoldItems() {
        return this.prisma.goldItem.findMany({
            where: { deletedAt: null, isActive: true },
            orderBy: { sortOrder: 'asc' },
        });
    }
    async createGoldItem(data, actorId) {
        const max = await this.prisma.goldItem.aggregate({ _max: { sortOrder: true } });
        const code = await this.codes.nextFor('GOLD_ITEM', this.prisma.goldItem);
        const created = await this.prisma.goldItem.create({
            data: {
                code,
                nameLo: data.nameLo.trim(),
                sortOrder: (max._max.sortOrder ?? 0) + 1,
            },
        });
        await this.audit.record({
            actorId, action: 'CREATE', entity: 'GoldItem', entityId: created.id,
            after: created, summary: `ເພີ່ມລາຍການຄຳ ${created.nameLo}`,
        });
        return created;
    }
    // --- ຕູ້ເຄື່ອງ -------------------------------------------------------------
    listCabinets() {
        return this.prisma.cabinet.findMany({
            where: { deletedAt: null, isActive: true },
            orderBy: { code: 'asc' },
        });
    }
    async createCabinet(data, actorId) {
        const code = await this.codes.nextFor('CABINET', this.prisma.cabinet);
        const created = await this.prisma.cabinet.create({
            data: { code, nameLo: data.nameLo.trim() },
        });
        await this.audit.record({
            actorId, action: 'CREATE', entity: 'Cabinet', entityId: created.id,
            after: created, summary: `ເພີ່ມຕູ້ເຄື່ອງ ${created.nameLo}`,
        });
        return created;
    }
    /**
     * ຕູ້ເຄື່ອງ detail — the View button lists the gold currently assigned to a
     * cabinet with its total weight (TOR §3.7).
     */
    /**
     * ລາຍການຄຳໃນຕູ້ເຄື່ອງ.
     *
     * range ກອງຕາມວັນທີທີ່ຄຳເຂົ້າຕູ້ (ວັນທີຂອງລາຍການປ່ຽນ). ຕ້ອງເປັນທາງເລືອກ
     * ບໍ່ແມ່ນຄ່າເລີ່ມຕົ້ນ: ການກວດກ່ອນລຶບຕູ້ ຕ້ອງເຫັນຄຳທັງໝົດ ບໍ່ແມ່ນສະເພາະມື້ນີ້
     * — ບໍ່ດັ່ງນັ້ນ ຕູ້ທີ່ມີຄຳເກົ່າຢູ່ ຈະຖືກລຶບໄດ້.
     */
    async cabinetContents(id, range) {
        const cabinet = await this.prisma.cabinet.findFirst({ where: { id, deletedAt: null } });
        if (!cabinet)
            throw new common_1.NotFoundException('ບໍ່ພົບຕູ້ເຄື່ອງ');
        const lines = await this.prisma.exchangeNewLine.findMany({
            where: {
                cabinetId: id,
                ...(range ? { exchange: { createdAt: range } } : {}),
            },
            include: { goldSku: true, exchange: { select: { code: true, createdAt: true } } },
            orderBy: { exchange: { createdAt: 'desc' } },
        });
        const totalWeightG = lines.reduce((sum, l) => sum + Number(l.weightG) * l.quantity, 0);
        return { cabinet, lines, totalWeightG: totalWeightG.toFixed(4) };
    }
    // --- ແຫຼ່ງຮັບເຂົ້າ / ແຫຼ່ງສົ່ງອອກ -------------------------------------------
    listPartners(direction) {
        return this.prisma.partnerSource.findMany({
            where: {
                deletedAt: null,
                isActive: true,
                ...(direction ? { direction: { in: [direction, 'BOTH'] } } : {}),
            },
            orderBy: { sortOrder: 'asc' },
        });
    }
    async createPartner(data, actorId) {
        const max = await this.prisma.partnerSource.aggregate({ _max: { sortOrder: true } });
        const code = await this.codes.nextFor('PARTNER', this.prisma.partnerSource);
        const created = await this.prisma.partnerSource.create({
            data: {
                code,
                nameLo: data.nameLo.trim(),
                direction: data.direction,
                tracksGoldApAr: data.tracksGoldApAr ?? false,
                sortOrder: (max._max.sortOrder ?? 0) + 1,
            },
        });
        await this.audit.record({
            actorId, action: 'CREATE', entity: 'PartnerSource', entityId: created.id,
            after: created, summary: `ເພີ່ມແຫຼ່ງ ${created.nameLo}`,
        });
        return created;
    }
    // --- ທະນາຄານ -------------------------------------------------------------
    listBankAccounts() {
        return this.prisma.bankAccount.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
        });
    }
    // --- ແກ້ໄຂ / ລຶບ ----------------------------------------------------------
    async updateGoldType(id, data, actorId) {
        const before = await this.prisma.goldType.findFirst({ where: { id, deletedAt: null } });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບປະເພດຄຳ');
        const after = await this.prisma.goldType.update({
            where: { id },
            data: {
                ...(data.nameLo !== undefined ? { nameLo: data.nameLo.trim() } : {}),
                ...(data.isStockType !== undefined ? { isStockType: data.isStockType } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            },
        });
        await this.audit.record({
            actorId, action: 'UPDATE', entity: 'GoldType', entityId: id,
            before, after, summary: `ແກ້ໄຂປະເພດຄຳ ${after.nameLo}`,
        });
        return after;
    }
    async deleteGoldType(id, actorId) {
        const before = await this.prisma.goldType.findFirst({ where: { id, deletedAt: null } });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບປະເພດຄຳ');
        await this.assertUnused('ປະເພດຄຳ', [
            ['Buyback', this.prisma.buyback.count({ where: { goldTypeId: id } })],
            ['ລາຍການປ່ຽນ', this.prisma.exchangeOldLine.count({ where: { goldTypeId: id } })],
            ['Stock (OLD)', this.prisma.stockOldLedger.count({ where: { goldTypeId: id } })],
            ['ມອບຄຳ', this.prisma.goldHandover.count({ where: { goldTypeId: id } })],
            ['ລາຍການເຄື່ອນໄຫວສາງ', this.prisma.stockMovementLine.count({ where: { goldTypeId: id } })],
        ]);
        const after = await this.prisma.goldType.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        await this.audit.record({
            actorId, action: 'DELETE', entity: 'GoldType', entityId: id,
            before, after, summary: `ລຶບປະເພດຄຳ ${before.nameLo}`,
        });
        return after;
    }
    async updateGoldItem(id, data, actorId) {
        const before = await this.prisma.goldItem.findFirst({ where: { id, deletedAt: null } });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການຄຳ');
        const after = await this.prisma.goldItem.update({
            where: { id },
            data: {
                ...(data.nameLo !== undefined ? { nameLo: data.nameLo.trim() } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            },
        });
        await this.audit.record({
            actorId, action: 'UPDATE', entity: 'GoldItem', entityId: id,
            before, after, summary: `ແກ້ໄຂລາຍການຄຳ ${after.nameLo}`,
        });
        return after;
    }
    async deleteGoldItem(id, actorId) {
        const before = await this.prisma.goldItem.findFirst({ where: { id, deletedAt: null } });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການຄຳ');
        await this.assertUnused('ລາຍການຄຳ', [
            ['SKU', this.prisma.goldSku.count({ where: { goldItemId: id, deletedAt: null } })],
            ['Buyback', this.prisma.buyback.count({ where: { goldItemId: id } })],
            ['ລາຍການປ່ຽນ', this.prisma.exchangeOldLine.count({ where: { goldItemId: id } })],
            ['ສິນເຊື່ອ', this.prisma.goldCredit.count({ where: { goldItemId: id } })],
            ['Order', this.prisma.order.count({ where: { goldItemId: id } })],
        ]);
        const after = await this.prisma.goldItem.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        await this.audit.record({
            actorId, action: 'DELETE', entity: 'GoldItem', entityId: id,
            before, after, summary: `ລຶບລາຍການຄຳ ${before.nameLo}`,
        });
        return after;
    }
    async updateCabinet(id, data, actorId) {
        const before = await this.prisma.cabinet.findFirst({ where: { id, deletedAt: null } });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບຕູ້ເຄື່ອງ');
        const after = await this.prisma.cabinet.update({
            where: { id },
            data: {
                ...(data.nameLo !== undefined ? { nameLo: data.nameLo.trim() } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            },
        });
        await this.audit.record({
            actorId, action: 'UPDATE', entity: 'Cabinet', entityId: id,
            before, after, summary: `ແກ້ໄຂຕູ້ເຄື່ອງ ${after.nameLo}`,
        });
        return after;
    }
    /** ຫ້າມລົບຕູ້ທີ່ຍັງມີສິນຄ້າ. */
    async deleteCabinet(id, actorId) {
        const before = await this.prisma.cabinet.findFirst({ where: { id, deletedAt: null } });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບຕູ້ເຄື່ອງ');
        const contents = await this.cabinetContents(id);
        if (Number(contents.totalWeightG) > 0) {
            throw new common_1.BadRequestException(`ລຶບຕູ້ນີ້ບໍ່ໄດ້ — ຍັງມີຄຳຢູ່ ${contents.totalWeightG} g. ຍ້າຍຄຳອອກກ່ອນ.`);
        }
        await this.assertUnused('ຕູ້ເຄື່ອງ', [
            ['ສິນເຊື່ອ', this.prisma.goldCredit.count({ where: { cabinetId: id } })],
            ['ລາຍການເຄື່ອນໄຫວສາງ', this.prisma.stockMovement.count({ where: { cabinetId: id } })],
        ]);
        const after = await this.prisma.cabinet.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        await this.audit.record({
            actorId, action: 'DELETE', entity: 'Cabinet', entityId: id,
            before, after, summary: `ລຶບຕູ້ເຄື່ອງ ${before.nameLo}`,
        });
        return after;
    }
    async updatePartner(id, data, actorId) {
        const before = await this.prisma.partnerSource.findFirst({ where: { id, deletedAt: null } });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບແຫຼ່ງຮັບເຂົ້າ/ສົ່ງອອກ');
        const after = await this.prisma.partnerSource.update({
            where: { id },
            data: {
                ...(data.nameLo !== undefined ? { nameLo: data.nameLo.trim() } : {}),
                ...(data.direction !== undefined ? { direction: data.direction } : {}),
                ...(data.tracksGoldApAr !== undefined ? { tracksGoldApAr: data.tracksGoldApAr } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            },
        });
        await this.audit.record({
            actorId, action: 'UPDATE', entity: 'PartnerSource', entityId: id,
            before, after, summary: `ແກ້ໄຂແຫຼ່ງ ${after.nameLo}`,
        });
        return after;
    }
    async deletePartner(id, actorId) {
        const before = await this.prisma.partnerSource.findFirst({ where: { id, deletedAt: null } });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບແຫຼ່ງຮັບເຂົ້າ/ສົ່ງອອກ');
        await this.assertUnused('ແຫຼ່ງນີ້', [
            ['ລາຍການເຄື່ອນໄຫວສາງ', this.prisma.stockMovement.count({ where: { partnerId: id } })],
            ['AP/AR (ຄຳ)', this.prisma.goldApArLedger.count({ where: { partnerId: id } })],
            ['AP/AR (ເງິນ)', this.prisma.cashApArLedger.count({ where: { partnerId: id } })],
            ['ຕິດຕາມ FACTORY', this.prisma.factoryOutTracking.count({ where: { partnerId: id } })],
            ['Order', this.prisma.order.count({ where: { supplierId: id } })],
            ['ກົດການລົງບັນຊີ', this.prisma.goldApArPostingRule.count({ where: { partnerId: id } })],
        ]);
        const after = await this.prisma.partnerSource.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        await this.audit.record({
            actorId, action: 'DELETE', entity: 'PartnerSource', entityId: id,
            before, after, summary: `ລຶບແຫຼ່ງ ${before.nameLo}`,
        });
        return after;
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        code_generator_service_1.CodeGeneratorService])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map