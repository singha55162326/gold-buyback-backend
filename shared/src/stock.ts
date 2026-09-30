import { dec, trimTrailingZeros, type Decimal, type Numeric } from './decimal.js';
import { truncate } from './rounding.js';
import { GRAMS_PER_BAHT } from './constants.js';

/* ------------------------------------------------------------------ *
 * TOR §7.1 / §7.2 — Stock (NEW) ແລະ Stock (OLD) running ledgers
 * TOR §3.7      — WAC ປັດຈຸບັນ
 * ------------------------------------------------------------------ */

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
export function accumulateLedger(
  movements: LedgerMovement[],
  opening: LedgerOpening = {},
): LedgerRow[] {
  let weightG = dec(opening.weightG ?? 0);
  let cost = dec(opening.cost ?? 0);

  return movements.map((movement, index) => {
    weightG = weightG.plus(dec(movement.goldInG ?? 0)).minus(dec(movement.goldOutG ?? 0));
    cost = cost.plus(dec(movement.priceIn ?? 0)).minus(dec(movement.priceOut ?? 0));
    return { ...movement, weightG, cost, sequence: index + 1 };
  });
}

/** The closing figures of a ledger — what rolls over to tomorrow's opening. */
export function ledgerClosing(rows: LedgerRow[], opening: LedgerOpening = {}): {
  weightG: Decimal;
  cost: Decimal;
} {
  const last = rows[rows.length - 1];
  return last
    ? { weightG: last.weightG, cost: last.cost }
    : { weightG: dec(opening.weightG ?? 0), cost: dec(opening.cost ?? 0) };
}

/* ------------------------------------------------------------------ *
 * §7.1 Ready to Gold — per-SKU daily counts
 * ------------------------------------------------------------------ */

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
export function skuBalance(input: SkuBalanceInput): SkuBalance {
  const balanceQty = dec(input.openingQty).plus(dec(input.inQty)).minus(dec(input.outQty));
  return { balanceQty, totalWeightG: balanceQty.mul(dec(input.weightG)) };
}

/* ------------------------------------------------------------------ *
 * §7.2 Stock (OLD) per-ປະເພດຄຳ balances
 * ------------------------------------------------------------------ */

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
export function typeBalance(input: TypeBalanceInput): TypeBalance {
  const closingWeightG = dec(input.openingWeightG).plus(dec(input.inG)).minus(dec(input.outG));
  const closingCost = dec(input.openingCost).plus(dec(input.priceIn)).minus(dec(input.priceOut));

  const pricePerG = closingWeightG.isZero()
    ? dec(0)
    : truncate(closingCost.div(closingWeightG), 0);

  return {
    closingWeightG,
    closingCost,
    pricePerG,
    pricePerBaht: pricePerG.mul(GRAMS_PER_BAHT),
  };
}

/* ------------------------------------------------------------------ *
 * §3.7 WAC — Weighted Average Cost
 * ------------------------------------------------------------------ */

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
export function calculateWac(input: WacInput): Wac {
  const totalWeightG = dec(input.newWeightG).plus(dec(input.oldWeightG));
  const totalCost = dec(input.newCost).plus(dec(input.oldCost));
  const pricePerG = totalWeightG.isZero() ? dec(0) : totalCost.div(totalWeightG);

  return {
    totalWeightG,
    totalCost,
    pricePerG,
    pricePerBaht: pricePerG.mul(GRAMS_PER_BAHT),
  };
}

/* ------------------------------------------------------------------ *
 * Movement validation
 * ------------------------------------------------------------------ */

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
export function checkStockOut(availableG: Numeric, requestedG: Numeric): StockOutCheck {
  const available = dec(availableG);
  const requested = dec(requestedG);
  const shortfall = requested.minus(available);

  if (shortfall.lte(0)) {
    return { allowed: true, availableG: available, requestedG: requested, shortfallG: dec(0), messageLo: null };
  }

  const amount = trimTrailingZeros(shortfall.toDecimalPlaces(4).toFixed());
  return {
    allowed: false,
    availableG: available,
    requestedG: requested,
    shortfallG: shortfall,
    messageLo: `ນ້ຳໜັກສົ່ງອອກເກີນຍອດຄົງເຫຼືອ ${amount} g — ບໍ່ສາມາດດຳເນີນການໄດ້`,
  };
}

/**
 * ນ້ຳໜັກ(g) ທີ່ໄດ້ຮັບ = ROUNDUP(ລວມ GOLD(g) × %ຄຳ, 0)  — TOR §7.2 OUT ກໍລະນີ 1.
 *
 * ROUNDUP so the smith is held to the higher figure; any shortfall on return
 * shows up as an AR (GOLD) discrepancy rather than being absorbed silently.
 */
export function expectedReturnWeight(totalGoldG: Numeric, goldPercent: Numeric): Decimal {
  const raw = dec(totalGoldG).mul(dec(goldPercent).div(100));
  return raw.isZero() ? dec(0) : raw.ceil();
}

/** GOLD (g) = weight_g × ຈຳນວນ — used by every movement line form. */
export function lineGoldWeight(weightG: Numeric, quantity: Numeric): Decimal {
  return dec(weightG).mul(dec(quantity));
}

/** ຕົ້ນທຶນຄຳ = GOLD (g) × ລາຄາ/g */
export function lineCost(goldG: Numeric, pricePerG: Numeric): Decimal {
  return dec(goldG).mul(dec(pricePerG));
}

/** ລາຄາ/ບາດ = ລາຄາ/g × 15 */
export function pricePerBaht(pricePerG: Numeric): Decimal {
  return dec(pricePerG).mul(GRAMS_PER_BAHT);
}

/** ບາດຄຳ = g / 15 */
export function gramsToBaht(weightG: Numeric): Decimal {
  return dec(weightG).div(GRAMS_PER_BAHT);
}
