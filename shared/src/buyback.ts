import { dec, type Decimal, type Numeric } from './decimal.js';
import { ceilingTo, floorTo, isMultipleOf, roundDown } from './rounding.js';
import { GRAMS_PER_BAHT } from './constants.js';

/* ------------------------------------------------------------------ *
 * TOR §5.1 — ລາຄາຊື້ຄືນໜ້າຮ້ານ ແລະ ລາຄາທີ່ຕ້ອງຈ່າຍ
 *
 * Counter buyback, split by where the gold came from:
 *   ກໍລະນີ 1 — ຄຳຮ້ານ KPV      (ຄຳດີ / ຄຳຫຍຸບ / ຄຳແທ່ງ)
 *   ກໍລະນີ 2 — ຄຳຮ້ານອື່ນ       (ຄຳຕົ້ມ, priced by %ຄຳ)
 * ------------------------------------------------------------------ */

/** The four ປະເພດຄຳ that can be bought back over the counter. */
export type BuybackGoldKind = 'GOOD' | 'HUMP' | 'BAR' | 'BOILED';

/**
 * One row of the weight -> price lookup the TOR calls PriceByMatch,
 * PriceMatchExact or PriceMatch depending on the branch.
 *
 * Settled against the shop's workbook: all three names are the SAME data —
 * the buyback price column of the price board, keyed by the printed weight
 * (Produets column B: 15, 7.5, 3.75, 1.87, 1.12, 0.75, 0.37). What differs
 * between them is only the match mode:
 *
 *   PriceByMatch      (ຄຳດີ)   exact weight, else nothing
 *   PriceMatchExact   (ຄຳຫຍຸບ) smallest tier AT OR ABOVE the weight
 *   PriceMatch        (ຄຳແທ່ງ) exact weight in the bar table
 *
 * Note the key is the printed 1.87, not the 1.875 that keys the ຄ່າປ່ຽນ table.
 */
export interface PriceTableEntry {
  tierCode: string;
  /** ນ້ຳໜັກປ່ຽນເປັນເງິນ — the exact weight, e.g. 1.875 not 1.87. */
  weightG: Decimal;
  buybackPrice: Decimal;
}

export interface BuybackPriceSource {
  /**
   * ລາຄາຊື້ຄືນ 1 ບາດ for this kind of gold.
   *
   * The TOR writes only "Price1Baht"; the workbook resolves it to the BUYBACK
   * 1-baht price, which is what the shop pays out — the jewellery one for
   * ຄຳດີ / ຄຳຫຍຸບ / ຄຳຕົ້ມ, the bar one for ຄຳແທ່ງ.
   */
  price1BahtFor(kind: BuybackGoldKind): Decimal;
  /** Exact weight match in the relevant price table; null when absent. */
  lookup(kind: BuybackGoldKind, weightG: Decimal): Decimal | null;
}

export interface BuybackInput {
  kind: BuybackGoldKind;
  weightG: Numeric;
  quantity: Numeric;
  /** %ຄຳ in percent units (96 means 96%). ຄຳຕົ້ມ only. */
  goldPercent?: Numeric;
  /** ຄ່າອ່ອນ / ຄ່າຫັກ deducted per piece before multiplying by quantity. */
  deduction?: Numeric;
}

export interface BuybackResult {
  /** ລາຄາຊື້ຄືນໜ້າຮ້ານ — the price for ONE piece. */
  shopBuybackPrice: Decimal;
  /** ຄ່າຫັກ/ຄ່າອ່ອນ applied per piece. */
  deduction: Decimal;
  /** ລາຄາທີ່ຕ້ອງຈ່າຍ — the total across `quantity`. */
  payableAmount: Decimal;
  /**
   * Which branch of §5.1 produced the number. Surfaced in the UI and the
   * audit log so a disputed price can be traced without re-deriving it.
   */
  branch: string;
}

/**
 * Build a lookup table from a price board's buyback column.
 * `weightG` must be the tier's exchange weight (1.875), not its display
 * weight (1.87), or exact matches will silently miss.
 */
export function makePriceTable(entries: PriceTableEntry[]): PriceTableEntry[] {
  return [...entries].sort((a, b) => b.weightG.comparedTo(a.weightG));
}

/** Exact-weight lookup used by all three of the TOR's named tables. */
export function lookupExact(table: PriceTableEntry[], weightG: Decimal): Decimal | null {
  const hit = table.find((entry) => entry.weightG.eq(weightG));
  return hit ? hit.buybackPrice : null;
}

