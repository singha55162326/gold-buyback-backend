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
exports.PricingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
/** Serialise a domain price board into the shape the web client renders. */
function presentBoard(board) {
    return {
        price1Baht: board.price1Baht.toFixed(),
        lines: board.lines.map((line) => {
            const meta = domain_1.TIER_META[line.tier];
            return {
                tierCode: line.tier,
                labelLo: meta?.labelLo ?? line.tier,
                category: meta?.category ?? null,
                displayWeightG: meta?.displayWeightG.toFixed() ?? null,
                exchangeWeightG: meta?.exchangeWeightG.toFixed() ?? null,
                sellPrice: line.sellPrice.toFixed(),
                buybackPrice: line.buybackPrice.toFixed(),
                steps: line.steps
                    ? {
                        a: line.steps.a.toFixed(),
                        b: line.steps.b.toFixed(),
                        c: line.steps.c.toFixed(),
                        d: line.steps.d.toFixed(),
                    }
                    : null,
            };
        }),
    };
}
let PricingService = class PricingService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    /**
     * Load the current §3.2 deduction rules — the newest row per tier.
     * Passing them into the engine is what makes ຫັກອອກ (%) tunable without
     * a code change.
     */
    async currentDeductions() {
        const rules = await this.prisma.buybackDeductionRule.findMany({
            orderBy: { effectiveAt: 'desc' },
        });
        const latest = {};
        for (const rule of rules) {
            if (latest[rule.tierCode])
                continue; // newest wins
            latest[rule.tierCode] = { kind: rule.kind, value: rule.value.toFixed() };
        }
        return latest;
    }
    parsePrice(raw) {
        const value = (0, domain_1.dec)(raw);
        if (!value.isFinite() || value.lte(0)) {
            throw new common_1.BadRequestException('ລາຄາຂາຍ 1 ບາດ ຕ້ອງໃຫຍ່ກວ່າ 0');
        }
        return value;
    }
    /**
     * Compute the full 11-row board WITHOUT saving. Backs the live preview on
     * the Set Pricing screen so the owner sees exactly what will be stored.
     */
    async preview(price1Baht) {
        const value = this.parsePrice(price1Baht);
        const deductions = await this.currentDeductions();
        return presentBoard((0, domain_1.buildPriceBoard)(value, { deductions }));
    }
    /** The current price board — the newest snapshot. */
    async current() {
        const snapshot = await this.prisma.priceSnapshot.findFirst({
            orderBy: { effectiveAt: 'desc' },
            include: { lines: { include: { tier: true } } },
        });
        if (!snapshot)
            throw new common_1.NotFoundException('ຍັງບໍ່ມີການຕັ້ງລາຄາ');
        return {
            id: snapshot.id,
            price1Baht: snapshot.price1Baht.toFixed(),
            effectiveAt: snapshot.effectiveAt,
            lines: snapshot.lines
                .sort((a, b) => a.tier.sortOrder - b.tier.sortOrder)
                .map((line) => ({
                tierCode: line.tierCode,
                labelLo: line.tier.labelLo,
                category: line.tier.category,
                displayWeightG: line.tier.displayWeightG.toFixed(),
                exchangeWeightG: line.tier.exchangeWeightG.toFixed(),
                sellPrice: line.sellPrice.toFixed(),
                buybackPrice: line.buybackPrice.toFixed(),
                steps: line.steps,
            })),
        };
    }
    /**
     * TOR §3.1 "Set Pricing".
     *
     * The board is recomputed server-side rather than trusting the numbers the
     * browser previewed, then written as a NEW snapshot. Snapshots are never
     * updated in place, so a transaction priced yesterday keeps yesterday's
     * numbers forever.
     */
    async setPricing(dto, actorId) {
        const price1Baht = this.parsePrice(dto.price1Baht);
        const deductions = await this.currentDeductions();
        const board = (0, domain_1.buildPriceBoard)(price1Baht, { deductions });
        const snapshot = await this.prisma.$transaction(async (tx) => {
            const created = await tx.priceSnapshot.create({
                data: {
                    price1Baht: new client_1.Prisma.Decimal(board.price1Baht.toFixed()),
                    note: dto.note ?? null,
                    createdById: actorId,
                    lines: {
                        create: board.lines.map((line) => ({
                            tierCode: line.tier,
                            sellPrice: new client_1.Prisma.Decimal(line.sellPrice.toFixed()),
                            buybackPrice: new client_1.Prisma.Decimal(line.buybackPrice.toFixed()),
                            steps: line.steps
                                ? {
                                    a: line.steps.a.toFixed(),
                                    b: line.steps.b.toFixed(),
                                    c: line.steps.c.toFixed(),
                                    d: line.steps.d.toFixed(),
                                }
                                : client_1.Prisma.JsonNull,
                        })),
                    },
                },
                include: { lines: true },
            });
            await this.audit.record({
                actorId,
                action: 'CREATE',
                entity: 'PriceSnapshot',
                entityId: created.id,
                after: { price1Baht: created.price1Baht.toFixed() },
                summary: `ຕັ້ງລາຄາຂາຍ 1 ບາດ = ${created.price1Baht.toFixed(0)}`,
            }, tx);
            return created;
        });
        return { id: snapshot.id, ...presentBoard(board) };
    }
    /** History Products — TOR §3.1 specifies 30 rows. */
    async history(limit = 30) {
        const rows = await this.prisma.priceSnapshot.findMany({
            orderBy: { effectiveAt: 'desc' },
            take: Math.min(limit, 200),
        });
        const users = await this.prisma.user.findMany({
            where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
            select: { id: true, fullName: true },
        });
        const nameById = new Map(users.map((u) => [u.id, u.fullName]));
        return rows.map((row) => ({
            id: row.id,
            date: row.effectiveAt,
            price1Baht: row.price1Baht.toFixed(),
            updatedBy: nameById.get(row.createdById) ?? '—',
            note: row.note,
        }));
    }
};
exports.PricingService = PricingService;
exports.PricingService = PricingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PricingService);
//# sourceMappingURL=pricing.service.js.map