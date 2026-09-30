import { describe, it, expect } from 'vitest';
import { buildPriceBoard } from '../src/pricing.js';
import { GRAMS_PER_BAHT, TIER_META, TierCode } from '../src/constants.js';
import { dec, trimTrailingZeros } from '../src/decimal.js';
import {
  calculateBuyback,
  lookupExact,
  makePriceTable,
  payableBoiled,
  shopBuybackPriceBoiled,
  shopBuybackPriceKpv,
  type BuybackGoldKind,
  type BuybackPriceSource,
  type PriceTableEntry,
} from '../src/buyback.js';
import {
  calculateExchange,
  softGoldFeeForLine,
  softGoldSteps,
  validateExchangeBalance,
} from '../src/exchange.js';
import {
  accumulateLedger,
  calculateWac,
  checkStockOut,
  expectedReturnWeight,
  ledgerClosing,
  skuBalance,
  typeBalance,
} from '../src/stock.js';
import {
  buildCashPosting,
  buildGoldPosting,
  calculateWealth,
  cashOnHand,
  findPostingRule,
  goldOnHand,
  goldTypeAverage,
  netAdvance,
  netCashApAr,
  summariseGoldApAr,
  type GoldPostingRule,
} from '../src/apar.js';

const P1 = 45_859_000;
const board = buildPriceBoard(P1);

/** Jewellery buyback prices keyed by exchange weight — the §5.1 lookup table. */
const TABLE: PriceTableEntry[] = makePriceTable(
  (
    [
      TierCode.JW_BAHT_1,
      TierCode.JW_SALEUNG_2,
      TierCode.JW_SALEUNG_1,
      TierCode.JW_HUN_5,
      TierCode.JW_HUN_3,
      TierCode.JW_HUN_2,
      TierCode.JW_HUN_1,
    ] as const
  ).map((tier) => ({
    tierCode: tier,
    weightG: TIER_META[tier].exchangeWeightG,
    buybackPrice: board.buyback[tier]!,
  })),
);

const SOURCE: BuybackPriceSource = {
  price1BahtFor: (kind: BuybackGoldKind) =>
    kind === 'BAR' ? board.buyback[TierCode.BAR_BAHT_1]! : board.buyback[TierCode.JW_BAHT_1]!,
  lookup: (_kind, weightG) => lookupExact(TABLE, weightG),
};

const JW_1_BAHT = 44_667_000; // ລາຄາຊື້ຄືນ ຮູບປະພັນ 1 ບາດ
const BAR_1_BAHT = 45_220_000; // ລາຄາຊື້ຄືນ ຄຳແທ່ງ 1 ບາດ

/* ================================================================== *
 * §5.1 Buyback
 * ================================================================== */

describe('TOR §5.1 — ລາຄາຊື້ຄືນໜ້າຮ້ານ, ຄຳຮ້ານ KPV', () => {
  it('ຄຳດີ at a whole baht pays Price1Baht per baht', () => {
    expect(shopBuybackPriceKpv('GOOD', 15, SOURCE, TABLE).price.toNumber()).toBe(JW_1_BAHT);
    expect(shopBuybackPriceKpv('GOOD', 45, SOURCE, TABLE).price.toNumber()).toBe(JW_1_BAHT * 3);
  });

  it('ຄຳດີ at a listed part-baht weight uses the table', () => {
    // 3.75 g = 1 ສະຫຼຶງ -> 11,148,000
    expect(shopBuybackPriceKpv('GOOD', '3.75', SOURCE, TABLE).price.toNumber()).toBe(11_148_000);
  });

  it('ຄຳດີ at an unlisted weight cannot be priced', () => {
    // 18.75 g is 1 ບາດ + 1 ສະຫຼຶງ, but the shop's workbook does not decompose:
    // a weight that is neither a tier nor a multiple of 15 yields 0.
    const result = shopBuybackPriceKpv('GOOD', '18.75', SOURCE, TABLE);
    expect(result.price.toNumber()).toBe(0);
  });

  it('ຄຳຫຍຸບ over 1 baht rounds the weight UP to whole baht', () => {
    // 20 g -> CEILING to 30 g -> 2 baht
    expect(shopBuybackPriceKpv('HUMP', 20, SOURCE, TABLE).price.toNumber()).toBe(JW_1_BAHT * 2);
    // exactly 15 g is not "> 15", so it goes to the exact-match table
    expect(shopBuybackPriceKpv('HUMP', 15, SOURCE, TABLE).price.toNumber()).toBe(JW_1_BAHT);
  });

  it('ຄຳແທ່ງ that is not a whole number of baht cannot be priced', () => {
    expect(shopBuybackPriceKpv('BAR', 20, SOURCE, TABLE).price.toNumber()).toBe(0);
    expect(shopBuybackPriceKpv('BAR', 30, SOURCE, TABLE).price.toNumber()).toBe(BAR_1_BAHT * 2);
  });

  it('ຄຳແທ່ງ under 1 baht comes from the table', () => {
    expect(shopBuybackPriceKpv('BAR', '7.5', SOURCE, TABLE).price.toNumber()).toBe(22_296_000);
  });

  it('a missing or zero weight always yields 0, never an error', () => {
    for (const kind of ['GOOD', 'HUMP', 'BAR'] as const) {
      expect(shopBuybackPriceKpv(kind, 0, SOURCE, TABLE).price.toNumber()).toBe(0);
      expect(shopBuybackPriceKpv(kind, -5, SOURCE, TABLE).price.toNumber()).toBe(0);
    }
  });
});

