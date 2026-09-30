import DecimalJs from 'decimal.js';
import { Decimal, dec, type Numeric } from './decimal.js';

/**
 * Excel-compatible rounding primitives.
 *
 * The TOR specifies prices in terms of the spreadsheet functions the shop
 * already uses (ROUND, ROUNDUP, ROUNDDOWN, CEILING). These helpers reproduce
 * those exactly, including the sign handling, so a formula can be transcribed
 * from the TOR without reinterpretation.
 *
 * `digits` follows the Excel convention:
 *   digits =  2  -> nearest 0.01
 *   digits =  0  -> nearest whole number
 *   digits = -3  -> nearest 1,000   (ຫຼັກພັນ)
 *   digits = -4  -> nearest 10,000  (ຫຼັກໝື່ນ)
 */

function scale(digits: number): Decimal {
  return Decimal.pow(10, digits);
}

function applyAt(value: Numeric, digits: number, mode: DecimalJs.Rounding): Decimal {
  const factor = scale(digits);
  return dec(value).mul(factor).toDecimalPlaces(0, mode).div(factor);
}

/**
 * Excel ROUND — nearest, ties away from zero.
 * `round(11_462_500, -4)` -> 11_460_000
 */
export function round(value: Numeric, digits = 0): Decimal {
  return applyAt(value, digits, DecimalJs.ROUND_HALF_UP);
}

/**
 * Excel ROUNDUP — always away from zero.
 * `roundUp(3_170_000, -3)` -> 3_170_000 ; `roundUp(3_170_001, -3)` -> 3_171_000
 */
export function roundUp(value: Numeric, digits = 0): Decimal {
  return applyAt(value, digits, DecimalJs.ROUND_UP);
}

/**
 * Excel ROUNDDOWN — always toward zero (truncate at `digits`).
 * `roundDown(3_014_666.67, -3)` -> 3_014_000
 */
export function roundDown(value: Numeric, digits = 0): Decimal {
  return applyAt(value, digits, DecimalJs.ROUND_DOWN);
}

/**
 * Excel CEILING(number, significance) — away from zero to the nearest
 * multiple of `significance`.
 *
 * Used by TOR §5.1 to bill part-baht weights as whole 15 g units:
 * `ceilingTo(20, 15)` -> 30 ; `ceilingTo(1.33, 1)` -> 2
 *
 * `significance` of zero returns zero, matching Excel.
 */
export function ceilingTo(value: Numeric, significance: Numeric): Decimal {
  const sig = dec(significance);
  if (sig.isZero()) return dec(0);
  return dec(value).div(sig).toDecimalPlaces(0, DecimalJs.ROUND_UP).mul(sig);
}

/**
 * Excel FLOOR(number, significance) — toward zero to the nearest multiple.
 */
export function floorTo(value: Numeric, significance: Numeric): Decimal {
  const sig = dec(significance);
  if (sig.isZero()) return dec(0);
  return dec(value).div(sig).toDecimalPlaces(0, DecimalJs.ROUND_DOWN).mul(sig);
}

/**
 * True when `value` divides evenly by `divisor` — TOR §5.1 "ຫານ 15 ລົງໂຕ".
 */
export function isMultipleOf(value: Numeric, divisor: Numeric): boolean {
  const d = dec(divisor);
  if (d.isZero()) return false;
  return dec(value).mod(d).isZero();
}

/**
 * Truncate toward zero at `dp` decimal places without any rounding —
 * TOR §7.2 "ຕັດເສດຫຼັງຈຸດ" when deriving ລາຄາ/g from a gold-type cost.
 */
export function truncate(value: Numeric, dp = 0): Decimal {
  return dec(value).toDecimalPlaces(dp, DecimalJs.ROUND_DOWN);
}
