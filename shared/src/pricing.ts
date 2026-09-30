import { dec, type Decimal, type Numeric } from './decimal.js';
import { round, roundUp, roundDown } from './rounding.js';
import { TierCode, type TierMeta } from './constants.js';

/* ------------------------------------------------------------------ *
 * TOR §3.1 — ສູດຄິດໄລ່ລາຄາຂາຍ ແລະ ລາຄາຊື້ຄືນ
 *
 * Every price in the system derives from ONE input: ລາຄາຂາຍ 1 ບາດ
 * (the jewellery 1-baht sell price the shop sets each morning).
 * ------------------------------------------------------------------ */

/**
 * Tunable constants. The TOR values are the defaults; they live here rather
 * than inline so that a future "pricing settings" screen can override them
 * without touching the formulas.
 */
export interface PricingConfig {
  /** ຄ່າທໍານຽມ/ສ່ວນຫຼຸດພື້ນຖານ subtracted before the proportional split. */
  jewelryBaseDeduction: Numeric;
  /** ຊົດເຊີຍຄ່າຫຼໍ່/ຊ່າງ added inside A and B for the 3/2/1 ຫຸນ tiers. */
  smallTierSurcharge: Numeric;
  /** Flat amount added to D for 1 ສະຫຼຶງ / 5 ຫຸນ / 3 ຫຸນ / 2 ຫຸນ. */
  tierAdjustment: Numeric;
  /** Flat amount added to D for 1 ຫຸນ (higher craft margin on tiny pieces). */
  hun1Adjustment: Numeric;
  /**
   * The C threshold that means "do not round at all", and the bump applied
   * when the ROUND went downward. Both are 5,000 in the TOR.
   */
  roundingTie: Numeric;
  /** ຄຳແທ່ງ 1 ບາດ = ລາຄາຂາຍ 1 ບາດ minus this. */
  barBahtDiscount: Numeric;
  /** ຄຳແທ່ງ 1g = ROUNDUP(bar1Baht / 15 + this, -3). */
  barGramSurcharge: Numeric;
  /** ລາຄາຊື້ຄືນ ຄຳແທ່ງ 1 ບາດ = ລາຄາຂາຍ ຄຳແທ່ງ 1 ບາດ minus this. */
  barBuybackDiscount: Numeric;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  jewelryBaseDeduction: 9_000,
  smallTierSurcharge: 30_000,
  tierAdjustment: 4_000,
  hun1Adjustment: 14_000,
  roundingTie: 5_000,
  barBahtDiscount: 109_000,
  barGramSurcharge: 120_000,
  barBuybackDiscount: 530_000,
};

/**
 * The four intermediate values the TOR names explicitly. They are returned
 * alongside every jewellery price so the Set Pricing screen can show the shop
 * owner exactly how a number was reached, and so any discrepancy against the
 * old spreadsheet can be traced to a single step.
 */
export interface RoundingSteps {
  /** A — ລາຄາຕົ້ນທຶນ/ລາຄາຕາມສັດສ່ວນແທ້. */
  a: Decimal;
  /** B — A rounded to the nearest 10,000, or the tier's own expression. */
  b: Decimal;
  /** C — B minus A: the direction and size of the rounding. */
  c: Decimal;
  /** D — ລາຄາຫຼັງປັບເງື່ອນໄຂ. */
  d: Decimal;
  /** D plus the tier adjustment: the price actually charged. */
  final: Decimal;
}

/**
 * TOR §3.1 rule D:
 *   C = 5,000  -> use A (the ROUND landed exactly on a tie; keep the raw value)
 *   C >= 0     -> use B (we rounded up)
 *   C <  0     -> use B + 5,000 (we rounded down, so add the half-step back)
 */
function resolveD(a: Decimal, b: Decimal, cfg: PricingConfig): RoundingSteps {
  const tie = dec(cfg.roundingTie);
  const c = b.minus(a);
  let d: Decimal;
  if (c.eq(tie)) d = a;
  else if (c.gte(0)) d = b;
  else d = b.plus(tie);
  return { a, b, c, d, final: d };
}