describe('TOR §5.1 — ລາຄາທີ່ຕ້ອງຈ່າຍ', () => {
  it('deducts ຄ່າອ່ອນ per piece, then multiplies by quantity', () => {
    const result = calculateBuyback(
      { kind: 'GOOD', weightG: 15, quantity: 3, deduction: 400_000 },
      SOURCE,
      TABLE,
    );
    expect(result.shopBuybackPrice.toNumber()).toBe(JW_1_BAHT);
    expect(result.payableAmount.toNumber()).toBe((JW_1_BAHT - 400_000) * 3);
  });

  it('never pays a negative amount', () => {
    const result = calculateBuyback(
      { kind: 'GOOD', weightG: '0.375', quantity: 1, deduction: 99_999_999 },
      SOURCE,
      TABLE,
    );
    expect(result.payableAmount.toNumber()).toBe(0);
  });
});

describe('TOR §5.1 — ຄຳຮ້ານອື່ນ (ຄຳຕົ້ມ)', () => {
  it('prices over 1 baht by CEILING(ນ້ຳໜັກ/15, 1)', () => {
    // 20 g -> CEILING(1.333, 1) = 2 -> 2 x Price1Baht
    expect(shopBuybackPriceBoiled(20, SOURCE, TABLE).price.toNumber()).toBe(JW_1_BAHT * 2);
  });

  it('applies %ຄຳ and ROUNDDOWN to the nearest 1,000', () => {
    // w=20, shop=2*44,667,000=89,334,000, CEILING(20,15)=30, 96%
    // (20 * 89,334,000) / 30 * 0.96 = 57,173,760 -> ROUNDDOWN(-3) = 57,173,000
    const payable = payableBoiled(20, JW_1_BAHT * 2, 96, 1);
    expect(payable.toNumber()).toBe(57_173_000);
  });

  it('rounds DOWN rather than to nearest, so the shop never overpays', () => {
    const payable = payableBoiled(15, JW_1_BAHT, 99, 1);
    // 44,667,000 * 0.99 = 44,220,330 -> ROUNDDOWN(-3) = 44,220,000
    expect(payable.toNumber()).toBe(44_220_000);
  });

  it('multiplies by piece count after rounding', () => {
    const one = payableBoiled(15, JW_1_BAHT, 96, 1);
    const three = payableBoiled(15, JW_1_BAHT, 96, 3);
    expect(three.toNumber()).toBe(one.toNumber() * 3);
  });

  it('returns 0 for zero weight', () => {
    expect(payableBoiled(0, JW_1_BAHT, 96, 1).toNumber()).toBe(0);
  });
});

/* ================================================================== *
 * §5.2 Exchange
 * ================================================================== */

describe('TOR §5.2 — ຄ່າອ່ອນ', () => {
  it('charges the shortfall in whole 0.1 g steps', () => {
    // 0.5 g short = 5 steps x 400,000. Reading the TOR as a per-GRAM rate
    // gave 200,000 here — a tenth of what the shop actually charges.
    const fee = softGoldFeeForLine(
      { weightG: '14.5', quantity: 1, standardWeightG: 15 },
      400_000,
    );
    expect(fee.toNumber()).toBe(2_000_000);
  });

  it('charges nothing when the gold is at or above standard weight', () => {
    expect(
      softGoldFeeForLine({ weightG: 15, quantity: 1, standardWeightG: 15 }, 400_000).toNumber(),
    ).toBe(0);
    expect(
      softGoldFeeForLine({ weightG: '15.2', quantity: 1, standardWeightG: 15 }, 400_000).toNumber(),
    ).toBe(0);
  });

  it('scales by quantity', () => {
    const fee = softGoldFeeForLine(
      { weightG: '14.9', quantity: 4, standardWeightG: 15 },
      400_000,
    );
    // 0.1 g = 1 step x 400,000 x 4
    expect(fee.toNumber()).toBe(1_600_000);
  });
});

