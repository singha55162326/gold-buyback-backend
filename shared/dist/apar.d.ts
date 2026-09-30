import { type Decimal, type Numeric } from './decimal.js';
import { type Currency } from './constants.js';
export type ApArSide = 'AP' | 'AR';
export type StockScope = 'NEW' | 'OLD';
export type MovementType = 'IN' | 'OUT' | 'TRANSFER';
/**
 * How one gold movement posts to the sub-ledger.
 *
 * TODO(TOR-4): §8.3 contradicts both itself and §8.1 on these directions —
 * four bullets titled "ເພີ່ມ AP (+)" have bodies reading "ບັນທຶກຫຼຸດຍອດ", and
 * §8.1 calls gold sent out to FACTORY *AR* where §8.3 posts it to *AP*.
 *
 * Rather than freezing one reading into code, the mapping is DATA: rows in
 * `GoldApArPostingRule`, seeded from §8.1's definitions and editable by an
 * Admin. Correcting the convention is then a settings change, not a release.
 */
export interface GoldPostingRule {
    scope: StockScope;
    type: MovementType;
    partnerCode: string;
    side: ApArSide;
    /** +1 increases the sub-ledger, -1 decreases it. */
    sign: 1 | -1;
    /**
     * Book against this partner instead of `partnerCode`, when the movement is
     * recorded against one party but settles another's obligation. TOR §8.4
     * pairs Stock IN from EASY with Stock OUT to WITHDRAW — the second half
     * clears EASY's payable, so it must land on EASY's row, not WITHDRAW's.
     */
    counterpartyCode?: string | null;
}
export interface GoldPosting {
    side: ApArSide;
    goldInG: Decimal;
    goldOutG: Decimal;
    priceIn: Decimal;
    priceOut: Decimal;
}
/**
 * Resolve a movement to its posting rule. Returns null when the partner is
 * not tracked for AP/AR (a cabinet or a wholesale customer), which is a
 * normal outcome, not an error.
 */
export declare function findPostingRule(rules: GoldPostingRule[], scope: StockScope, type: MovementType, partnerCode: string): GoldPostingRule | null;
/**
 * Turn a movement into the IN/OUT columns of the AP/AR (GOLD) ledger.
 *
 * A `sign` of +1 books the weight in the ledger's IN column (increasing the
 * obligation) and -1 books it in OUT (settling it), which keeps the §8.2
 * running-total formula identical to the stock ledgers.
 */
export declare function buildGoldPosting(rule: GoldPostingRule, weightG: Numeric, cost: Numeric): GoldPosting;
export interface ApArGoldSummary {
    startG: Decimal;
    netMovementG: Decimal;
    totalG: Decimal;
    /** ນ້ຳໜັກບາດຄຳ = g / 15 */
    totalBaht: Decimal;
}
/**
 * AR_Total = AR_Start + AR_Net_Movement (and the same for AP) — TOR §8.1.
 */
export declare function summariseGoldApAr(startG: Numeric, increasesG: Numeric, decreasesG: Numeric): ApArGoldSummary;
/**
 * ຍອດປັດຈຸບັນ = ຍອດຍົກມາ + AP(GOLD)(+) − AP(GOLD)(-)  — TOR §8.2, per partner.
 */
export declare function partnerBalance(broughtForwardG: Numeric, increasesG: Numeric, decreasesG: Numeric): Decimal;
/**
 * What produced a cash-side posting. Recording the reason lets a balance be
 * explained line by line, and lets a posting be reversed precisely if the
 * underlying transaction is voided.
 */
export type CashApArReason = 'LABOR_PAYABLE' | 'LABOR_PAYMENT' | 'CREDIT_ISSUED' | 'CREDIT_RECEIPT' | 'MANUAL_AP' | 'MANUAL_AP_PAYMENT' | 'MANUAL_AR' | 'MANUAL_AR_RECEIPT' | 'ADJUSTMENT';
export interface CashApArPosting {
    side: ApArSide;
    reason: CashApArReason;
    currency: Currency;
    amountIn: Decimal;
    amountOut: Decimal;
}
export declare function buildCashPosting(reason: CashApArReason, currency: Currency, amount: Numeric, 
/** Overrides the table for ADJUSTMENT, which can go either way. */
override?: {
    side: ApArSide;
    sign: 1 | -1;
}): CashApArPosting;
export interface CashApArNet {
    opening: Decimal;
    increases: Decimal;
    decreases: Decimal;
    /** ຍອດສຸດທິ = ຍອດຕັ້ງຕົ້ນ + ຍອດເພີ່ມ − ຍອດຫຼຸດ */
    net: Decimal;
}
/**
 * AP Net = AP ຍອດຕັ້ງຕົ້ນ + AP(+) − AP(-)   (TOR §9.2)
 * AR Net = AR ຍອດຕັ້ງຕົ້ນ + AR(+) − AR(-)
 */
