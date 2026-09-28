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
exports.ApArPostingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const business_day_service_1 = require("./business-day.service");
const D = (value) => new client_1.Prisma.Decimal(value.toFixed());
const toDec = (value) => (0, domain_1.dec)(value?.toFixed() ?? 0);
/** Maps a domain posting reason onto the persisted ApArRefType enum. */
const REF_TYPE = {
    LABOR_PAYABLE: 'LABOR_PAYABLE',
    LABOR_PAYMENT: 'LABOR_PAYMENT',
    CREDIT_ISSUED: 'CREDIT_ISSUED',
    CREDIT_RECEIPT: 'CREDIT_RECEIPT',
    MANUAL_AP: 'ADJUSTMENT',
    MANUAL_AP_PAYMENT: 'ADJUSTMENT',
    MANUAL_AR: 'ADJUSTMENT',
    MANUAL_AR_RECEIPT: 'ADJUSTMENT',
    ADJUSTMENT: 'ADJUSTMENT',
};
/**
 * Writes into the two AP/AR sub-ledgers (TOR §8, §9).
 *
 * Both ledgers accumulate exactly like the stock ledgers — each row carries
 * the running balance after it — so a History table renders without
 * recomputation and a balance can be explained row by row.
 *
 * Every method takes a transaction client: an AP/AR posting is only ever
 * valid as part of the transaction that caused it.
 */
let ApArPostingService = class ApArPostingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /* ---------------------------------------------------------------- *
     * §9 — AP/AR (Cash)
     * ---------------------------------------------------------------- */
    /**
     * Post one cash-side movement. The direction (AP vs AR, increase vs
     * decrease) comes from the domain posting table, so no caller has to
     * remember which way round a given event goes.
     */
    async postCash(tx, input) {
        if (input.amount.lte(0))
            return null;
        const posting = (0, domain_1.buildCashPosting)(input.reason, input.currency, input.amount);
        const businessDate = business_day_service_1.BusinessDayService.toDateOnly();
        const previous = await tx.cashApArLedger.findFirst({
            where: {
                side: posting.side,
                currency: input.currency,
                ...(input.partnerId ? { partnerId: input.partnerId } : {}),
                deletedAt: null,
            },
            orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
        });
        const lastToday = await tx.cashApArLedger.findFirst({
            where: { side: posting.side, currency: input.currency, businessDate },
            orderBy: { sequence: 'desc' },
        });
        const balance = toDec(previous?.balance)
            .plus(posting.amountIn)
            .minus(posting.amountOut);
        return tx.cashApArLedger.create({
            data: {
                side: posting.side,
                refType: REF_TYPE[input.reason],
                refId: input.refId ?? null,
                partnerId: input.partnerId ?? null,
                categoryId: input.categoryId ?? null,
                businessDate,
                currency: input.currency,
                amountIn: D(posting.amountIn),
                amountOut: D(posting.amountOut),
                balance: D(balance),
                sequence: (lastToday?.sequence ?? 0) + 1,
                note: input.note ?? null,
                createdById: input.createdById,
            },
        });
    }
    /* ---------------------------------------------------------------- *
     * §8 — AP/AR (GOLD)
     * ---------------------------------------------------------------- */
    /** The Admin-editable posting rules, loaded as the domain shape. */
    async loadGoldRules(client = this.prisma) {
        const rows = await client.goldApArPostingRule.findMany({
            where: { isActive: true },
            include: { partner: true, counterparty: true },
        });
        return rows.map((row) => ({
            scope: row.scope,
            type: row.type,
            partnerCode: row.partner.code,
            side: row.side,
            sign: row.sign === 1 ? 1 : -1,
            counterpartyCode: row.counterparty?.code ?? null,
        }));
    }
    /**
     * Post a gold movement, if the partner is tracked for AP/AR.
     *
     * Returns null when no rule matches — a movement to a display cabinet or a
     * wholesale customer creates no obligation, which is a normal outcome
     * rather than an error.
     */
    async postGold(tx, input) {
        const partner = await tx.partnerSource.findUnique({ where: { id: input.partnerId } });
        if (!partner || !partner.tracksGoldApAr)
            return null;
        const rules = await this.loadGoldRules(tx);
        const rule = (0, domain_1.findPostingRule)(rules, input.scope, input.type, partner.code);
        if (!rule)
            return null;
        const posting = (0, domain_1.buildGoldPosting)(rule, input.weightG, input.cost);
        const businessDate = business_day_service_1.BusinessDayService.toDateOnly();
        /*
         * Which partner's obligation moves. Normally the one on the movement, but
         * TOR §8.4 pairs Stock IN from EASY with Stock OUT to WITHDRAW: handing
         * gold to WITHDRAW is what clears EASY's payable. Booking that against
         * WITHDRAW would leave EASY's balance climbing forever and WITHDRAW's
         * running negative, so the pair has to settle on one row.
         */
        const bookAgainst = rule.counterpartyCode
            ? ((await tx.partnerSource.findUnique({ where: { code: rule.counterpartyCode } })) ?? partner)
            : partner;
        const ledgerPartnerId = bookAgainst.id;
        const previous = await tx.goldApArLedger.findFirst({
            where: { partnerId: ledgerPartnerId, side: posting.side, deletedAt: null },
            orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
        });
        const lastToday = await tx.goldApArLedger.findFirst({
            where: { partnerId: ledgerPartnerId, side: posting.side, businessDate },
            orderBy: { sequence: 'desc' },
        });
        const weightG = toDec(previous?.weightG).plus(posting.goldInG).minus(posting.goldOutG);
        const cost = toDec(previous?.cost).plus(posting.priceIn).minus(posting.priceOut);
        return tx.goldApArLedger.create({
            data: {
                partnerId: ledgerPartnerId,
                side: posting.side,
                refType: input.refType,
                movementId: input.movementId ?? null,
                businessDate,
                typeLabel: `${input.scope} ${input.type} — ${partner.nameLo}`,
                goldInG: D(posting.goldInG),
                goldOutG: D(posting.goldOutG),
                priceIn: D(posting.priceIn),
                priceOut: D(posting.priceOut),
                weightG: D(weightG),
                cost: D(cost),
                sequence: (lastToday?.sequence ?? 0) + 1,
                note: input.note ?? null,
                createdById: input.createdById,
            },
        });
    }
};
exports.ApArPostingService = ApArPostingService;
exports.ApArPostingService = ApArPostingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ApArPostingService);
//# sourceMappingURL=apar-posting.service.js.map