describe('TOR §5.2 — the CRITICAL zero-balance rule', () => {
  const base = {
    txnType: 'EXCHANGE_TO_CASH' as const,
    shapeCondition: 'GOOD' as const,
    softGoldFeePerGram: 400_000,
  };

  it('allows a save only when old standard weight exactly equals new + remaining', () => {
    const totals = calculateExchange({
      ...base,
      oldLines: [{ weightG: 15, quantity: 1, standardWeightG: 15 }],
      newLines: [{ weightG: '7.5', quantity: 1 }],
      remainingLines: [{ weightG: '7.5', quantity: 1 }],
    });
    expect(validateExchangeBalance(totals).isBalanced).toBe(true);
  });

  it('blocks a save when gold is unaccounted for, and says how much', () => {
    const totals = calculateExchange({
      ...base,
      oldLines: [{ weightG: 15, quantity: 1, standardWeightG: 15 }],
      newLines: [{ weightG: '7.5', quantity: 1 }],
      remainingLines: [],
    });
    const check = validateExchangeBalance(totals);
    expect(check.isBalanced).toBe(false);
    expect(check.difference.toNumber()).toBe(7.5);
    expect(check.messageLo).toContain('7.5');
  });

  it('blocks a save when more gold leaves than arrived', () => {
    const totals = calculateExchange({
      ...base,
      oldLines: [{ weightG: 15, quantity: 1, standardWeightG: 15 }],
      newLines: [{ weightG: 30, quantity: 1 }],
      remainingLines: [],
    });
    const check = validateExchangeBalance(totals);
    expect(check.isBalanced).toBe(false);
    expect(check.difference.toNumber()).toBe(-15);
    expect(check.messageLo).toContain('ເກີນ');
  });

  it('balances against STANDARD weight, not the worn actual weight', () => {
    // Customer brings back a 15 g piece that now weighs 14.5 g.
    const totals = calculateExchange({
      ...base,
      oldLines: [{ weightG: '14.5', quantity: 1, standardWeightG: 15 }],
      newLines: [{ weightG: 15, quantity: 1 }],
      remainingLines: [],
    });
    expect(totals.actualOldWeightG.toNumber()).toBe(14.5);
    expect(totals.standardOldWeightG.toNumber()).toBe(15);
    expect(validateExchangeBalance(totals).isBalanced).toBe(true);
    // ...and the 0.5 g shortfall is billed as ຄ່າອ່ອນ instead: 5 steps of 0.1 g.
    expect(totals.softGoldFee.toNumber()).toBe(2_000_000);
  });
});

describe('TOR §5.2 — ລວມເງິນຕ້ອງຈ່າຍ', () => {
  it('subtracts every fee from the shop buyback price', () => {
    const totals = calculateExchange({
      txnType: 'EXCHANGE_TO_CASH',
      shapeCondition: 'GOOD',
      softGoldFeePerGram: 400_000,
      oldLines: [
        { weightG: '14.5', quantity: 1, standardWeightG: 15, shopBuybackPrice: 44_667_000 },
      ],
      newLines: [
        { weightG: 15, quantity: 1, humpFee: 269_000, barConvertFee: 0, patternFee: 50_000 },
      ],
      remainingLines: [],
    });

    // 0.5 g short = 5 steps of 0.1 g x 400,000
    expect(totals.softGoldFee.toNumber()).toBe(2_000_000);
    expect(totals.humpFee.toNumber()).toBe(269_000);
    expect(totals.patternFee.toNumber()).toBe(50_000);
    expect(totals.totalPayable.toNumber()).toBe(44_667_000 - 2_000_000 - 269_000 - 0 - 50_000);
  });

  it('forces every conversion fee to zero on a ປ່ຽນຟຣີ', () => {
    const totals = calculateExchange({
      txnType: 'FREE_EXCHANGE',
      shapeCondition: 'GOOD',
      softGoldFeePerGram: 400_000,
      oldLines: [{ weightG: 15, quantity: 1, standardWeightG: 15, shopBuybackPrice: 44_667_000 }],
      newLines: [
        { weightG: 15, quantity: 1, humpFee: 269_000, barConvertFee: 169_000, patternFee: 50_000 },
      ],
      remainingLines: [],
    });

    expect(totals.humpFee.toNumber()).toBe(0);
    expect(totals.barConvertFee.toNumber()).toBe(0);
    expect(totals.patternFee.toNumber()).toBe(0);
    expect(totals.totalPayable.toNumber()).toBe(44_667_000);
  });
});

/* ================================================================== *
 * §7.1 / §7.2 Stock ledgers
 * ================================================================== */

