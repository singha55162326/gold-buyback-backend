import { Decimal, type Numeric } from './decimal.js';
export type ExchangeTxnType = 'EXCHANGE_TO_CASH' | 'FREE_EXCHANGE';
export type ShapeCondition = 'GOOD' | 'DAMAGED';
/** ປະເພດຄຳ of an old line — only ຄຳຫຍຸບ is ever charged ຄ່າອ່ອນ. */
export type ExchangeGoldKind = 'GOOD' | 'HUMP' | 'BAR' | 'BOILED';
/** ລາຍການຄຳເກົ່າ the customer brings in. */
export interface ExchangeOldLine {
    weightG: Numeric;
    quantity: Numeric;
    /** ເກນນ້ຳໜັກ standard for this item — the weight it left the shop at. */
    standardWeightG: Numeric;
    /**
     * ປະເພດຄຳ. Omitted lines are treated as ຄຳຫຍຸບ, which is the only kind the
     * shop charges ຄ່າອ່ອນ on and the only kind this fee was ever written for.
     */
    goldKind?: ExchangeGoldKind;
    /** ລາຄາຊື້ຄືນໜ້າຮ້ານ for this line. */
    shopBuybackPrice?: Numeric;
}
/** ລາຍການຄຳໃໝ່ the customer takes away. */
export interface ExchangeNewLine {
    weightG: Numeric;
    quantity: Numeric;
    /** ຄ່າຫຍຸບ — from the ຄ່າປ່ຽນ table, zero on a free exchange. */
    humpFee?: Numeric;
    /** ຄ່າປ່ຽນຄຳແທ່ງ */
    barConvertFee?: Numeric;
    /** ຄ່າລາຍ */
    patternFee?: Numeric;
}
/** ຄຳເກົ່າຄົງເຫຼືອ — old gold left over, paid out in cash. */
export interface ExchangeRemainingLine {
    weightG: Numeric;
    quantity: Numeric;
    shopBuybackPrice?: Numeric;
}
export interface ExchangeInput {
    txnType: ExchangeTxnType;
    shapeCondition: ShapeCondition;
    oldLines: ExchangeOldLine[];
    newLines: ExchangeNewLine[];
    remainingLines: ExchangeRemainingLine[];
    /** ຄ່າອ່ອນ ປັດຈຸບັນ (TOR §3.4), currently 400,000 LAK per gram short. */
    softGoldFeePerGram: Numeric;
}
export interface ExchangeTotals {
    /** Sum of ເກນນ້ຳໜັກ standard across the old lines. */
    standardOldWeightG: Decimal;
    /** Sum of the actual weight the customer handed over. */
    actualOldWeightG: Decimal;
    totalNewWeightG: Decimal;
    totalRemainingWeightG: Decimal;
    /** ຄ່າອ່ອນ across all old lines. */
    softGoldFee: Decimal;
    humpFee: Decimal;
    barConvertFee: Decimal;
    patternFee: Decimal;
    shopBuybackPrice: Decimal;
    /** ລວມເງິນຕ້ອງຈ່າຍ — may be negative when the customer owes the shop. */
    totalPayable: Decimal;
}
export interface ExchangeValidation {
    /** True only when the balance is exactly zero — the gate on saving. */
    isBalanced: boolean;
    /**
     * (ເກນນ້ຳໜັກຄຳເກົ່າ standard) − (ລວມນ້ຳໜັກຄຳໃໝ່ + ລວມນ້ຳໜັກເກົ່າຄົງເຫຼືອ)
     * Positive: gold unaccounted for. Negative: more taken than brought in.
     */
    difference: Decimal;
    /** Lao message to show beside the Save button; null when balanced. */
    messageLo: string | null;
}
/**
 * ຄ່າອ່ອນ (TOR §5.2) — the fee for gold that comes back lighter than it left.
 *
 * Taken from the shop's own workbook (`ປ່ຽນເປັນເງິນ!F9`), which settles what
 * the TOR left as a bare cell reference:
 *
 *   CEILING(ROUNDDOWN(ROUND(standard − actual, 3), 2), 0.1) / 0.1 × C7 × ຈຳນວນ
 *
 * Two things that are easy to get wrong and that the workbook is explicit
 * about:
 *
 *   1. The shortfall is billed in whole 0.1 g steps, rounded UP. A piece
 *      0.01 g light is charged a full step, the same as one 0.1 g light. A
 *      plain per-gram rate — the obvious reading of the TOR — undercharges
 *      every case by up to one whole step.
 *   2. Only ຄຳຫຍຸບ pays it. ຄຳດີ and ຄຳແທ່ງ are charged nothing; instead they
 *      must arrive at an exact tier weight, which §5.2's balance rule checks.
 *
 * `C7` is the ຄ່າອ່ອນ cell on the workbook's ຄ່າອ່ອນ sheet — the current value,
 * 400,000 — so the parameter keeps that meaning.
 */
export declare function softGoldFeeForLine(line: ExchangeOldLine, softGoldFee: Numeric): Decimal;
/**
 * How many 0.1 g steps a shortfall is billed at.
 *
 * ROUND to 3 then ROUNDDOWN to 2 before the CEILING is the workbook's own
 * order: it clears the floating-point dust that 30 − 29.89 leaves behind
 * before deciding which step the shortfall falls into.
 */
export declare function softGoldSteps(shortfallG: Numeric): Decimal;
/**
 * All §5.2 totals for one exchange.
 *
 * ລວມເງິນຕ້ອງຈ່າຍ = ລາຄາຊື້ຄືນໜ້າຮ້ານ − ຄ່າອ່ອນ − ຄ່າຫຍຸບ − ຄ່າປ່ຽນຄຳແທ່ງ − ຄ່າລາຍ
 *
 * On a ປ່ຽນຟຣີ the conversion fees are forced to zero regardless of what the
 * ຄ່າປ່ຽນ table says, so a free exchange cannot accidentally bill the customer.
 */
export declare function calculateExchange(input: ExchangeInput): ExchangeTotals;
/**
 * ⚠ CRITICAL Validation Rule (TOR §5.2).
 *
 *   (ເກນນ້ຳໜັກຄຳເກົ່າ standard) − (ລວມນ້ຳໜັກຄຳໃໝ່ + ລວມນ້ຳໜັກເກົ່າຄົງເຫຼືອ) === 0
 *
 * This is the single rule that keeps gold from leaking out of the shop during
 * an exchange: every gram brought in must leave as either new gold or
 * remaining old gold. It is checked here in the domain layer so the browser
 * and the API enforce exactly the same condition, and the API refuses the
 * write even if the UI is bypassed.
 */
export declare function validateExchangeBalance(totals: ExchangeTotals): ExchangeValidation;
//# sourceMappingURL=exchange.d.ts.map