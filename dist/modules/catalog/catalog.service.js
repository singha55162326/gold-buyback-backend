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
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
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
        const created = await this.prisma.goldType.create({
            data: {
                code: data.code.trim().toUpperCase(),
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
        const created = await this.prisma.goldItem.create({
            data: {
                code: data.code.trim().toUpperCase(),
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
        const created = await this.prisma.cabinet.create({
            data: { code: data.code.trim().toUpperCase(), nameLo: data.nameLo.trim() },
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
    async cabinetContents(id) {
        const cabinet = await this.prisma.cabinet.findFirst({ where: { id, deletedAt: null } });
        if (!cabinet)
            throw new common_1.NotFoundException('ບໍ່ພົບຕູ້ເຄື່ອງ');
        const lines = await this.prisma.exchangeNewLine.findMany({
            where: { cabinetId: id },
            include: { goldSku: true },
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
        const created = await this.prisma.partnerSource.create({
            data: {
                code: data.code.trim().toUpperCase(),
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
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map