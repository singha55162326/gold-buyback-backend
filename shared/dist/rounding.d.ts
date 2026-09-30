import { Decimal, type Numeric } from './decimal.js';
/**
 * Excel ROUND — nearest, ties away from zero.
 * `round(11_462_500, -4)` -> 11_460_000
 */
export declare function round(value: Numeric, digits?: number): Decimal;
/**
 * Excel ROUNDUP — always away from zero.
 * `roundUp(3_170_000, -3)` -> 3_170_000 ; `roundUp(3_170_001, -3)` -> 3_171_000
 */
export declare function roundUp(value: Numeric, digits?: number): Decimal;
/**
 * Excel ROUNDDOWN — always toward zero (truncate at `digits`).
 * `roundDown(3_014_666.67, -3)` -> 3_014_000
 */
export declare function roundDown(value: Numeric, digits?: number): Decimal;
/**
 * Excel CEILING(number, significance) — away from zero to the nearest
 * multiple of `significance`.
 *
 * Used by TOR §5.1 to bill part-baht weights as whole 15 g units:
 * `ceilingTo(20, 15)` -> 30 ; `ceilingTo(1.33, 1)` -> 2
 *
 * `significance` of zero returns zero, matching Excel.
 */
export declare function ceilingTo(value: Numeric, significance: Numeric): Decimal;
/**
 * Excel FLOOR(number, significance) — toward zero to the nearest multiple.
 */
export declare function floorTo(value: Numeric, significance: Numeric): Decimal;
/**
 * True when `value` divides evenly by `divisor` — TOR §5.1 "ຫານ 15 ລົງໂຕ".
 */
export declare function isMultipleOf(value: Numeric, divisor: Numeric): boolean;
/**
 * Truncate toward zero at `dp` decimal places without any rounding —
 * TOR §7.2 "ຕັດເສດຫຼັງຈຸດ" when deriving ລາຄາ/g from a gold-type cost.
 */
export declare function truncate(value: Numeric, dp?: number): Decimal;
//# sourceMappingURL=rounding.d.ts.map