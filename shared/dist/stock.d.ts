import { type Decimal, type Numeric } from './decimal.js';
/** A single movement before its running totals are known. */
export interface LedgerMovement {
    goldInG?: Numeric;
    goldOutG?: Numeric;
    priceIn?: Numeric;
    priceOut?: Numeric;
}
/** The same movement with the accumulated columns filled in. */
export interface LedgerRow extends LedgerMovement {
    /** Running total weight after this row. */
    weightG: Decimal;
    /** Running total cost after this row. */
    cost: Decimal;
    sequence: number;
}
export interface LedgerOpening {
    weightG?: Numeric;
    cost?: Numeric;
}
/**
 * The running-column contract shared by Stock (NEW) §7.1, Stock (OLD) §7.2
 * and AP/AR (GOLD) §8.2:
 *
 *   WEIGHT  = previous WEIGHT  + GOLD(g) IN − GOLD(g) OUT
 *   ຕົ້ນທຶນ  = previous ຕົ້ນທຶນ + PRICE (IN) − PRICE (OUT)
 *
 * All four ledgers in the TOR accumulate identically, so this is written once
 * and reused rather than reimplemented per module. The first row starts from
 * the opening balance, which on a new day is the previous day's closing.
 */
export declare function accumulateLedger(movements: LedgerMovement[], opening?: LedgerOpening): LedgerRow[];
/** The closing figures of a ledger — what rolls over to tomorrow's opening. */
export declare function ledgerClosing(rows: LedgerRow[], opening?: LedgerOpening): {
    weightG: Decimal;
    cost: Decimal;
};
export interface SkuBalanceInput {
    openingQty: Numeric;
    inQty: Numeric;
    outQty: Numeric;
    /** The SKU's unit weight, used for ນ້ຳໜັກ g ລວມ. */
    weightG: Numeric;
}
export interface SkuBalance {
    balanceQty: Decimal;
    totalWeightG: Decimal;
}
/**
 * Balance = ຈຳນວນຕັ້ງຕົ້ນ + IN − OUT (TOR §7.1).
 * On a new business day today's Balance becomes tomorrow's ຈຳນວນຕັ້ງຕົ້ນ.
 */
export declare function skuBalance(input: SkuBalanceInput): SkuBalance;
export interface TypeBalanceInput {
    openingWeightG: Numeric;
    openingCost: Numeric;
    inG: Numeric;
    outG: Numeric;
    priceIn: Numeric;
    priceOut: Numeric;
}
export interface TypeBalance {
    closingWeightG: Decimal;
    closingCost: Decimal;
    /** ລາຄາ/g derived from this type's own cost and weight. */
    pricePerG: Decimal;
    pricePerBaht: Decimal;
}
/**
 * ນໍ້າໜັກ(g) ຄົງເຫຼືອ = ຕັ້ງຕົ້ນ + GOLD(g) IN − GOLD(g) OUT
 * ຕົ້ນທຶນຄົງເຫຼືອ      = ຕົ້ນທຶນຕັ້ງຕົ້ນ + PRICE (IN) − PRICE (OUT)
 *
 * §7.2 specifies ລາຄາ/g as "ຕົ້ນທຶນປະເພດຄຳ / ນ້ຳໜັກ g ປະເພດຄຳ ຕັດເສດຫຼັງຈຸດ" —
 * truncated, not rounded, so a Stock OUT can never be costed at more than the
 * stock actually holds.
 */
export declare function typeBalance(input: TypeBalanceInput): TypeBalance;
export interface WacInput {
    newWeightG: Numeric;
    newCost: Numeric;
    oldWeightG: Numeric;
    oldCost: Numeric;
}
export interface Wac {
    totalWeightG: Decimal;
    totalCost: Decimal;
    pricePerG: Decimal;
    pricePerBaht: Decimal;
}
/**
 * ລວມ GOLD(g) = NEW GOLD(g) + OLD GOLD(g)
 * ລວມຕົ້ນທຶນ  = NEW ຕົ້ນທຶນ + OLD ຕົ້ນທຶນ
 * ລາຄາ/g     = ລວມຕົ້ນທຶນ / ລວມ GOLD(g)
 * ລາຄາ/ບາດ   = ລາຄາ/g × 15
 *
 * Zero stock yields zero rather than NaN — an empty vault is a normal state
 * at the start of a day, not an error.
 */
export declare function calculateWac(input: WacInput): Wac;
export interface StockOutCheck {
    allowed: boolean;
    availableG: Decimal;
    requestedG: Decimal;
    shortfallG: Decimal;
    messageLo: string | null;
}
/**
 * TOR §7.2: TOTAL (ລວມນໍ້າໜັກg ສົ່ງອອກ) ຕ້ອງ ≤ ນໍ້າໜັກg ທີ່ມີຢູ່ຈິງ
 * ຕາມປະເພດຄຳທີ່ເລືອກ. ຖ້າເກີນ ລະບົບຕ້ອງ Alert ແລະ ບໍ່ອະນຸຍາດໃຫ້ດຳເນີນການ.
 */
export declare function checkStockOut(availableG: Numeric, requestedG: Numeric): StockOutCheck;
/**
 * ນ້ຳໜັກ(g) ທີ່ໄດ້ຮັບ = ROUNDUP(ລວມ GOLD(g) × %ຄຳ, 0)  — TOR §7.2 OUT ກໍລະນີ 1.
 *
 * ROUNDUP so the smith is held to the higher figure; any shortfall on return
 * shows up as an AR (GOLD) discrepancy rather than being absorbed silently.
 */
export declare function expectedReturnWeight(totalGoldG: Numeric, goldPercent: Numeric): Decimal;
/** GOLD (g) = weight_g × ຈຳນວນ — used by every movement line form. */
export declare function lineGoldWeight(weightG: Numeric, quantity: Numeric): Decimal;
/** ຕົ້ນທຶນຄຳ = GOLD (g) × ລາຄາ/g */
export declare function lineCost(goldG: Numeric, pricePerG: Numeric): Decimal;
/** ລາຄາ/ບາດ = ລາຄາ/g × 15 */
export declare function pricePerBaht(pricePerG: Numeric): Decimal;
/** ບາດຄຳ = g / 15 */
export declare function gramsToBaht(weightG: Numeric): Decimal;
//# sourceMappingURL=stock.d.ts.map