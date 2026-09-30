import { type Decimal, type Numeric } from './decimal.js';
import { type TierMeta } from './constants.js';
/**
 * Tunable constants. The TOR values are the defaults; they live here rather
 * than inline so that a future "pricing settings" screen can override them
 * without touching the formulas.
 */
export interface PricingConfig {
    /** ຄ່າທໍານຽມ/ສ່ວນຫຼຸດພື້ນຖານ subtracted before the proportional split. */
    jewelryBaseDeduction: Numeric;
    /** ຊົດເຊີຍຄ່າຫຼໍ່/ຊ່າງ added inside A and B for the 3/2/1 ຫຸນ tiers. */
    smallTierSurcharge: Numeric;
    /** Flat amount added to D for 1 ສະຫຼຶງ / 5 ຫຸນ / 3 ຫຸນ / 2 ຫຸນ. */
    tierAdjustment: Numeric;
    /** Flat amount added to D for 1 ຫຸນ (higher craft margin on tiny pieces). */
    hun1Adjustment: Numeric;
    /**
     * The C threshold that means "do not round at all", and the bump applied
     * when the ROUND went downward. Both are 5,000 in the TOR.
     */
    roundingTie: Numeric;
    /** ຄຳແທ່ງ 1 ບາດ = ລາຄາຂາຍ 1 ບາດ minus this. */
    barBahtDiscount: Numeric;
    /** ຄຳແທ່ງ 1g = ROUNDUP(bar1Baht / 15 + this, -3). */
    barGramSurcharge: Numeric;
    /** ລາຄາຊື້ຄືນ ຄຳແທ່ງ 1 ບາດ = ລາຄາຂາຍ ຄຳແທ່ງ 1 ບາດ minus this. */
    barBuybackDiscount: Numeric;
}
export declare const DEFAULT_PRICING_CONFIG: PricingConfig;
/**
 * The four intermediate values the TOR names explicitly. They are returned
 * alongside every jewellery price so the Set Pricing screen can show the shop
 * owner exactly how a number was reached, and so any discrepancy against the
 * old spreadsheet can be traced to a single step.
 */
export interface RoundingSteps {
    /** A — ລາຄາຕົ້ນທຶນ/ລາຄາຕາມສັດສ່ວນແທ້. */
    a: Decimal;
    /** B — A rounded to the nearest 10,000, or the tier's own expression. */
    b: Decimal;
    /** C — B minus A: the direction and size of the rounding. */
    c: Decimal;
    /** D — ລາຄາຫຼັງປັບເງື່ອນໄຂ. */
    d: Decimal;
    /** D plus the tier adjustment: the price actually charged. */
    final: Decimal;
}
export interface JewelrySellResult {
    /** Final ລາຄາຂາຍ per tier. */
    prices: Record<string, Decimal>;
    /** Per-tier A/B/C/D breakdown; absent for 1 ບາດ and 2 ສະຫຼຶງ, which are direct. */
    steps: Partial<Record<string, RoundingSteps>>;
}
/**
 * ສູດຄິດໄລ່ ລາຄາຂາຍ ຮູບປະພັນ (TOR §3.1).
 *
 * Verified against the TOR sample table at ລາຄາຂາຍ 1 ບາດ = 45,859,000:
 *   1 ສະຫຼຶງ 11,469,000 · 2 ສະຫຼຶງ 22,938,000 · 5 ຫຸນ 5,739,000
 *   3 ຫຸນ 3,479,000 · 2 ຫຸນ 2,329,000 · 1 ຫຸນ 1,194,000
 *
 * Two details are easy to get wrong and are deliberate here:
 *  1. The 3/2/1 ຫຸນ tiers derive A from the 5 ຫຸນ **D value** — the price
 *     before its +4,000 adjustment — not from its final published price.
 *  2. Those tiers compute B from an independent expression based on
 *     ລາຄາຂາຍ 1 ບາດ. B is NOT round(A, -4) as it is for the larger tiers.
 */
export declare function computeJewelrySellPrices(price1Baht: Numeric, config?: PricingConfig): JewelrySellResult;
/**
 * ສູດຄິດໄລ່ ລາຄາຂາຍ ຄຳແທ່ງ (TOR §3.1).
 *
 * At ລາຄາຂາຍ 1 ບາດ = 45,859,000 this yields
 * 45,750,000 / 22,875,000 / 11,437,500 / 3,170,000.
 */
export declare function computeBarSellPrices(price1Baht: Numeric, config?: PricingConfig): Record<string, Decimal>;
export type DeductionKind = 'PERCENT' | 'AMOUNT';
/**
 * How a tier's buyback price is derived from its sell price.
 *  - PERCENT: `value` is in percent units, so 2.6 means 2.60%
 *  - AMOUNT:  `value` is a flat LAK amount subtracted, e.g. 209,000
 * These are loaded from `BuybackDeductionRule` so the shop can retune them
 * without a code change.
 */
export interface DeductionRule {
    kind: DeductionKind;
    value: Numeric;
}
/** TOR §3.2 defaults. */
export declare const DEFAULT_BUYBACK_DEDUCTIONS: Record<string, DeductionRule>;
/**
 * ສູດຄິດໄລ່ ລາຄາຊື້ຄືນ ຮູບປະພັນ (TOR §3.1 / §3.2).
 *
 * Percent tiers deduct a share of the sell price; ຫຸນ tiers deduct a flat
 * amount. Both are then ROUND(..., -3) to whole thousands of kip.
 */
export declare function computeJewelryBuybackPrices(sellPrices: Record<string, Numeric>, deductions?: Record<string, DeductionRule>): Record<string, Decimal>;
/**
 * ສູດຄິດໄລ່ ລາຄາຊື້ຄືນ ຄຳແທ່ງ (TOR §3.1).
 *
 * The 1 g tier uses ROUNDDOWN so the shop never overpays on the smallest
 * unit: 45,220,000 / 15 = 3,014,666.67 -> 3,014,000.
 */
export declare function computeBarBuybackPrices(barSellPrices: Record<string, Numeric>, config?: PricingConfig): Record<string, Decimal>;
export interface PriceBoardLine {
    tier: string;
    sellPrice: Decimal;
    buybackPrice: Decimal;
    steps?: RoundingSteps;
}
export interface PriceBoard {
    price1Baht: Decimal;
    sell: Record<string, Decimal>;
    buyback: Record<string, Decimal>;
    steps: Partial<Record<string, RoundingSteps>>;
    lines: PriceBoardLine[];
}
/** Display order of the 11 rows, matching the TOR product table. */
export declare const PRICE_BOARD_ORDER: readonly string[];
/**
 * Build the complete 11-row price board from ລາຄາຂາຍ 1 ບາດ.
 *
 * This single function backs both the Set Pricing preview in the browser and
 * the PriceSnapshot rows written by the API, so a saved price can never
 * disagree with the price the user was shown before pressing save.
 */
export declare function buildPriceBoard(price1Baht: Numeric, options?: {
    config?: PricingConfig;
    deductions?: Record<string, DeductionRule>;
    tierOrder?: readonly string[];
}): PriceBoard;
/** Look up a tier's sell or buyback price from a board. */
export declare function priceForTier(board: PriceBoard, tier: TierMeta | string, side: 'sell' | 'buyback'): Decimal;
//# sourceMappingURL=pricing.d.ts.map