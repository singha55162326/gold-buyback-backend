import { dec } from './decimal.js';
/** 1 ບາດ = 15 g. Every weight/baht conversion in the system goes through this. */
export const GRAMS_PER_BAHT = dec(15);
/** ໝວດຄຳ — the two pricing families in TOR §3.1. */
export const GoldCategoryCode = {
    /** ຮູບປະພັນ — jewellery, priced by the A/B/C/D rounding ladder. */
    JEWELRY: 'JEWELRY',
    /** ຄຳແທ່ງ — bars, priced by simple division from the 1 ບາດ bar price. */
    BAR: 'BAR',
};
/** ນ້ຳໜັກ tiers. Codes are stable identifiers used as DB keys. */
export const TierCode = {
    JW_BAHT_1: 'JW_BAHT_1',
    JW_SALEUNG_2: 'JW_SALEUNG_2',
    JW_SALEUNG_1: 'JW_SALEUNG_1',
    JW_HUN_5: 'JW_HUN_5',
    JW_HUN_3: 'JW_HUN_3',
    JW_HUN_2: 'JW_HUN_2',
    JW_HUN_1: 'JW_HUN_1',
    BAR_BAHT_1: 'BAR_BAHT_1',
    BAR_SALEUNG_2: 'BAR_SALEUNG_2',
    BAR_SALEUNG_1: 'BAR_SALEUNG_1',
    BAR_GRAM_1: 'BAR_GRAM_1',
};
export const JEWELRY_TIERS = [
    TierCode.JW_BAHT_1,
    TierCode.JW_SALEUNG_2,
    TierCode.JW_SALEUNG_1,
    TierCode.JW_HUN_5,
    TierCode.JW_HUN_3,
    TierCode.JW_HUN_2,
    TierCode.JW_HUN_1,
];
export const BAR_TIERS = [
    TierCode.BAR_BAHT_1,
    TierCode.BAR_SALEUNG_2,
    TierCode.BAR_SALEUNG_1,
    TierCode.BAR_GRAM_1,
];
export const TIER_META = {
    JW_BAHT_1: {
        code: TierCode.JW_BAHT_1, category: 'JEWELRY', labelLo: 'ຮູບປະພັນ - 1 ບາດ',
        displayWeightG: dec(15), exchangeWeightG: dec(15), sortOrder: 1,
    },
    JW_SALEUNG_2: {
        code: TierCode.JW_SALEUNG_2, category: 'JEWELRY', labelLo: 'ຮູບປະພັນ - 2 ສະຫຼຶງ',
        displayWeightG: dec('7.5'), exchangeWeightG: dec('7.5'), sortOrder: 2,
    },
    JW_SALEUNG_1: {
        code: TierCode.JW_SALEUNG_1, category: 'JEWELRY', labelLo: 'ຮູບປະພັນ - 1 ສະຫຼຶງ',
        displayWeightG: dec('3.75'), exchangeWeightG: dec('3.75'), sortOrder: 3,
    },
    JW_HUN_5: {
        code: TierCode.JW_HUN_5, category: 'JEWELRY', labelLo: 'ຮູບປະພັນ - 5 ຫຸນ',
        displayWeightG: dec('1.87'), exchangeWeightG: dec('1.875'), sortOrder: 4,
    },
    JW_HUN_3: {
        code: TierCode.JW_HUN_3, category: 'JEWELRY', labelLo: 'ຮູບປະພັນ - 3 ຫຸນ',
        displayWeightG: dec('1.12'), exchangeWeightG: dec('1.125'), sortOrder: 5,
    },
    JW_HUN_2: {
        code: TierCode.JW_HUN_2, category: 'JEWELRY', labelLo: 'ຮູບປະພັນ - 2 ຫຸນ',
        displayWeightG: dec('0.75'), exchangeWeightG: dec('0.75'), sortOrder: 6,
    },
    JW_HUN_1: {
        code: TierCode.JW_HUN_1, category: 'JEWELRY', labelLo: 'ຮູບປະພັນ - 1 ຫຸນ',
        displayWeightG: dec('0.37'), exchangeWeightG: dec('0.375'), sortOrder: 7,
    },
    BAR_BAHT_1: {
        code: TierCode.BAR_BAHT_1, category: 'BAR', labelLo: 'ຄຳແທ່ງ - 1 ບາດ',
        displayWeightG: dec(15), exchangeWeightG: dec(15), sortOrder: 8,
    },
    BAR_SALEUNG_2: {
        code: TierCode.BAR_SALEUNG_2, category: 'BAR', labelLo: 'ຄຳແທ່ງ - 2 ສະຫຼຶງ',
        displayWeightG: dec('7.5'), exchangeWeightG: dec('7.5'), sortOrder: 9,
    },
    BAR_SALEUNG_1: {
        code: TierCode.BAR_SALEUNG_1, category: 'BAR', labelLo: 'ຄຳແທ່ງ - 1 ສະຫຼຶງ',
        displayWeightG: dec('3.75'), exchangeWeightG: dec('3.75'), sortOrder: 10,
    },
    BAR_GRAM_1: {
        code: TierCode.BAR_GRAM_1, category: 'BAR', labelLo: 'ຄຳແທ່ງ - 1g',
        displayWeightG: dec(1), exchangeWeightG: dec(1), sortOrder: 11,
    },
};
/** ສະກຸນເງິນ handled throughout the system. */
/**
 * TOR §3.3 — THB and USD exchange rates are quoted to two decimals, both
 * on screen and in storage. Shared so the API and the web round alike.
 */
export const RATE_DECIMALS = 2;
export const Currency = { LAK: 'LAK', THB: 'THB', USD: 'USD' };
//# sourceMappingURL=constants.js.map