import DecimalJs from 'decimal.js';
/**
 * A configured Decimal constructor used by every calculation in this package.
 *
 * Money and weight in this system are NEVER represented as a JS `number`.
 * A single float rounding error in ລາຄາຂາຍ 1 ບາດ propagates into buyback,
 * exchange validation, WAC and AP/AR, so all arithmetic goes through Decimal.
 *
 * `precision: 34` matches the headroom of DECIMAL(18,4) storage (TOR §10)
 * with room to spare for intermediate division steps such as `/40 * 3`.
 */
export declare const Decimal: typeof DecimalJs;
export type Decimal = InstanceType<typeof Decimal>;
/** Anything that can be coerced into a Decimal. */
export type Numeric = Decimal | DecimalJs | number | string;
/** Coerce a supported input into a Decimal. */
export declare function dec(value: Numeric): Decimal;
/** Convenience zero. */
export declare const ZERO: Decimal;
/**
 * Drop trailing zeros from a fixed-point string, but only ones that sit after
 * a decimal point: "1.50" -> "1.5", "1.00" -> "1", "10" -> "10".
 *
 * The obvious `/\.?0+$/` also eats the zero in "10", because `\.?` is
 * optional — which silently turned a 150 g (10 ບາດ) SKU into "1 ບາດ" and
 * under-reported stock shortfalls by a factor of ten.
 */
export declare function trimTrailingZeros(text: string): string;
//# sourceMappingURL=decimal.d.ts.map