describe('TOR §7.1 — running WEIGHT and ຕົ້ນທຶນ columns', () => {
  it('accumulates each row from the one before it', () => {
    const rows = accumulateLedger([
      { goldInG: 30, priceIn: 90_000_000 },
      { goldOutG: 15, priceOut: 45_000_000 },
      { goldInG: '7.5', priceIn: 22_500_000 },
    ]);

    expect(rows.map((r) => r.weightG.toNumber())).toEqual([30, 15, 22.5]);
    expect(rows.map((r) => r.cost.toNumber())).toEqual([90_000_000, 45_000_000, 67_500_000]);
    expect(rows.map((r) => r.sequence)).toEqual([1, 2, 3]);
  });

  it("starts from the opening balance, so a new day continues yesterday's totals", () => {
    const rows = accumulateLedger([{ goldInG: 15, priceIn: 45_000_000 }], {
      weightG: 100,
      cost: 300_000_000,
    });
    expect(rows[0]!.weightG.toNumber()).toBe(115);
    expect(rows[0]!.cost.toNumber()).toBe(345_000_000);
  });

  it('reports the opening as the closing when there are no movements', () => {
    const closing = ledgerClosing([], { weightG: 42, cost: 1_000 });
    expect(closing.weightG.toNumber()).toBe(42);
    expect(closing.cost.toNumber()).toBe(1_000);
  });

  it('Ready to Gold balance = ຕັ້ງຕົ້ນ + IN − OUT', () => {
    const balance = skuBalance({ openingQty: 10, inQty: 5, outQty: 3, weightG: 15 });
    expect(balance.balanceQty.toNumber()).toBe(12);
    expect(balance.totalWeightG.toNumber()).toBe(180);
  });
});

describe('TOR §7.2 — Stock (OLD) per-type balances', () => {
  it('computes closing weight and cost, and truncates ລາຄາ/g', () => {
    const balance = typeBalance({
      openingWeightG: 100,
      openingCost: 300_000_000,
      inG: 50,
      outG: 20,
      priceIn: 150_000_000,
      priceOut: 60_000_000,
    });

    expect(balance.closingWeightG.toNumber()).toBe(130);
    expect(balance.closingCost.toNumber()).toBe(390_000_000);
    expect(balance.pricePerG.toNumber()).toBe(3_000_000);
    expect(balance.pricePerBaht.toNumber()).toBe(45_000_000);
  });

  it('truncates rather than rounds, so stock is never over-valued', () => {
    const balance = typeBalance({
      openingWeightG: 3,
      openingCost: 10_000_000,
      inG: 0, outG: 0, priceIn: 0, priceOut: 0,
    });
    // 10,000,000 / 3 = 3,333,333.33... -> truncated to 3,333,333
    expect(balance.pricePerG.toNumber()).toBe(3_333_333);
  });

  it('returns zero rather than NaN on empty stock', () => {
    const balance = typeBalance({
      openingWeightG: 0, openingCost: 0, inG: 0, outG: 0, priceIn: 0, priceOut: 0,
    });
    expect(balance.pricePerG.toNumber()).toBe(0);
  });
});

describe('TOR §7.2 — stock-out guard and smith return weight', () => {
  it('allows an OUT up to the available weight', () => {
    expect(checkStockOut(100, 100).allowed).toBe(true);
    expect(checkStockOut(100, 99).allowed).toBe(true);
  });

  it('blocks an OUT that exceeds stock and reports the shortfall in Lao', () => {
    const check = checkStockOut(100, '100.5');
    expect(check.allowed).toBe(false);
    expect(check.shortfallG.toNumber()).toBe(0.5);
    expect(check.messageLo).toContain('0.5');
  });

  it('rounds the expected smith return UP', () => {
    // 100 g at 96% = 96 exactly
    expect(expectedReturnWeight(100, 96).toNumber()).toBe(96);
    // 50 g at 96% = 48 exactly
    expect(expectedReturnWeight(50, 96).toNumber()).toBe(48);
    // 33 g at 96% = 31.68 -> 32
    expect(expectedReturnWeight(33, 96).toNumber()).toBe(32);
  });
});

describe('TOR §3.7 — WAC', () => {
  it('averages NEW and OLD stock together', () => {
    const wac = calculateWac({
      newWeightG: 100,
      newCost: 300_000_000,
      oldWeightG: 50,
      oldCost: 140_000_000,
    });
    expect(wac.totalWeightG.toNumber()).toBe(150);
    expect(wac.totalCost.toNumber()).toBe(440_000_000);
    expect(wac.pricePerG.toDecimalPlaces(4).toNumber()).toBeCloseTo(2_933_333.3333, 3);
    expect(wac.pricePerBaht.toDecimalPlaces(0).toNumber()).toBe(44_000_000);
  });

  it('returns zero, not NaN, when the vault is empty', () => {
    const wac = calculateWac({ newWeightG: 0, newCost: 0, oldWeightG: 0, oldCost: 0 });
    expect(wac.pricePerG.toNumber()).toBe(0);
    expect(wac.pricePerBaht.toNumber()).toBe(0);
  });
});

/* ================================================================== *
 * §8 / §9 AP-AR
 * ================================================================== */