function withAdjustment(steps: RoundingSteps, adjustment: Numeric): RoundingSteps {
  return { ...steps, final: steps.d.plus(dec(adjustment)) };
}

export interface JewelrySellResult {
  /** Final ລາຄາຂາຍ per tier. */
  prices: Record<string, Decimal>;
  /** Per-tier A/B/C/D breakdown; absent for 1 ບາດ and 2 ສະຫຼຶງ, which are direct. */
  steps: Partial<Record<string, RoundingSteps>>;
}

/**
 * ສູດຄິດໄລ່ ລາຄາຂາຍ ຮູບປະພັນ (TOR §3.1).
 *
 * Verified against the TOR sample table at ລາຄາຂາຍ 1 ບາດ = 45,859,000:
 *   1 ສະຫຼຶງ 11,469,000 · 2 ສະຫຼຶງ 22,938,000 · 5 ຫຸນ 5,739,000
 *   3 ຫຸນ 3,479,000 · 2 ຫຸນ 2,329,000 · 1 ຫຸນ 1,194,000
 *
 * Two details are easy to get wrong and are deliberate here:
 *  1. The 3/2/1 ຫຸນ tiers derive A from the 5 ຫຸນ **D value** — the price
 *     before its +4,000 adjustment — not from its final published price.
 *  2. Those tiers compute B from an independent expression based on
 *     ລາຄາຂາຍ 1 ບາດ. B is NOT round(A, -4) as it is for the larger tiers.
 */
export function computeJewelrySellPrices(
  price1Baht: Numeric,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): JewelrySellResult {
  const cfg = config;
  const p1 = dec(price1Baht);
  const base = p1.minus(dec(cfg.jewelryBaseDeduction)); // (ລາຄາຂາຍ 1 ບາດ - 9,000)
  const surcharge = dec(cfg.smallTierSurcharge);

  // 1 ສະຫຼຶງ : A = base / 4
  const saleung1A = base.div(4);
  const saleung1 = withAdjustment(
    resolveD(saleung1A, round(saleung1A, -4), cfg),
    cfg.tierAdjustment,
  );

  // 5 ຫຸນ : A = base / 8
  const hun5A = base.div(8);
  const hun5Steps = resolveD(hun5A, round(hun5A, -4), cfg);
  const hun5 = withAdjustment(hun5Steps, cfg.tierAdjustment);

  // The 3/2/1 ຫຸນ tiers hang off the *pre-adjustment* D of 5 ຫຸນ.
  const hun5D = hun5Steps.d;

  const smallTier = (multiplier: number, adjustment: Numeric): RoundingSteps => {
    const a = hun5D.div(5).mul(multiplier).plus(surcharge);
    const b = round(base.div(40).mul(multiplier).plus(surcharge), -4);
    return withAdjustment(resolveD(a, b, cfg), adjustment);
  };

  const hun3 = smallTier(3, cfg.tierAdjustment);
  const hun2 = smallTier(2, cfg.tierAdjustment);
  const hun1 = smallTier(1, cfg.hun1Adjustment);

  // 2 ສະຫຼຶງ is defined purely as 1 ສະຫຼຶງ x 2 — no rounding ladder of its own.
  const saleung2 = saleung1.final.mul(2);

  return {
    prices: {
      [TierCode.JW_BAHT_1]: p1,
      [TierCode.JW_SALEUNG_2]: saleung2,
      [TierCode.JW_SALEUNG_1]: saleung1.final,
      [TierCode.JW_HUN_5]: hun5.final,
      [TierCode.JW_HUN_3]: hun3.final,
      [TierCode.JW_HUN_2]: hun2.final,
      [TierCode.JW_HUN_1]: hun1.final,
    },
    steps: {
      [TierCode.JW_SALEUNG_1]: saleung1,
      [TierCode.JW_HUN_5]: hun5,
      [TierCode.JW_HUN_3]: hun3,
      [TierCode.JW_HUN_2]: hun2,
      [TierCode.JW_HUN_1]: hun1,
    },
  };
}

