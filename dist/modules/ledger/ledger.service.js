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
exports.LedgerService = void 0;
const common_1 = require("@nestjs/common");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const history_range_service_1 = require("../../common/services/history-range.service");
const business_day_service_1 = require("../../common/services/business-day.service");
const stock_ledger_service_1 = require("../../common/services/stock-ledger.service");
const advance_service_1 = require("../../common/services/advance.service");
const cash_service_1 = require("../cash/cash.service");
const pricing_context_service_1 = require("../pricing/pricing-context.service");
const CURRENCIES = ['LAK', 'THB', 'USD'];
/**
 * The read-side of the accounting modules: COH, Wealth, WAC and the two
 * AP/AR dashboards (TOR §3.7, §8, §9).
 *
 * Every figure here is DERIVED — nothing in this service writes. Balances are
 * recomputed from the ledgers on each request rather than cached, so a
 * dashboard can never drift from the transactions underneath it.
 */
let LedgerService = class LedgerService {
    prisma;
    businessDay;
    stockLedger;
    cash;
    advance;
    pricingContext;
    range;
    constructor(prisma, businessDay, stockLedger, cash, advance, pricingContext, range) {
        this.prisma = prisma;
        this.businessDay = businessDay;
        this.stockLedger = stockLedger;
        this.cash = cash;
        this.advance = advance;
        this.pricingContext = pricingContext;
        this.range = range;
    }
    /* ---------------------------------------------------------------- *
     * §3.7 — WAC ປັດຈຸບັນ
     * ---------------------------------------------------------------- */
    async wac() {
        const wac = await this.stockLedger.currentWac();
        return {
            newWeightG: wac.newPosition.weightG.toFixed(),
            newCost: wac.newPosition.cost.toFixed(),
            oldWeightG: wac.oldPosition.weightG.toFixed(),
            oldCost: wac.oldPosition.cost.toFixed(),
            totalWeightG: wac.totalWeightG.toFixed(),
            totalCost: wac.totalCost.toFixed(),
            pricePerG: wac.pricePerG.toFixed(),
            pricePerBaht: wac.pricePerBaht.toFixed(),
        };
    }
    /* ---------------------------------------------------------------- *
     * §9 — AP/AR (Cash)
     * ---------------------------------------------------------------- */
    /** Net AP and AR per currency for today, including the opening carried in. */
    /** AP/AR ເງິນສົດ ຂອງມື້ການຄ້າ. ບໍ່ສົ່ງມື້ມາ = ມື້ນີ້. */
    async cashApAr(day) {
        const target = day ?? (await this.businessDay.current());
        const [openings, movements] = await Promise.all([
            this.prisma.cashApArOpening.findMany({ where: { businessDayId: target.id } }),
            this.prisma.cashApArLedger.groupBy({
                by: ['side', 'currency'],
                where: { businessDate: target.date, deletedAt: null },
                _sum: { amountIn: true, amountOut: true },
            }),
        ]);
        const openingByKey = new Map(openings.map((o) => [`${o.side}:${o.currency}`, (0, domain_1.dec)(o.openingAmount.toFixed())]));
        return ['AP', 'AR'].flatMap((side) => CURRENCIES.map((currency) => {
            const row = movements.find((m) => m.side === side && m.currency === currency);
            const net = (0, domain_1.netCashApAr)(openingByKey.get(`${side}:${currency}`) ?? (0, domain_1.dec)(0), (0, domain_1.dec)(row?._sum.amountIn?.toFixed() ?? 0), (0, domain_1.dec)(row?._sum.amountOut?.toFixed() ?? 0));
            return {
                side,
                currency,
                opening: net.opening.toFixed(),
                increases: net.increases.toFixed(),
                decreases: net.decreases.toFixed(),
                net: net.net.toFixed(),
            };
        }));
    }
    async cashApArHistory(query, user) {
        const range = this.range.resolve(query, user);
        const where = {
            deletedAt: null,
            businessDate: history_range_service_1.HistoryRangeService.dayWindow(range),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.cashApArLedger.findMany({
                where,
                include: { partner: true, category: true },
                orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
                skip: range.skip,
                take: range.take,
            }),
            this.prisma.cashApArLedger.count({ where }),
        ]);
        return this.range.page(rows, total, range);
    }
    /* ---------------------------------------------------------------- *
     * §8 — AP/AR (GOLD)
     * ---------------------------------------------------------------- */
    /** ຍອດລວມ AP (GOLD) ແລະ AR (GOLD), with the baht equivalent (§8.1). */
    async goldApArSummary() {
        const day = await this.businessDay.current();
        const [openings, movements] = await Promise.all([
            this.prisma.goldApArOpening.findMany({ where: { businessDayId: day.id } }),
            this.prisma.goldApArLedger.groupBy({
                by: ['side'],
                where: { businessDate: business_day_service_1.BusinessDayService.toDateOnly(), deletedAt: null },
                _sum: { goldInG: true, goldOutG: true },
            }),
        ]);
        return ['AP', 'AR'].map((side) => {
            const start = openings
                .filter((o) => o.side === side)
                .reduce((sum, o) => sum.plus((0, domain_1.dec)(o.openingWeightG.toFixed())), (0, domain_1.dec)(0));
            const row = movements.find((m) => m.side === side);
            const summary = (0, domain_1.summariseGoldApAr)(start, (0, domain_1.dec)(row?._sum.goldInG?.toFixed() ?? 0), (0, domain_1.dec)(row?._sum.goldOutG?.toFixed() ?? 0));
            return {
                side,
                startG: summary.startG.toFixed(),
                netMovementG: summary.netMovementG.toFixed(),
                totalG: summary.totalG.toFixed(),
                totalBaht: summary.totalBaht.toFixed(),
            };
        });
    }
    /**
     * ຕາຕະລາງແຍກຕາມແຫຼ່ງທີ່ຮັບເຂົ້າ (§8.2).
     *
     * Lists the partners an obligation can actually rest on. A partner that is
     * only ever a destination — WITHDRAW, whose handovers clear EASY's payable
     * under the §8.4 pair — carries no balance of its own, so showing it would
     * be a permanent row of zeros next to the real counterparties.
     */
    async goldApArByPartner() {
        const day = await this.businessDay.current();
        // A partner earns a row by being the target some rule actually books onto
        // — its own `partnerId`, or the `counterpartyId` that overrides it. Asking
        // it this way (rather than "has no redirected rule") keeps a partner that
        // both holds its own balance and redirects one movement.
        const rules = await this.prisma.goldApArPostingRule.findMany({
            where: { isActive: true },
            select: { partnerId: true, counterpartyId: true },
        });
        const holdsBalance = new Set(rules.map((r) => r.counterpartyId ?? r.partnerId));
        const [partners, openings, movements] = await Promise.all([
            this.prisma.partnerSource.findMany({
                where: {
                    tracksGoldApAr: true,
                    deletedAt: null,
                    id: { in: [...holdsBalance] },
                },
                orderBy: { sortOrder: 'asc' },
            }),
            this.prisma.goldApArOpening.findMany({ where: { businessDayId: day.id } }),
            this.prisma.goldApArLedger.groupBy({
                by: ['partnerId', 'side'],
                where: { businessDate: business_day_service_1.BusinessDayService.toDateOnly(), deletedAt: null },
                _sum: { goldInG: true, goldOutG: true },
            }),
        ]);
        return partners.flatMap((partner) => ['AP', 'AR'].map((side) => {
            const opening = openings.find((o) => o.partnerId === partner.id && o.side === side);
            const row = movements.find((m) => m.partnerId === partner.id && m.side === side);
            const broughtForward = (0, domain_1.dec)(opening?.openingWeightG.toFixed() ?? 0);
            const increases = (0, domain_1.dec)(row?._sum.goldInG?.toFixed() ?? 0);
            const decreases = (0, domain_1.dec)(row?._sum.goldOutG?.toFixed() ?? 0);
            return {
                partnerId: partner.id,
                partnerCode: partner.code,
                partnerNameLo: partner.nameLo,
                side,
                broughtForwardG: broughtForward.toFixed(),
                increasesG: increases.toFixed(),
                decreasesG: decreases.toFixed(),
                currentG: (0, domain_1.partnerBalance)(broughtForward, increases, decreases).toFixed(),
            };
        }));
    }
    async goldApArHistory(query, user) {
        const range = this.range.resolve(query, user);
        const where = {
            deletedAt: null,
            businessDate: history_range_service_1.HistoryRangeService.dayWindow(range),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.goldApArLedger.findMany({
                where,
                include: { partner: true },
                orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
                skip: range.skip,
                take: range.take,
            }),
            this.prisma.goldApArLedger.count({ where }),
        ]);
        return this.range.page(rows, total, range);
    }
    /* ---------------------------------------------------------------- *
     * §3.7 — COH (Cash On Hand ແລະ Gold On Hand)
     * ---------------------------------------------------------------- */
    /**
     * COH Cash = Cash + BCEL + LDB + Other Bank − AP + AR, per currency.
     * COH Gold = Gold NEW(g) + Gold OLD(g) − AP + AR.
     */
    /**
     * COH ຢູ່ວັນທີໃດໜຶ່ງ (TOR §3.7). ບໍ່ສົ່ງວັນທີມາ = ມື້ນີ້.
     *
     * COH ເປັນ "ຍອດຢູ່ເວລາໜຶ່ງ" ບໍ່ແມ່ນປະຫວັດ, ສະນັ້ນ filter ຈຶ່ງເປັນວັນທີດຽວ
     * ບໍ່ແມ່ນຊ່ວງ. ເງິນສົດ / ທະນາຄານ / AP-AR ອ່ານຕາມມື້ການຄ້ານັ້ນ, ສ່ວນ ຄຳ ແລະ
     * Advance ເປັນຍອດສະສົມ ຈຶ່ງອ່ານເຖິງວັນທີນັ້ນ.
     *
     * ວັນທີທີ່ບໍ່ເຄີຍເປີດເປັນມື້ການຄ້າ ຈະໄດ້ຍອດເງິນສົດ/ທະນາຄານ = 0 ເຊິ່ງຖືກຕ້ອງ:
     * ມື້ນັ້ນບໍ່ມີການເຄື່ອນໄຫວ.
     */
    async coh(asOfDate) {
        const day = asOfDate
            ? await this.prisma.businessDay.findUnique({ where: { date: new Date(`${asOfDate}T00:00:00.000Z`) } })
            : await this.businessDay.current();
        const asOf = asOfDate ? new Date(`${asOfDate}T00:00:00.000Z`) : undefined;
        const [cashBalances, bankBalances, apAr, goldSummary, wacPosition, advanceNet] = await Promise.all([
            this.cash.cashBalances(day?.id ?? '—'),
            this.cash.bankBalances(day?.id ?? '—'),
            // ມື້ທີ່ບໍ່ເຄີຍເປີດ: ສົ່ງ id ທີ່ບໍ່ກົງກັບແຖວໃດ ແລ້ວໄດ້ຍອດ 0 ຜ່ານເສັ້ນທາງດຽວກັນ.
            this.cashApAr(day ?? { id: '—', date: asOf }),
            this.goldApArSummary(),
            this.stockLedger.currentWac(this.prisma, asOf),
            this.advance.netByCurrency(this.prisma, asOf),
        ]);
        const cashByCurrency = new Map(cashBalances.map((b) => [b.currency, (0, domain_1.dec)(b.balance)]));
        const bankByCurrency = (code, currency) => {
            const row = bankBalances.find((b) => b.bankCode === code && b.currency === currency);
            return (0, domain_1.dec)(row?.actual ?? 0);
        };
        const apArFor = (side, currency) => {
            const row = apAr.find((r) => r.side === side && r.currency === currency);
            return (0, domain_1.dec)(row?.net ?? 0);
        };
        const cash = CURRENCIES.map((currency) => {
            const bcel = bankByCurrency('BCEL', currency);
            const ldb = bankByCurrency('LDB', currency);
            const other = bankByCurrency('OTHER_BANK', currency);
            const ap = apArFor('AP', currency);
            const ar = apArFor('AR', currency);
            const advance = advanceNet[currency] ?? (0, domain_1.dec)(0);
            const cashAmount = cashByCurrency.get(currency) ?? (0, domain_1.dec)(0);
            return {
                currency,
                cash: cashAmount.toFixed(),
                bcel: bcel.toFixed(),
                ldb: ldb.toFixed(),
                otherBank: other.toFixed(),
                ap: ap.toFixed(),
                ar: ar.toFixed(),
                advance: advance.toFixed(),
                // TOR §3.7: COH Cash = Cash + banks − AP + AR − Advance
                coh: (0, domain_1.cashOnHand)({
                    cash: cashAmount,
                    bcel,
                    ldb,
                    otherBank: other,
                    ap,
                    ar,
                    advance,
                }).toFixed(),
            };
        });
        const goldAp = (0, domain_1.dec)(goldSummary.find((s) => s.side === 'AP')?.totalG ?? 0);
        const goldAr = (0, domain_1.dec)(goldSummary.find((s) => s.side === 'AR')?.totalG ?? 0);
        const gold = (0, domain_1.goldOnHand)({
            newG: wacPosition.newPosition.weightG,
            oldG: wacPosition.oldPosition.weightG,
            apG: goldAp,
            arG: goldAr,
        });
        return {
            cash,
            gold: {
                newG: wacPosition.newPosition.weightG.toFixed(),
                oldG: wacPosition.oldPosition.weightG.toFixed(),
                apG: goldAp.toFixed(),
                arG: goldAr.toFixed(),
                cohG: gold.weightG.toFixed(),
                cohBaht: gold.baht.toFixed(),
            },
        };
    }
    /* ---------------------------------------------------------------- *
     * §3.7 — Wealth
     * ---------------------------------------------------------------- */
    /**
     * Total holdings converted to LAK at the SELL rates, then expressed as the
     * weight of gold they would buy at today's ລາຄາຂາຍ 1 ບາດ.
     */
    async wealth() {
        const [coh, context] = await Promise.all([this.coh(), this.pricingContext.load()]);
        const totalFor = (currency) => (0, domain_1.dec)(coh.cash.find((c) => c.currency === currency)?.coh ?? 0);
        const wealth = (0, domain_1.calculateWealth)({
            totalLak: totalFor('LAK'),
            totalThb: totalFor('THB'),
            totalUsd: totalFor('USD'),
            thbSellRate: (0, domain_1.dec)(context.rates.thbSellRate.toFixed()),
            usdSellRate: (0, domain_1.dec)(context.rates.usdSellRate.toFixed()),
            price1Baht: (0, domain_1.dec)(context.snapshot.price1Baht.toFixed()),
        });
        // The per-currency LAK equivalents are returned rather than left to the
        // browser: multiplying a Decimal string by a rate in JS means going
        // through a float, which is exactly what this system avoids everywhere
        // else — and the error shows up once rates carry decimals (§3.3).
        const thbInLak = totalFor('THB').mul((0, domain_1.dec)(context.rates.thbSellRate.toFixed()));
        const usdInLak = totalFor('USD').mul((0, domain_1.dec)(context.rates.usdSellRate.toFixed()));
        return {
            totalLak: totalFor('LAK').toFixed(),
            totalThb: totalFor('THB').toFixed(),
            totalUsd: totalFor('USD').toFixed(),
            thbSellRate: context.rates.thbSellRate.toFixed(),
            usdSellRate: context.rates.usdSellRate.toFixed(),
            thbInLak: thbInLak.toFixed(),
            usdInLak: usdInLak.toFixed(),
            price1Baht: context.snapshot.price1Baht.toFixed(),
            grandTotalLak: wealth.totalLak.toFixed(),
            weightG: wealth.weightG.toFixed(),
            baht: wealth.baht.toFixed(),
        };
    }
    /**
     * Wealth ລາຍວັນ — 30 ມື້ການຄ້າລ່າສຸດ (TOR §3.7 ຕາມທີ່ລູກຄ້າແຈ້ງ).
     *
     *   ຍອດຄຳຍົກມາ (g) = ຍອດຕົ້ນມື້ ຂອງ ສາງຄຳເກົ່າ + ສາງຄຳໃໝ່
     *   ຍອດຄຳສຸດທິ (g) = ຍອດທ້າຍມື້ ຂອງ ສອງສາງ
     *   ສ່ວນຕ່າງ (g)    = ຍົກມາ − ສຸດທິ
     *
     * ອ່ານຈາກຕາຕະລາງຍອດລາຍວັນທີ່ມີຢູ່ແລ້ວ (ຕໍ່ມື້ການຄ້າ ຕໍ່ປະເພດຄຳ / ຕໍ່ SKU)
     * ບໍ່ແມ່ນໄລ່ຄືນຈາກ ledger ທັງໝົດ — ຕົວເລກຈຶ່ງກົງກັບທີ່ໜ້າສາງສະແດງ.
     * ສາງຄຳໃໝ່ ເກັບຍອດຕົ້ນມື້ເປັນຈຳນວນ, ສະນັ້ນຄູນດ້ວຍນ້ຳໜັກ SKU ກ່ອນ.
     */
    async wealthHistory(limit = 30) {
        const days = await this.prisma.businessDay.findMany({
            orderBy: { date: 'desc' },
            take: Math.min(limit, 180),
            select: { id: true, date: true },
        });
        if (days.length === 0)
            return [];
        const dayIds = days.map((d) => d.id);
        const [oldRows, newRows] = await Promise.all([
            this.prisma.stockOldTypeBalance.findMany({
                where: { businessDayId: { in: dayIds } },
                select: { businessDayId: true, openingWeightG: true, closingWeightG: true },
            }),
            this.prisma.stockNewSkuBalance.findMany({
                where: { businessDayId: { in: dayIds } },
                select: {
                    businessDayId: true, openingQty: true, totalWeightG: true,
                    goldSku: { select: { weightG: true } },
                },
            }),
        ]);
        const opening = new Map();
        const closing = new Map();
        const add = (map, key, value) => map.set(key, (map.get(key) ?? (0, domain_1.dec)(0)).plus(value));
        for (const row of oldRows) {
            add(opening, row.businessDayId, (0, domain_1.dec)(row.openingWeightG.toFixed()));
            add(closing, row.businessDayId, (0, domain_1.dec)(row.closingWeightG.toFixed()));
        }
        for (const row of newRows) {
            add(opening, row.businessDayId, (0, domain_1.dec)(row.goldSku.weightG.toFixed()).mul(row.openingQty));
            add(closing, row.businessDayId, (0, domain_1.dec)(row.totalWeightG.toFixed()));
        }
        return days.map((day) => {
            const broughtForwardG = opening.get(day.id) ?? (0, domain_1.dec)(0);
            const netG = closing.get(day.id) ?? (0, domain_1.dec)(0);
            return {
                businessDayId: day.id,
                date: day.date,
                broughtForwardG: broughtForwardG.toFixed(),
                netG: netG.toFixed(),
                differenceG: broughtForwardG.minus(netG).toFixed(),
            };
        });
    }
};
exports.LedgerService = LedgerService;
exports.LedgerService = LedgerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        business_day_service_1.BusinessDayService,
        stock_ledger_service_1.StockLedgerService,
        cash_service_1.CashService,
        advance_service_1.AdvanceService,
        pricing_context_service_1.PricingContextService,
        history_range_service_1.HistoryRangeService])
], LedgerService);
//# sourceMappingURL=ledger.service.js.map