describe('\u00a75.1 / \u00a75.2 \u2014 against the shop workbook', () => {
  // Weights are the DISPLAY column (Produets!B), which is what the workbook
  // matches on: 1.87, not the 1.875 that keys the \u0e84\u0ec8\u0eb2\u0e9b\u0ec8\u0ebd\u0e99 table.
  const BOARD: PriceTableEntry[] = makePriceTable([
    { tierCode: 'JW_BAHT_1', weightG: dec(15), buybackPrice: dec(44_667_000) },
    { tierCode: 'JW_SALEUNG_2', weightG: dec('7.5'), buybackPrice: dec(22_296_000) },
    { tierCode: 'JW_SALEUNG_1', weightG: dec('3.75'), buybackPrice: dec(11_148_000) },
    { tierCode: 'JW_HUN_5', weightG: dec('1.87'), buybackPrice: dec(5_530_000) },
    { tierCode: 'JW_HUN_3', weightG: dec('1.12'), buybackPrice: dec(3_270_000) },
    { tierCode: 'JW_HUN_2', weightG: dec('0.75'), buybackPrice: dec(2_120_000) },
    { tierCode: 'JW_HUN_1', weightG: dec('0.37'), buybackPrice: dec(985_000) },
  ]);

  const SOURCE: BuybackPriceSource = {
    price1BahtFor: () => dec(44_667_000),
    lookup: (_kind, w) => lookupExact(BOARD, w),
  };

  const SOFT_GOLD_FEE = dec(400_000); // \u0e84\u0ec8\u0eb2\u0ead\u0ec8\u0ead\u0e99!C7

  it('\u0e84\u0eb3\u0e94\u0eb5 at a whole baht \u2014 \u0e84\u0eb3\u0eae\u0ec9\u0eb2\u0e99KPV row 6', () => {
    const { price } = shopBuybackPriceKpv('GOOD', 15, SOURCE, BOARD);
    expect(price.toNumber()).toBe(44_667_000);
  });

  it('\u0e84\u0eb3\u0e94\u0eb5 at a weight that is neither a tier nor a multiple of 15 pays nothing', () => {
    // The workbook decomposes nothing: its IFERROR yields 0.
    expect(shopBuybackPriceKpv('GOOD', '18.75', SOURCE, BOARD).price.toNumber()).toBe(0);
    expect(shopBuybackPriceKpv('GOOD', '4.2', SOURCE, BOARD).price.toNumber()).toBe(0);
  });

  it('\u0e84\u0eb3\u0e94\u0eb5 scales linearly across whole baht', () => {
    expect(shopBuybackPriceKpv('GOOD', 30, SOURCE, BOARD).price.toNumber()).toBe(89_334_000);
  });

  it('\u0e84\u0eb3\u0eab\u0e8d\u0eb8\u0e9a 14.99 g quotes the 15 g price \u2014 \u0e84\u0eb3\u0eae\u0ec9\u0eb2\u0e99KPV row 9', () => {
    // MATCH(-1): the smallest tier at or above the weight. An exact match
    // would find nothing here and pay zero.
    const { price } = shopBuybackPriceKpv('HUMP', '14.99', SOURCE, BOARD);
    expect(price.toNumber()).toBe(44_667_000);
  });

  it('\u0e84\u0eb3\u0eab\u0e8d\u0eb8\u0e9a over 15 g rounds the baht count up', () => {
    // CEILING(29.89/15, 1) = 2
    expect(shopBuybackPriceKpv('HUMP', '29.89', SOURCE, BOARD).price.toNumber()).toBe(89_334_000);
  });

  it('bills a shortfall in whole 0.1 g steps, rounded up', () => {
    // 15 - 14.99 = 0.01 -> one step -> 400,000 (\u0e84\u0eb3\u0eae\u0ec9\u0eb2\u0e99KPV I10)
    expect(softGoldSteps('0.01').toNumber()).toBe(1);
    // 30 - 29.89 = 0.11 -> two steps -> 800,000 (\u0e9b\u0ec8\u0ebd\u0e99\u0ec0\u0e9b\u0eb1\u0e99\u0ec0\u0e87\u0eb4\u0e99 F9)
    expect(softGoldSteps('0.11').toNumber()).toBe(2);
    // Exactly on a step boundary stays on that step.
    expect(softGoldSteps('0.2').toNumber()).toBe(2);
    expect(softGoldSteps(0).toNumber()).toBe(0);
  });

  it('\u0e84\u0ec8\u0eb2\u0ead\u0ec8\u0ead\u0e99 for 29.89 g of \u0e84\u0eb3\u0eab\u0e8d\u0eb8\u0e9a is 800,000 \u2014 \u0e9b\u0ec8\u0ebd\u0e99\u0ec0\u0e9b\u0eb1\u0e99\u0ec0\u0e87\u0eb4\u0e99 F9', () => {
    const fee = softGoldFeeForLine(
      { weightG: '29.89', quantity: 1, standardWeightG: 30, goldKind: 'HUMP' },
      SOFT_GOLD_FEE,
    );
    expect(fee.toNumber()).toBe(800_000);
  });

  it('charges \u0e84\u0ec8\u0eb2\u0ead\u0ec8\u0ead\u0e99 on \u0e84\u0eb3\u0eab\u0e8d\u0eb8\u0e9a only', () => {
    const line = { weightG: '14.9', quantity: 1, standardWeightG: 15 } as const;
    expect(softGoldFeeForLine({ ...line, goldKind: 'HUMP' }, SOFT_GOLD_FEE).toNumber()).toBe(400_000);
    expect(softGoldFeeForLine({ ...line, goldKind: 'GOOD' }, SOFT_GOLD_FEE).toNumber()).toBe(0);
    expect(softGoldFeeForLine({ ...line, goldKind: 'BAR' }, SOFT_GOLD_FEE).toNumber()).toBe(0);
  });

  it('never charges gold that comes back at or above its standard', () => {
    const fee = softGoldFeeForLine(
      { weightG: 15, quantity: 3, standardWeightG: 15, goldKind: 'HUMP' },
      SOFT_GOLD_FEE,
    );
    expect(fee.toNumber()).toBe(0);
  });
});

