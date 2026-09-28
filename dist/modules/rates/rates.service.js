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
exports.RatesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
/**
 * TOR §3.3 — Price Rate (ອັດຕາແລກປ່ຽນ).
 *
 * Sell rates apply when the shop TAKES foreign currency IN (Order, Credit);
 * buyback rates apply when it PAYS foreign currency OUT (Buyback, Exchange).
 * Snapshots are append-only so every transaction can point at the rate that
 * was live when it happened.
 */
let RatesService = class RatesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async current() {
        const snapshot = await this.prisma.exchangeRateSnapshot.findFirst({
            orderBy: { effectiveAt: 'desc' },
        });
        if (!snapshot)
            throw new common_1.NotFoundException('ຍັງບໍ່ມີການຕັ້ງອັດຕາແລກປ່ຽນ');
        return snapshot;
    }
    async update(dto, actorId) {
        /*
         * TOR §3.3 — THB and USD rates are quoted to two decimals. Quantising on
         * the way in keeps the stored figure identical to the one on screen: a
         * third decimal accepted here would be invisible in every report yet still
         * move the LAK conversions in Wealth and COH.
         */
        const toRate = (raw) => (0, domain_1.round)((0, domain_1.dec)(raw), domain_1.RATE_DECIMALS);
        const values = {
            thbSellRate: toRate(dto.thbSellRate),
            usdSellRate: toRate(dto.usdSellRate),
            thbBuybackRate: toRate(dto.thbBuybackRate),
            usdBuybackRate: toRate(dto.usdBuybackRate),
        };
        for (const [key, value] of Object.entries(values)) {
            if (!value.isFinite() || value.lte(0)) {
                throw new common_1.BadRequestException(`${key} ຕ້ອງໃຫຍ່ກວ່າ 0`);
            }
        }
        const created = await this.prisma.exchangeRateSnapshot.create({
            data: {
                thbSellRate: new client_1.Prisma.Decimal(values.thbSellRate.toFixed()),
                usdSellRate: new client_1.Prisma.Decimal(values.usdSellRate.toFixed()),
                thbBuybackRate: new client_1.Prisma.Decimal(values.thbBuybackRate.toFixed()),
                usdBuybackRate: new client_1.Prisma.Decimal(values.usdBuybackRate.toFixed()),
                createdById: actorId,
            },
        });
        await this.audit.record({
            actorId,
            action: 'CREATE',
            entity: 'ExchangeRateSnapshot',
            entityId: created.id,
            after: created,
            summary: 'ອັບເດດ Price Rate',
        });
        return created;
    }
    /** History Price Rate Table — 30 rows (TOR §3.3). */
    async history(limit = 30) {
        const rows = await this.prisma.exchangeRateSnapshot.findMany({
            orderBy: { effectiveAt: 'desc' },
            take: Math.min(limit, 200),
        });
        const users = await this.prisma.user.findMany({
            where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
            select: { id: true, fullName: true },
        });
        const nameById = new Map(users.map((u) => [u.id, u.fullName]));
        return rows.map((row) => ({ ...row, updatedBy: nameById.get(row.createdById) ?? '—' }));
    }
    /**
     * Monthly series for the two history charts in §3.3. Each month reports the
     * last rate set in that month, which is what the shop treats as that month's
     * closing rate.
     */
    async monthlySeries(months = 12) {
        const since = new Date();
        since.setMonth(since.getMonth() - months);
        const rows = await this.prisma.exchangeRateSnapshot.findMany({
            where: { effectiveAt: { gte: since } },
            orderBy: { effectiveAt: 'asc' },
        });
        const byMonth = new Map();
        for (const row of rows) {
            const key = `${row.effectiveAt.getFullYear()}-${String(row.effectiveAt.getMonth() + 1).padStart(2, '0')}`;
            byMonth.set(key, row); // later rows overwrite, leaving the month's last
        }
        return [...byMonth.entries()].map(([month, row]) => ({
            month,
            thbSell: row.thbSellRate.toFixed(),
            thbBuyback: row.thbBuybackRate.toFixed(),
            usdSell: row.usdSellRate.toFixed(),
            usdBuyback: row.usdBuybackRate.toFixed(),
        }));
    }
};
exports.RatesService = RatesService;
exports.RatesService = RatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RatesService);
//# sourceMappingURL=rates.service.js.map