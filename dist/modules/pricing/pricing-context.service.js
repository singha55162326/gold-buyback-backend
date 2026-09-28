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
exports.PricingContextService = void 0;
const common_1 = require("@nestjs/common");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
/** Which of the two 1-baht buyback prices a ປະເພດຄຳ is settled against. */
const BAR_KINDS = new Set(['BAR']);
let PricingContextService = class PricingContextService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async load() {
        const [snapshot, softFee, rates] = await Promise.all([
            this.prisma.priceSnapshot.findFirst({
                orderBy: { effectiveAt: 'desc' },
                include: { lines: true },
            }),
            this.prisma.softGoldFeeSnapshot.findFirst({ orderBy: { effectiveAt: 'desc' } }),
            this.prisma.exchangeRateSnapshot.findFirst({ orderBy: { effectiveAt: 'desc' } }),
        ]);
        if (!snapshot)
            throw new common_1.NotFoundException('ຍັງບໍ່ມີການຕັ້ງລາຄາ — ກະລຸນາຕັ້ງລາຄາຂາຍ 1 ບາດ ກ່ອນ');
        if (!softFee)
            throw new common_1.NotFoundException('ຍັງບໍ່ມີການຕັ້ງຄ່າອ່ອນ');
        if (!rates)
            throw new common_1.NotFoundException('ຍັງບໍ່ມີການຕັ້ງອັດຕາແລກປ່ຽນ');
        const buybackByTier = new Map(snapshot.lines.map((line) => [line.tierCode, (0, domain_1.dec)(line.buybackPrice.toFixed())]));
        // Keyed by DISPLAY weight (1.87), which is what the shop's own workbook
        // matches on: both the buyback price (ຄຳຮ້ານKPV!G6) and the ຄ່າອ່ອນ
        // standard (ປ່ຽນເປັນເງິນ!F9) look up Produets column B, the printed
        // weight — not column C, the 1.875 figure. Column C keys the ຄ່າປ່ຽນ
        // table instead. Using 1.875 here priced a genuine 1.87 g piece at zero.
        const table = (0, domain_1.makePriceTable)([
            domain_1.TierCode.JW_BAHT_1,
            domain_1.TierCode.JW_SALEUNG_2,
            domain_1.TierCode.JW_SALEUNG_1,
            domain_1.TierCode.JW_HUN_5,
            domain_1.TierCode.JW_HUN_3,
            domain_1.TierCode.JW_HUN_2,
            domain_1.TierCode.JW_HUN_1,
        ]
            .filter((tier) => buybackByTier.has(tier))
            .map((tier) => ({
            tierCode: tier,
            weightG: domain_1.TIER_META[tier].displayWeightG,
            buybackPrice: buybackByTier.get(tier),
        })));
        const barTable = (0, domain_1.makePriceTable)([
            domain_1.TierCode.BAR_BAHT_1,
            domain_1.TierCode.BAR_SALEUNG_2,
            domain_1.TierCode.BAR_SALEUNG_1,
            domain_1.TierCode.BAR_GRAM_1,
        ]
            .filter((tier) => buybackByTier.has(tier))
            .map((tier) => ({
            tierCode: tier,
            weightG: domain_1.TIER_META[tier].displayWeightG,
            buybackPrice: buybackByTier.get(tier),
        })));
        const source = {
            price1BahtFor: (kind) => buybackByTier.get(BAR_KINDS.has(kind) ? domain_1.TierCode.BAR_BAHT_1 : domain_1.TierCode.JW_BAHT_1) ?? (0, domain_1.dec)(0),
            lookup: (kind, weightG) => (0, domain_1.lookupExact)(BAR_KINDS.has(kind) ? barTable : table, weightG),
        };
        return {
            snapshot,
            source,
            table,
            softGoldFeePerGram: (0, domain_1.dec)(softFee.value.toFixed()),
            rates,
        };
    }
    /**
     * The rate to apply to a foreign-currency leg.
     *
     * `sell` rates are used when the shop TAKES money in (Order, Credit);
     * `buyback` rates when it PAYS money out (Buyback, Exchange). LAK is always
     * 1 so callers never special-case the home currency.
     */
    static rateFor(rates, currency, direction) {
        if (currency === 'LAK')
            return (0, domain_1.dec)(1);
        if (currency === 'THB') {
            return (0, domain_1.dec)((direction === 'sell' ? rates.thbSellRate : rates.thbBuybackRate).toFixed());
        }
        return (0, domain_1.dec)((direction === 'sell' ? rates.usdSellRate : rates.usdBuybackRate).toFixed());
    }
};
exports.PricingContextService = PricingContextService;
exports.PricingContextService = PricingContextService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PricingContextService);
//# sourceMappingURL=pricing-context.service.js.map