describe('trimTrailingZeros', () => {
  it('keeps the zero in a whole number', () => {
    // A bare /\.?0+$/ turned 150 g (10 ບາດ) into "1 ບາດ" and reported a
    // 20 g shortfall as 2 g.
    expect(trimTrailingZeros('10')).toBe('10');
    expect(trimTrailingZeros('20')).toBe('20');
    expect(trimTrailingZeros('100')).toBe('100');
  });

  it('drops zeros only after the decimal point', () => {
    expect(trimTrailingZeros('1.50')).toBe('1.5');
    expect(trimTrailingZeros('1.00')).toBe('1');
    expect(trimTrailingZeros('10.00')).toBe('10');
    expect(trimTrailingZeros('0.1300')).toBe('0.13');
    expect(trimTrailingZeros('0.5')).toBe('0.5');
  });

  it('matches the SKU names the TOR §3.6 example implies', () => {
    const skuBaht = (weightG: number) =>
      trimTrailingZeros(dec(weightG).div(GRAMS_PER_BAHT).toDecimalPlaces(2).toFixed());
    expect(skuBaht(15)).toBe('1');
    expect(skuBaht(150)).toBe('10');
    expect(skuBaht(300)).toBe('20');
    expect(skuBaht(7.5)).toBe('0.5');
  });
});

