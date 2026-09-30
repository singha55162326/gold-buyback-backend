import { type Decimal } from './decimal.js';
/** 1 ບາດ = 15 g. Every weight/baht conversion in the system goes through this. */
export declare const GRAMS_PER_BAHT: import("decimal.js").Decimal;
/** ໝວດຄຳ — the two pricing families in TOR §3.1. */
export declare const GoldCategoryCode: {
    /** ຮູບປະພັນ — jewellery, priced by the A/B/C/D rounding ladder. */
    readonly JEWELRY: "JEWELRY";
    /** ຄຳແທ່ງ — bars, priced by simple division from the 1 ບາດ bar price. */
    readonly BAR: "BAR";
};
export type GoldCategoryCode = (typeof GoldCategoryCode)[keyof typeof GoldCategoryCode];
/** ນ້ຳໜັກ tiers. Codes are stable identifiers used as DB keys. */
export declare const TierCode: {
    readonly JW_BAHT_1: "JW_BAHT_1";
    readonly JW_SALEUNG_2: "JW_SALEUNG_2";
    readonly JW_SALEUNG_1: "JW_SALEUNG_1";
    readonly JW_HUN_5: "JW_HUN_5";
    readonly JW_HUN_3: "JW_HUN_3";
    readonly JW_HUN_2: "JW_HUN_2";
    readonly JW_HUN_1: "JW_HUN_1";
    readonly BAR_BAHT_1: "BAR_BAHT_1";
    readonly BAR_SALEUNG_2: "BAR_SALEUNG_2";
    readonly BAR_SALEUNG_1: "BAR_SALEUNG_1";
    readonly BAR_GRAM_1: "BAR_GRAM_1";
};
export type TierCode = (typeof TierCode)[keyof typeof TierCode];
export declare const JEWELRY_TIERS: readonly ["JW_BAHT_1", "JW_SALEUNG_2", "JW_SALEUNG_1", "JW_HUN_5", "JW_HUN_3", "JW_HUN_2", "JW_HUN_1"];
export declare const BAR_TIERS: readonly ["BAR_BAHT_1", "BAR_SALEUNG_2", "BAR_SALEUNG_1", "BAR_GRAM_1"];
export interface TierMeta {
    code: TierCode;
    category: GoldCategoryCode;
    /** Lao label as it appears in the TOR table and in the UI. */
    labelLo: string;
    /**
     * ນ້ຳໜັກ (g) as printed on the product table. The TOR deliberately shows
     * truncated values for some tiers (5 ຫຸນ = 1.87, 3 ຫຸນ = 1.12, 1 ຫຸນ = 0.37).
     */
    displayWeightG: Decimal;
    /**
     * ນ້ຳໜັກປ່ຽນເປັນເງິນ — the exact weight used for all exchange arithmetic
     * (5 ຫຸນ = 1.875, 3 ຫຸນ = 1.125, 1 ຫຸນ = 0.375).
     */
    exchangeWeightG: Decimal;
    sortOrder: number;
}
export declare const TIER_META: Record<TierCode, TierMeta>;
/** ສະກຸນເງິນ handled throughout the system. */
/**
 * TOR §3.3 — THB and USD exchange rates are quoted to two decimals, both
 * on screen and in storage. Shared so the API and the web round alike.
 */
export declare const RATE_DECIMALS = 2;
export declare const Currency: {
    readonly LAK: "LAK";
    readonly THB: "THB";
    readonly USD: "USD";
};
export type Currency = (typeof Currency)[keyof typeof Currency];
//# sourceMappingURL=constants.d.ts.map