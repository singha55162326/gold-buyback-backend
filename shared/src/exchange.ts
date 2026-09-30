import { Decimal, dec, trimTrailingZeros, type Numeric } from './decimal.js';

/* ------------------------------------------------------------------ *
 * TOR §5.2 — ລາຍການປ່ຽນເປັນເງິນ (Gold Exchange & Trade-in)
 * ------------------------------------------------------------------ */

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

const sum = (values: Decimal[]): Decimal =>
  values.reduce((total, value) => total.plus(value), dec(0));

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
export function softGoldFeeForLine(line: ExchangeOldLine, softGoldFee: Numeric): Decimal {
  const kind = line.goldKind ?? 'HUMP';
  if (kind !== 'HUMP') return dec(0);

  const standard = dec(line.standardWeightG);
  const actual = dec(line.weightG);
  const shortfall = standard.minus(actual);
  if (shortfall.lte(0)) return dec(0);

  return softGoldSteps(shortfall).mul(dec(softGoldFee)).mul(dec(line.quantity));
}

/**
 * How many 0.1 g steps a shortfall is billed at.
 *
 * ROUND to 3 then ROUNDDOWN to 2 before the CEILING is the workbook's own
 * order: it clears the floating-point dust that 30 − 29.89 leaves behind
 * before deciding which step the shortfall falls into.
 */
export function softGoldSteps(shortfallG: Numeric): Decimal {
  const s = dec(shortfallG);
  if (s.lte(0)) return dec(0);
  const settled = s.toDecimalPlaces(3).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  return settled.div('0.1').ceil();
}

/** Total weight of a set of lines: Σ weight × quantity. */
function totalWeight(
  lines: Array<{ weightG: Numeric; quantity: Numeric }>,
): Decimal {
  return sum(lines.map((l) => dec(l.weightG).mul(dec(l.quantity))));
}

/**
 * All §5.2 totals for one exchange.
 *
 * ລວມເງິນຕ້ອງຈ່າຍ = ລາຄາຊື້ຄືນໜ້າຮ້ານ − ຄ່າອ່ອນ − ຄ່າຫຍຸບ − ຄ່າປ່ຽນຄຳແທ່ງ − ຄ່າລາຍ
 *
 * On a ປ່ຽນຟຣີ the conversion fees are forced to zero regardless of what the
 * ຄ່າປ່ຽນ table says, so a free exchange cannot accidentally bill the customer.
 */
export function calculateExchange(input: ExchangeInput): ExchangeTotals {
  const isFree = input.txnType === 'FREE_EXCHANGE';

  const standardOldWeightG = sum(
    input.oldLines.map((l) => dec(l.standardWeightG).mul(dec(l.quantity))),
  );
  const actualOldWeightG = totalWeight(input.oldLines);
  const totalNewWeightG = totalWeight(input.newLines);
  const totalRemainingWeightG = totalWeight(input.remainingLines);

  const softGoldFee = sum(
    input.oldLines.map((l) => softGoldFeeForLine(l, input.softGoldFeePerGram)),
  );

  const humpFee = isFree
    ? dec(0)
    : sum(input.newLines.map((l) => dec(l.humpFee ?? 0).mul(dec(l.quantity))));

  const barConvertFee = isFree
    ? dec(0)
    : sum(input.newLines.map((l) => dec(l.barConvertFee ?? 0).mul(dec(l.quantity))));

  const patternFee = isFree
    ? dec(0)
    : sum(input.newLines.map((l) => dec(l.patternFee ?? 0).mul(dec(l.quantity))));

  const shopBuybackPrice = sum([
    ...input.oldLines.map((l) => dec(l.shopBuybackPrice ?? 0)),
    ...input.remainingLines.map((l) => dec(l.shopBuybackPrice ?? 0)),
  ]);

  const totalPayable = shopBuybackPrice
    .minus(softGoldFee)
    .minus(humpFee)
    .minus(barConvertFee)
    .minus(patternFee);

  return {
    standardOldWeightG,
    actualOldWeightG,
    totalNewWeightG,
    totalRemainingWeightG,
    softGoldFee,
    humpFee,
    barConvertFee,
    patternFee,
    shopBuybackPrice,
    totalPayable,
  };
}

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
export function validateExchangeBalance(totals: ExchangeTotals): ExchangeValidation {
  const accountedFor = totals.totalNewWeightG.plus(totals.totalRemainingWeightG);
  const difference = totals.standardOldWeightG.minus(accountedFor);

  if (difference.isZero()) {
    return { isBalanced: true, difference, messageLo: null };
  }

  const amount = trimTrailingZeros(difference.abs().toDecimalPlaces(4).toFixed());
  const messageLo = difference.isPositive()
    ? `ນ້ຳໜັກຍັງບໍ່ຄົບ ${amount} g — ລວມນ້ຳໜັກຄຳໃໝ່ + ຄຳເກົ່າຄົງເຫຼືອ ຕ້ອງເທົ່າກັບເກນນ້ຳໜັກຄຳເກົ່າ`
    : `ນ້ຳໜັກເກີນ ${amount} g — ລວມນ້ຳໜັກຄຳໃໝ່ + ຄຳເກົ່າຄົງເຫຼືອ ຫຼາຍກວ່າເກນນ້ຳໜັກຄຳເກົ່າ`;

  return { isBalanced: false, difference, messageLo };
}