describe('TOR §8 — AP/AR (GOLD) posting rules', () => {
  // The shop settled §8.1-vs-§8.4 in favour of §8.4 / §7.4: every gold
  // movement books to AP — IN raises it, OUT clears it. These fixtures mirror
  // the seeded rules so the test fails if the two ever drift apart.
  const rules: GoldPostingRule[] = [
    { scope: 'NEW', type: 'IN', partnerCode: 'EASY', side: 'AP', sign: 1 },
    { scope: 'OLD', type: 'OUT', partnerCode: 'FACTORY', side: 'AP', sign: -1 },
    { scope: 'NEW', type: 'IN', partnerCode: 'FACTORY', side: 'AP', sign: 1 },
  ];

  it('finds the rule for a movement', () => {
    expect(findPostingRule(rules, 'NEW', 'IN', 'EASY')?.side).toBe('AP');
    expect(findPostingRule(rules, 'OLD', 'OUT', 'FACTORY')?.side).toBe('AP');
  });

  it('books gold sent out to FACTORY as a reduction of AP, per §8.4 / §7.4', () => {
    const rule = findPostingRule(rules, 'OLD', 'OUT', 'FACTORY');
    expect(rule?.side).toBe('AP');
    expect(rule?.sign).toBe(-1);
  });

  it('returns null for an untracked partner rather than throwing', () => {
    expect(findPostingRule(rules, 'NEW', 'OUT', 'CABINET')).toBeNull();
  });

  it('books an increase in the IN columns and a decrease in the OUT columns', () => {
    // sign +1 — Stock IN from EASY raises the payable.
    const increase = buildGoldPosting(rules[0]!, 15, 45_000_000);
    expect(increase.goldInG.toNumber()).toBe(15);
    expect(increase.goldOutG.toNumber()).toBe(0);
    expect(increase.priceIn.toNumber()).toBe(45_000_000);

    // sign -1 — Stock OUT to FACTORY clears part of it.
    const decrease = buildGoldPosting(rules[1]!, 15, 45_000_000);
    expect(decrease.goldInG.toNumber()).toBe(0);
    expect(decrease.goldOutG.toNumber()).toBe(15);
    expect(decrease.priceOut.toNumber()).toBe(45_000_000);
  });

  it('pairs each partner: IN raises AP, the matching OUT clears it (§8.4)', () => {
    // The TOR lists six bullets that are really three pairs, one per partner
    // relationship. Each pair must use the same side and opposite signs, or
    // the partner's row can never return to zero.
    const pairs: Array<[GoldPostingRule, GoldPostingRule]> = [
      [
        { scope: 'NEW', type: 'IN', partnerCode: 'OUTSOURCE_SMITH', side: 'AP', sign: 1 },
        { scope: 'OLD', type: 'OUT', partnerCode: 'OUTSOURCE_SMITH', side: 'AP', sign: -1 },
      ],
      [
        { scope: 'NEW', type: 'IN', partnerCode: 'EASY', side: 'AP', sign: 1 },
        // Recorded against WITHDRAW, but it is EASY's payable it clears.
        {
          scope: 'NEW',
          type: 'OUT',
          partnerCode: 'WITHDRAW',
          side: 'AP',
          sign: -1,
          counterpartyCode: 'EASY',
        },
      ],
      [
        { scope: 'NEW', type: 'IN', partnerCode: 'FACTORY', side: 'AP', sign: 1 },
        { scope: 'OLD', type: 'OUT', partnerCode: 'FACTORY', side: 'AP', sign: -1 },
      ],
    ];

    for (const [inbound, outbound] of pairs) {
      expect(inbound.side).toBe('AP');
      expect(outbound.side).toBe('AP');
      expect(inbound.sign).toBe(1);
      expect(outbound.sign).toBe(-1);

      // Both halves must settle on the same partner row.
      const inboundRow = inbound.counterpartyCode ?? inbound.partnerCode;
      const outboundRow = outbound.counterpartyCode ?? outbound.partnerCode;
      expect(outboundRow).toBe(inboundRow);

      const rows = accumulateLedger([
        (() => {
          const post = buildGoldPosting(inbound, 50, 150_000_000);
          return { goldInG: post.goldInG, priceIn: post.priceIn };
        })(),
        (() => {
          const post = buildGoldPosting(outbound, 50, 150_000_000);
          return { goldOutG: post.goldOutG, priceOut: post.priceOut };
        })(),
      ]);
      expect(rows[rows.length - 1]!.weightG.toNumber()).toBe(0);
      expect(rows[rows.length - 1]!.cost.toNumber()).toBe(0);
    }
  });

  it('gold sent to FACTORY and received back nets AP to zero', () => {
    // §8.4: OUT to FACTORY is -AP, the matching IN is +AP, so a completed
    // round trip leaves the payable exactly where it started.
    const out = buildGoldPosting(rules[1]!, 100, 300_000_000);
    const back = buildGoldPosting(rules[2]!, 100, 300_000_000);
    const rows = accumulateLedger([
      { goldOutG: out.goldOutG, priceOut: out.priceOut },
      { goldInG: back.goldInG, priceIn: back.priceIn },
    ]);
    expect(rows[rows.length - 1]!.weightG.toNumber()).toBe(0);
    expect(rows[rows.length - 1]!.cost.toNumber()).toBe(0);
  });

  it('summarises a side as start + net movement, with the baht equivalent', () => {
    const summary = summariseGoldApAr(150, 60, 30);
    expect(summary.netMovementG.toNumber()).toBe(30);
    expect(summary.totalG.toNumber()).toBe(180);
    expect(summary.totalBaht.toNumber()).toBe(12);
  });
});

describe('TOR §9 — AP/AR (Cash)', () => {
  it('books smith labour as +AP and its payment as -AP', () => {
    expect(buildCashPosting('LABOR_PAYABLE', 'THB', 1_000).amountIn.toNumber()).toBe(1_000);
    expect(buildCashPosting('LABOR_PAYMENT', 'THB', 1_000).amountOut.toNumber()).toBe(1_000);
  });

  it('books new credit as +AR and instalments as -AR', () => {
    expect(buildCashPosting('CREDIT_ISSUED', 'LAK', 2_000_000).side).toBe('AR');
    expect(buildCashPosting('CREDIT_RECEIPT', 'LAK', 500_000).amountOut.toNumber()).toBe(500_000);
  });

  it('books a manually-added AP/AR and its settlement', () => {
    expect(buildCashPosting('MANUAL_AP', 'USD', 500).side).toBe('AP');
    expect(buildCashPosting('MANUAL_AP_PAYMENT', 'USD', 500).amountOut.toNumber()).toBe(500);
    expect(buildCashPosting('MANUAL_AR', 'THB', 900).side).toBe('AR');
    expect(buildCashPosting('MANUAL_AR_RECEIPT', 'THB', 900).amountOut.toNumber()).toBe(900);
  });

  it('nets a side as opening + increases − decreases', () => {
    const net = netCashApAr(1_000_000, 500_000, 300_000);
    expect(net.net.toNumber()).toBe(1_200_000);
  });
});