/**
 * ສູດຄິດໄລ່ ລາຄາຂາຍ ຄຳແທ່ງ (TOR §3.1).
 *
 * At ລາຄາຂາຍ 1 ບາດ = 45,859,000 this yields
 * 45,750,000 / 22,875,000 / 11,437,500 / 3,170,000.
 */
export function computeBarSellPrices(
  price1Baht: Numeric,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): Record<string, Decimal> {
  const cfg = config;
  const bar1 = dec(price1Baht).minus(dec(cfg.barBahtDiscount));
  return {
    [TierCode.BAR_BAHT_1]: bar1,
    [TierCode.BAR_SALEUNG_2]: bar1.div(2),
    [TierCode.BAR_SALEUNG_1]: bar1.div(4),
    [TierCode.BAR_GRAM_1]: roundUp(bar1.div(15).plus(dec(cfg.barGramSurcharge)), -3),
  };
}

/* ------------------------------------------------------------------ *
 * TOR §3.2 — ລາຄາລົບອອກ & ຫັກອອກ (%) ຂອງລາຄາຊື້ຄືນຮູບປະພັນ
 * ------------------------------------------------------------------ */

export type DeductionKind = 'PERCENT' | 'AMOUNT';

/**
 * How a tier's buyback price is derived from its sell price.
 *  - PERCENT: `value` is in percent units, so 2.6 means 2.60%
 *  - AMOUNT:  `value` is a flat LAK amount subtracted, e.g. 209,000
 * These are loaded from `BuybackDeductionRule` so the shop can retune them
 * without a code change.
 */
export interface DeductionRule {
  kind: DeductionKind;
  value: Numeric;
}

/** TOR §3.2 defaults. */
export const DEFAULT_BUYBACK_DEDUCTIONS: Record<string, DeductionRule> = {
  [TierCode.JW_BAHT_1]: { kind: 'PERCENT', value: '2.60' },
  [TierCode.JW_SALEUNG_2]: { kind: 'PERCENT', value: '2.80' },
  [TierCode.JW_SALEUNG_1]: { kind: 'PERCENT', value: '2.80' },
  [TierCode.JW_HUN_5]: { kind: 'AMOUNT', value: 209_000 },
  [TierCode.JW_HUN_3]: { kind: 'AMOUNT', value: 209_000 },
  [TierCode.JW_HUN_2]: { kind: 'AMOUNT', value: 209_000 },
  [TierCode.JW_HUN_1]: { kind: 'AMOUNT', value: 209_000 },
};

/**
 * ສູດຄິດໄລ່ ລາຄາຊື້ຄືນ ຮູບປະພັນ (TOR §3.1 / §3.2).
 *
 * Percent tiers deduct a share of the sell price; ຫຸນ tiers deduct a flat
 * amount. Both are then ROUND(..., -3) to whole thousands of kip.
 */
export function computeJewelryBuybackPrices(
  sellPrices: Record<string, Numeric>,
  deductions: Record<string, DeductionRule> = DEFAULT_BUYBACK_DEDUCTIONS,
): Record<string, Decimal> {
  const out: Record<string, Decimal> = {};
  for (const [tier, sell] of Object.entries(sellPrices)) {
    const rule = deductions[tier];
    if (!rule) continue;
    const sellDec = dec(sell);
    const raw =
      rule.kind === 'PERCENT'
        ? sellDec.mul(dec(1).minus(dec(rule.value).div(100)))
        : sellDec.minus(dec(rule.value));
    out[tier] = round(raw, -3);
  }
  return out;
}