export declare function netCashApAr(opening: Numeric, increases: Numeric, decreases: Numeric): CashApArNet;
/**
 * Rollover Rule (TOR §9.2): ເມື່ອສິ້ນສຸດມື້ ຍອດສຸດທິທ້າຍມື້ຈະຖືກຍົກໄປເປັນ
 * ຍອດຕັ້ງຕົ້ນ ຂອງມື້ທັດໄປອັດໂນມັດ.
 *
 * Trivial by itself, but naming it keeps the day-close job honest: the
 * opening of day N+1 is defined as the closing of day N and nothing else.
 */
export declare function rollover(closingNet: Numeric): Decimal;
export interface CohCashInput {
    cash: Numeric;
    bcel: Numeric;
    ldb: Numeric;
    otherBank: Numeric;
    ap: Numeric;
    ar: Numeric;
    /**
     * ເງິນມັດຈໍາ Order ຮັບລ່ວງໜ້າ that has not yet been discharged.
     * Subtracted because the shop is holding it for a customer against an
     * order it has not delivered — it is in the drawer but not the shop's.
     */
    advance?: Numeric;
}
/**
 * COH Cash = Cash + BCEL + LDB + Other Bank − AP + AR − Advance
 * (per currency, TOR §3.7).
 */
export declare function cashOnHand(input: CohCashInput): Decimal;
/**
 * ຍອດ Advance ສຸດທິ = ຍອດຮັບລ່ວງໜ້າ − ຍອດທີ່ຕັດຊຳຣະແລ້ວ (TOR §7).
 *
 * Named rather than inlined so the Advance dashboard, COH and the Order
 * settlement all agree on what "outstanding advance" means.
 */
export declare function netAdvance(increases: Numeric, decreases: Numeric): Decimal;
export interface CohGoldInput {
    newG: Numeric;
    oldG: Numeric;
    apG: Numeric;
    arG: Numeric;
}
/** COH Gold = Gold NEW(g) + Gold OLD(g) − AP + AR. */
export declare function goldOnHand(input: CohGoldInput): {
    weightG: Decimal;
    baht: Decimal;
};
export interface WealthInput {
    totalLak: Numeric;
    totalThb: Numeric;
    totalUsd: Numeric;
    thbSellRate: Numeric;
    usdSellRate: Numeric;
    /** ລາຄາຂາຍ 1 ບາດ, for the gold-equivalent weight. */
    price1Baht: Numeric;
}
export interface Wealth {
    totalLak: Decimal;
    /** ນ້ຳໜັກ (g) = (ລວມ LAK / ລາຄາຂາຍ 1 ບາດ) × 15 */
    weightG: Decimal;
    baht: Decimal;
}
/**
 * TOR §3.7 Module Wealth — total holdings expressed in LAK and then as the
 * weight of gold they would buy at today's price.
 */
export declare function calculateWealth(input: WealthInput): Wealth;
export interface GoldTypeAverage {
    perGram: Decimal | null;
    perBaht: Decimal | null;
    /** Set when the divisor was zero or negative, explaining the null. */
    messageLo: string | null;
}
/**
 * TOR §4.3 averages.
 *
 *   ຄຳດີ / ຫຍຸບ / ແທ່ງ : ສະເລ່ຍ(g) = ລວມເງິນທີ່ຕ້ອງຈ່າຍ / (ລວມນ້ຳໜັກຄຳເກົ່າ − ລວມນ້ຳໜັກຄຳໃໝ່)
 *   ຄຳຕົ້ມ            : ສະເລ່ຍ(g) = ລວມເງິນທີ່ຕ້ອງຈ່າຍ / ລວມນ້ຳໜັກຄຳເກົ່າ
 *   ສະເລ່ຍ ບາດ        = ສະເລ່ຍ(g) × 15
 *
 * TODO(TOR-6): for the first formula the divisor is zero whenever an exchange
 * balances — which §5.2 REQUIRES it to — and negative when more new gold goes
 * out than old gold comes in. Rather than emit Infinity or a negative average
 * into a financial report, this returns null with a Lao explanation for the
 * UI to render as "—". Confirm the intended divisor with the shop.
 */
export declare function goldTypeAverage(totalPaid: Numeric, totalOldWeightG: Numeric, totalNewWeightG: Numeric, isBoiled?: boolean): GoldTypeAverage;
//# sourceMappingURL=apar.d.ts.map