describe('TOR §7 — Advance (ເງິນມັດຈໍາ Order ຮັບລ່ວງໜ້າ)', () => {
  it('nets receipts against discharges', () => {
    expect(netAdvance(5_000_000, 0).toNumber()).toBe(5_000_000);
    expect(netAdvance(5_000_000, 5_000_000).toNumber()).toBe(0);
  });

  it('is subtracted from COH Cash — a held deposit belongs to the customer', () => {
    const withoutAdvance = cashOnHand({
      cash: 10_000_000, bcel: 0, ldb: 0, otherBank: 0, ap: 0, ar: 0,
    });
    const withAdvance = cashOnHand({
      cash: 10_000_000, bcel: 0, ldb: 0, otherBank: 0, ap: 0, ar: 0,
      advance: 3_000_000,
    });
    expect(withoutAdvance.toNumber()).toBe(10_000_000);
    expect(withAdvance.toNumber()).toBe(7_000_000);
  });

  it('an order deposited then collected leaves COH unchanged by the advance', () => {
    const advance = netAdvance(5_000_000, 5_000_000);
    const coh = cashOnHand({
      cash: 10_000_000, bcel: 0, ldb: 0, otherBank: 0, ap: 0, ar: 0, advance,
    });
    expect(coh.toNumber()).toBe(10_000_000);
  });
});

describe('TOR §3.7 — COH and Wealth', () => {
  it('COH Cash = Cash + banks − AP + AR − Advance', () => {
    const coh = cashOnHand({
      cash: 10_000_000,
      bcel: 5_000_000,
      ldb: 3_000_000,
      otherBank: 2_000_000,
      ap: 4_000_000,
      ar: 1_000_000,
      advance: 2_000_000,
    });
    expect(coh.toNumber()).toBe(15_000_000);
  });

  it('COH Gold = NEW + OLD − AP + AR, with the baht equivalent', () => {
    const coh = goldOnHand({ newG: 100, oldG: 50, apG: 30, arG: 10 });
    expect(coh.weightG.toNumber()).toBe(130);
    expect(coh.baht.toDecimalPlaces(4).toNumber()).toBeCloseTo(8.6667, 3);
  });

  it('Wealth converts foreign currency at the sell rate and expresses it as gold', () => {
    const wealth = calculateWealth({
      totalLak: 45_859_000,
      totalThb: 0,
      totalUsd: 0,
      thbSellRate: 660,
      usdSellRate: 21_700,
      price1Baht: 45_859_000,
    });
    // Exactly one baht's worth of gold.
    expect(wealth.baht.toNumber()).toBe(1);
    expect(wealth.weightG.toNumber()).toBe(15);
  });

  it('adds THB and USD holdings at their sell rates', () => {
    const wealth = calculateWealth({
      totalLak: 1_000_000,
      totalThb: 1_000,
      totalUsd: 100,
      thbSellRate: 660,
      usdSellRate: 21_700,
      price1Baht: 45_859_000,
    });
    expect(wealth.totalLak.toNumber()).toBe(1_000_000 + 660_000 + 2_170_000);
  });
});

describe('TOR §4.3 — ສະຫຼຸບປະເພດຄຳ averages', () => {
  it('ຄຳຕົ້ມ divides by the old weight alone', () => {
    const avg = goldTypeAverage(45_000_000, 15, 0, true);
    expect(avg.perGram!.toNumber()).toBe(3_000_000);
    expect(avg.perBaht!.toNumber()).toBe(45_000_000);
  });

  it('ຄຳດີ divides by (old − new) weight', () => {
    const avg = goldTypeAverage(30_000_000, 25, 15, false);
    expect(avg.perGram!.toNumber()).toBe(3_000_000);
  });

  it('returns null with a Lao reason when the divisor is zero', () => {
    // This is the ordinary case: §5.2 REQUIRES an exchange to balance.
    const avg = goldTypeAverage(30_000_000, 15, 15, false);
    expect(avg.perGram).toBeNull();
    expect(avg.messageLo).toContain('ເທົ່າກັນ');
  });

  it('returns null when more new gold went out than old came in', () => {
    const avg = goldTypeAverage(30_000_000, 15, 30, false);
    expect(avg.perGram).toBeNull();
    expect(avg.messageLo).toContain('ຫຼາຍກວ່າ');
  });
});

/* ================================================================== *
 * Cross-engine consistency
 * ================================================================== */

describe('cross-engine consistency', () => {
  it('the buyback lookup table matches the price board it was built from', () => {
    for (const entry of TABLE) {
      expect(entry.buybackPrice.toNumber()).toBe(board.buyback[entry.tierCode]!.toNumber());
    }
  });

  it('uses exchange weights, not display weights, so 5 ຫຸນ resolves', () => {
    // The board prints 1.87 but the exchange weight is 1.875; a lookup on the
    // display weight would silently miss and price the gold at zero.
    expect(lookupExact(TABLE, dec('1.875'))!.toNumber()).toBe(5_530_000);
    expect(lookupExact(TABLE, dec('1.87'))).toBeNull();
  });
});