/**
 * ສູດຄິດໄລ່ ລາຄາຊື້ຄືນ ຄຳແທ່ງ (TOR §3.1).
 *
 * The 1 g tier uses ROUNDDOWN so the shop never overpays on the smallest
 * unit: 45,220,000 / 15 = 3,014,666.67 -> 3,014,000.
 */
export function computeBarBuybackPrices(
  barSellPrices: Record<string, Numeric>,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): Record<string, Decimal> {
  const bar1Sell = dec(barSellPrices[TierCode.BAR_BAHT_1] ?? 0);
  const bar1 = bar1Sell.minus(dec(config.barBuybackDiscount));
  return {
    [TierCode.BAR_BAHT_1]: bar1,
    [TierCode.BAR_SALEUNG_2]: bar1.div(2),
    [TierCode.BAR_SALEUNG_1]: bar1.div(4),
    [TierCode.BAR_GRAM_1]: roundDown(bar1.div(15), -3),
  };
}

/* ------------------------------------------------------------------ *
 * Convenience: the whole price board from one input.
 * ------------------------------------------------------------------ */

export interface PriceBoardLine {
  tier: string;
  sellPrice: Decimal;
  buybackPrice: Decimal;
  steps?: RoundingSteps;
}

export interface PriceBoard {
  price1Baht: Decimal;
  sell: Record<string, Decimal>;
  buyback: Record<string, Decimal>;
  steps: Partial<Record<string, RoundingSteps>>;
  lines: PriceBoardLine[];
}

/** Display order of the 11 rows, matching the TOR product table. */
export const PRICE_BOARD_ORDER: readonly string[] = [
  TierCode.JW_BAHT_1,
  TierCode.JW_SALEUNG_2,
  TierCode.JW_SALEUNG_1,
  TierCode.JW_HUN_5,
  TierCode.JW_HUN_3,
  TierCode.JW_HUN_2,
  TierCode.JW_HUN_1,
  TierCode.BAR_BAHT_1,
  TierCode.BAR_SALEUNG_2,
  TierCode.BAR_SALEUNG_1,
  TierCode.BAR_GRAM_1,
];

/**
 * Build the complete 11-row price board from ລາຄາຂາຍ 1 ບາດ.
 *
 * This single function backs both the Set Pricing preview in the browser and
 * the PriceSnapshot rows written by the API, so a saved price can never
 * disagree with the price the user was shown before pressing save.
 */
export function buildPriceBoard(
  price1Baht: Numeric,
  options: {
    config?: PricingConfig;
    deductions?: Record<string, DeductionRule>;
    tierOrder?: readonly string[];
  } = {},
): PriceBoard {
  const config = options.config ?? DEFAULT_PRICING_CONFIG;
  const deductions = options.deductions ?? DEFAULT_BUYBACK_DEDUCTIONS;

  const jewelry = computeJewelrySellPrices(price1Baht, config);
  const bar = computeBarSellPrices(price1Baht, config);

  const sell = { ...jewelry.prices, ...bar };
  const buyback = {
    ...computeJewelryBuybackPrices(jewelry.prices, deductions),
    ...computeBarBuybackPrices(bar, config),
  };

  const order = options.tierOrder ?? PRICE_BOARD_ORDER;

  const lines: PriceBoardLine[] = order.map((tier) => {
    const line: PriceBoardLine = {
      tier,
      sellPrice: dec(sell[tier] ?? 0),
      buybackPrice: dec(buyback[tier] ?? 0),
    };
    const s = jewelry.steps[tier];
    if (s) line.steps = s;
    return line;
  });

  return { price1Baht: dec(price1Baht), sell, buyback, steps: jewelry.steps, lines };
}

/** Look up a tier's sell or buyback price from a board. */
export function priceForTier(
  board: PriceBoard,
  tier: TierMeta | string,
  side: 'sell' | 'buyback',
): Decimal {
  const code = typeof tier === 'string' ? tier : tier.code;
  return dec((side === 'sell' ? board.sell : board.buyback)[code] ?? 0);
}