/**
 * PriceMatchExact — the smallest tier weight at or above `weightG`.
 *
 * This is Excel's `MATCH(w, tiers, -1)` against a descending list, and it is
 * what makes a slightly-light piece priceable at all: 14.99 g of ຄຳຫຍຸບ is
 * quoted at the 15 g price, and the shortfall comes off separately as ຄ່າອ່ອນ.
 * An exact match here would find nothing and pay the customer zero.
 */
export function lookupAtLeast(
  table: PriceTableEntry[],
  weightG: Decimal,
): PriceTableEntry | null {
  let best: PriceTableEntry | null = null;
  for (const entry of table) {
    if (entry.weightG.gte(weightG) && (best === null || entry.weightG.lt(best.weightG))) {
      best = entry;
    }
  }
  return best;
}

/**
 * ລາຄາຊື້ຄືນໜ້າຮ້ານ — ກໍລະນີ 1, ຄຳຮ້ານ KPV (TOR §5.1).
 *
 * The TOR is explicit that any error or missing weight yields 0 rather than
 * throwing, so a mistyped weight can never quietly become a large payout.
 */
export function shopBuybackPriceKpv(
  kind: Exclude<BuybackGoldKind, 'BOILED'>,
  weightG: Numeric,
  source: BuybackPriceSource,
  table: PriceTableEntry[],
): { price: Decimal; branch: string } {
  const w = dec(weightG);
  if (!w.isFinite() || w.lte(0)) return { price: dec(0), branch: 'ນ້ຳໜັກເປັນ 0' };

  const price1Baht = source.price1BahtFor(kind);

  switch (kind) {
    // 2.1 ຄໍາດີ
    case 'GOOD': {
      if (isMultipleOf(w, GRAMS_PER_BAHT)) {
        return {
          price: w.div(GRAMS_PER_BAHT).mul(price1Baht),
          branch: 'ຄຳດີ — ຫານ 15 ລົງໂຕ',
        };
      }
      // PriceByMatch: an exact tier weight, or nothing. The workbook does not
      // decompose a part-baht piece into whole baht plus a remainder — a
      // weight that is neither a multiple of 15 nor a listed tier is refused
      // (its IFERROR yields 0) rather than priced by a rule nobody agreed to.
      const exact = source.lookup(kind, w);
      return exact === null
        ? { price: dec(0), branch: 'ຄຳດີ — ບໍ່ຕົງຕາຕະລາງ ແລະ ຫານ 15 ບໍ່ລົງໂຕ' }
        : { price: exact, branch: 'ຄຳດີ — PriceByMatch (ຕົງກັບຕາຕະລາງ)' };
    }

    // 2.2 ຄໍາຫຍຸບ
    case 'HUMP': {
      if (w.gt(GRAMS_PER_BAHT)) {
        // ປັດເສດຂຶ້ນໃຫ້ເປັນຈຳນວນເຕັມ 15 ບາດ ແລ້ວຄູນ Price1Baht
        const wholeBaht = ceilingTo(w, GRAMS_PER_BAHT).div(GRAMS_PER_BAHT);
        return { price: wholeBaht.mul(price1Baht), branch: 'ຄຳຫຍຸບ — CEILING ເປັນບາດເຕັມ' };
      }
      const tier = lookupAtLeast(table, w);
      return tier === null
        ? { price: dec(0), branch: 'ຄຳຫຍຸບ — ບໍ່ພົບໃນ PriceMatchExact' }
        : { price: tier.buybackPrice, branch: 'ຄຳຫຍຸບ — PriceMatchExact (ຂັ້ນທີ່ ≥ ນ້ຳໜັກ)' };
    }

    // 2.3 ຄໍາແທ່ງ
    case 'BAR': {
      if (w.gte(GRAMS_PER_BAHT)) {
        // A bar that is not a whole number of baht cannot be priced at all.
        if (!isMultipleOf(w, GRAMS_PER_BAHT)) {
          return { price: dec(0), branch: 'ຄຳແທ່ງ — ຫານ 15 ບໍ່ລົງໂຕ' };
        }
        return {
          price: w.div(GRAMS_PER_BAHT).mul(price1Baht),
          branch: 'ຄຳແທ່ງ — ຫານ 15 ລົງໂຕ',
        };
      }
      const exact = source.lookup(kind, w);
      return exact === null
        ? { price: dec(0), branch: 'ຄຳແທ່ງ — ບໍ່ພົບໃນ PriceMatch' }
        : { price: exact, branch: 'ຄຳແທ່ງ — PriceMatch' };
    }
  }
}

/**
 * ລາຄາຊື້ຄືນໜ້າຮ້ານ — ກໍລະນີ 2, ຄຳຮ້ານອື່ນ / ຄຳຕົ້ມ (TOR §5.1).
 */
export function shopBuybackPriceBoiled(
  weightG: Numeric,
  source: BuybackPriceSource,
  table: PriceTableEntry[],
): { price: Decimal; branch: string } {
  const w = dec(weightG);
  if (!w.isFinite() || w.lte(0)) return { price: dec(0), branch: 'ນ້ຳໜັກເປັນ 0' };

  const price1Baht = source.price1BahtFor('BOILED');

  if (w.gt(GRAMS_PER_BAHT)) {
    // CEILING(ນ້ຳໜັກ/15, 1) * Price1Baht — written literally as in the TOR.
    return {
      price: ceilingTo(w.div(GRAMS_PER_BAHT), 1).mul(price1Baht),
      branch: 'ຄຳຕົ້ມ — CEILING(ນ້ຳໜັກ/15, 1)',
    };
  }

  // Same descending match as ຄຳຫຍຸບ: the workbook prices ຄຳຕົ້ມ at the
  // smallest tier that covers the weight (ຄຳຮ້ານອື່ນ!F10).
  const tier = lookupAtLeast(table, w);
  return tier === null
    ? { price: dec(0), branch: 'ຄຳຕົ້ມ — ບໍ່ພົບໃນ PriceMatch' }
    : { price: tier.buybackPrice, branch: 'ຄຳຕົ້ມ — PriceMatch (ຂັ້ນທີ່ ≥ ນ້ຳໜັກ)' };
}

/**
 * ລາຄາທີ່ຕ້ອງຈ່າຍ for ຄຳຕົ້ມ (TOR §5.1 ກໍລະນີ 2):
 *
 *   ((ນ້ຳໜັກ × ລາຄາຊື້ຄືນໜ້າຮ້ານ) / CEILING(ນ້ຳໜັກ, 15)) × %ຄຳ
 *     -> ROUNDDOWN(..., -3) -> × ຈຳນວນຊິ້ນ
 *
 * ROUNDDOWN, not ROUND: on gold of unverified purity the shop rounds in its
 * own favour.
 */
export function payableBoiled(
  weightG: Numeric,
  shopPrice: Numeric,
  goldPercent: Numeric,
  quantity: Numeric,
): Decimal {
  const w = dec(weightG);
  if (!w.isFinite() || w.lte(0)) return dec(0);

  const denominator = ceilingTo(w, GRAMS_PER_BAHT);
  if (denominator.isZero()) return dec(0);

  const perPiece = w
    .mul(dec(shopPrice))
    .div(denominator)
    .mul(dec(goldPercent).div(100));

  return roundDown(perPiece, -3).mul(dec(quantity));
}

/**
 * The whole §5.1 calculation for one buyback line.
 *
 * ລາຄາທີ່ຕ້ອງຈ່າຍ = (ລາຄາຕາມປະເພດຄຳ − ຄ່າຫັກ/ຄ່າອ່ອນ) × ຈຳນວນ
 * A negative result is clamped to zero — the shop never charges a customer
 * to take gold off them.
 */
export function calculateBuyback(
  input: BuybackInput,
  source: BuybackPriceSource,
  table: PriceTableEntry[],
): BuybackResult {
  const quantity = dec(input.quantity);
  const deduction = dec(input.deduction ?? 0);

  if (input.kind === 'BOILED') {
    const { price, branch } = shopBuybackPriceBoiled(input.weightG, source, table);
    const payable = payableBoiled(
      input.weightG,
      price,
      input.goldPercent ?? 0,
      quantity,
    );
    return {
      shopBuybackPrice: price,
      deduction: dec(0),
      payableAmount: payable.isNegative() ? dec(0) : payable,
      branch,
    };
  }

  const { price, branch } = shopBuybackPriceKpv(input.kind, input.weightG, source, table);
  const perPiece = price.minus(deduction);
  const payable = perPiece.isNegative() ? dec(0) : perPiece.mul(quantity);

  return { shopBuybackPrice: price, deduction, payableAmount: payable, branch };
}
