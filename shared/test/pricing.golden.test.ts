import { describe, it, expect } from 'vitest';
import {
  buildPriceBoard,
  computeJewelrySellPrices,
  computeBarSellPrices,
  computeJewelryBuybackPrices,
  computeBarBuybackPrices,
} from '../src/pricing.js';
import { TierCode } from '../src/constants.js';
import { round, roundUp, roundDown, ceilingTo, floorTo, truncate, isMultipleOf } from '../src/rounding.js';

/**
 * GOLDEN FIXTURE — TOR §3.1 product table.
 *
 * This is the contract between the system and the shop's existing spreadsheet.
 * Every one of these 11 rows is quoted verbatim from the TOR; if any of them
 * fails, the pricing engine is wrong and nothing downstream can be trusted.
 */
const P1 = 45_859_000;

const TOR_TABLE: ReadonlyArray<{
  tier: string;
  labelLo: string;
  sell: number;
  buyback: number;
}> = [
  { tier: TierCode.JW_BAHT_1,    labelLo: 'ຮູບປະພັນ - 1 ບາດ',    sell: 45_859_000, buyback: 44_667_000 },
  { tier: TierCode.JW_SALEUNG_2, labelLo: 'ຮູບປະພັນ - 2 ສະຫຼຶງ',  sell: 22_938_000, buyback: 22_296_000 },
  { tier: TierCode.JW_SALEUNG_1, labelLo: 'ຮູບປະພັນ - 1 ສະຫຼຶງ',  sell: 11_469_000, buyback: 11_148_000 },
  { tier: TierCode.JW_HUN_5,     labelLo: 'ຮູບປະພັນ - 5 ຫຸນ',     sell:  5_739_000, buyback:  5_530_000 },
  { tier: TierCode.JW_HUN_3,     labelLo: 'ຮູບປະພັນ - 3 ຫຸນ',     sell:  3_479_000, buyback:  3_270_000 },
  { tier: TierCode.JW_HUN_2,     labelLo: 'ຮູບປະພັນ - 2 ຫຸນ',     sell:  2_329_000, buyback:  2_120_000 },
  { tier: TierCode.JW_HUN_1,     labelLo: 'ຮູບປະພັນ - 1 ຫຸນ',     sell:  1_194_000, buyback:    985_000 },
  { tier: TierCode.BAR_BAHT_1,   labelLo: 'ຄຳແທ່ງ - 1 ບາດ',       sell: 45_750_000, buyback: 45_220_000 },
  { tier: TierCode.BAR_SALEUNG_2,labelLo: 'ຄຳແທ່ງ - 2 ສະຫຼຶງ',    sell: 22_875_000, buyback: 22_610_000 },
  { tier: TierCode.BAR_SALEUNG_1,labelLo: 'ຄຳແທ່ງ - 1 ສະຫຼຶງ',    sell: 11_437_500, buyback: 11_305_000 },
  { tier: TierCode.BAR_GRAM_1,   labelLo: 'ຄຳແທ່ງ - 1g',          sell:  3_170_000, buyback:  3_014_000 },
];

describe('rounding primitives (Excel semantics)', () => {
  it('ROUND is nearest with ties away from zero', () => {
    expect(round(11_462_500, -4).toNumber()).toBe(11_460_000); // 2,500 remainder -> down
    expect(round(1_176_250, -4).toNumber()).toBe(1_180_000);   // 6,250 remainder -> up
    expect(round(2_322_500, -4).toNumber()).toBe(2_320_000);
    expect(round(3_468_750, -4).toNumber()).toBe(3_470_000);
    expect(round(2_500, -4).toNumber()).toBe(0);               // 0.25 of a step -> down
    expect(round(5_000, -4).toNumber()).toBe(10_000);          // exact tie -> away from zero
  });

  it('ROUNDUP always moves away from zero', () => {
    expect(roundUp(3_170_000, -3).toNumber()).toBe(3_170_000);
    expect(roundUp(3_170_001, -3).toNumber()).toBe(3_171_000);
  });

  it('ROUNDDOWN always moves toward zero', () => {
    expect(roundDown('3014666.666666', -3).toNumber()).toBe(3_014_000);
  });

  it('CEILING rounds away from zero to a multiple', () => {
    expect(ceilingTo(20, 15).toNumber()).toBe(30);
    expect(ceilingTo(30, 15).toNumber()).toBe(30);
    expect(ceilingTo('1.33', 1).toNumber()).toBe(2);
    expect(ceilingTo(0, 15).toNumber()).toBe(0);
  });

  it('FLOOR, truncate and isMultipleOf behave as the TOR expects', () => {
    expect(floorTo(20, 15).toNumber()).toBe(15);
    expect(truncate('3014666.6666', 0).toNumber()).toBe(3_014_666);
    expect(isMultipleOf(45, 15)).toBe(true);
    expect(isMultipleOf(20, 15)).toBe(false);
  });
});

describe('TOR §3.1 — ລາຄາຂາຍ (sell prices) at ລາຄາຂາຍ 1 ບາດ = 45,859,000', () => {
  const board = buildPriceBoard(P1);

  for (const row of TOR_TABLE) {
    it(`${row.labelLo} sells for ${row.sell.toLocaleString('en-US')} LAK`, () => {
      expect(board.sell[row.tier]!.toNumber()).toBe(row.sell);
    });
  }
});

describe('TOR §3.1/§3.2 — ລາຄາຊື້ຄືນ (buyback prices)', () => {
  const board = buildPriceBoard(P1);

  for (const row of TOR_TABLE) {
    it(`${row.labelLo} buys back at ${row.buyback.toLocaleString('en-US')} LAK`, () => {
      expect(board.buyback[row.tier]!.toNumber()).toBe(row.buyback);
    });
  }
});

describe('TOR §3.1 — the A/B/C/D rounding ladder, step by step', () => {
  const { steps } = computeJewelrySellPrices(P1);

  it('1 ສະຫຼຶງ: A=11,462,500 B=11,460,000 C=-2,500 (rounded down) D=11,465,000', () => {
    const s = steps[TierCode.JW_SALEUNG_1]!;
    expect(s.a.toNumber()).toBe(11_462_500);
    expect(s.b.toNumber()).toBe(11_460_000);
    expect(s.c.toNumber()).toBe(-2_500);
    expect(s.d.toNumber()).toBe(11_465_000); // C < 0 -> B + 5,000
    expect(s.final.toNumber()).toBe(11_469_000); // D + 4,000
  });

  it('5 ຫຸນ: A=5,731,250 B=5,730,000 C=-1,250 D=5,735,000', () => {
    const s = steps[TierCode.JW_HUN_5]!;
    expect(s.a.toNumber()).toBe(5_731_250);
    expect(s.b.toNumber()).toBe(5_730_000);
    expect(s.c.toNumber()).toBe(-1_250);
    expect(s.d.toNumber()).toBe(5_735_000);
    expect(s.final.toNumber()).toBe(5_739_000);
  });

  it('3 ຫຸນ derives A from the 5 ຫຸນ D value (5,735,000), not its final price', () => {
    const s = steps[TierCode.JW_HUN_3]!;
    // A = 5,735,000 / 5 * 3 + 30,000
    expect(s.a.toNumber()).toBe(3_471_000);
    // B is an independent expression: round((45,850,000 / 40 * 3) + 30,000, -4)
    expect(s.b.toNumber()).toBe(3_470_000);
    expect(s.c.toNumber()).toBe(-1_000);
    expect(s.d.toNumber()).toBe(3_475_000);
    expect(s.final.toNumber()).toBe(3_479_000);
  });

  it('2 ຫຸນ: A=2,324,000 B=2,320,000 C=-4,000 D=2,325,000', () => {
    const s = steps[TierCode.JW_HUN_2]!;
    expect(s.a.toNumber()).toBe(2_324_000);
    expect(s.b.toNumber()).toBe(2_320_000);
    expect(s.c.toNumber()).toBe(-4_000);
    expect(s.d.toNumber()).toBe(2_325_000);
    expect(s.final.toNumber()).toBe(2_329_000);
  });

  it('1 ຫຸນ is the only tier that rounds UP (C>0 -> D=B) and adds 14,000', () => {
    const s = steps[TierCode.JW_HUN_1]!;
    expect(s.a.toNumber()).toBe(1_177_000);
    expect(s.b.toNumber()).toBe(1_180_000);
    expect(s.c.toNumber()).toBe(3_000);
    expect(s.d.toNumber()).toBe(1_180_000); // C >= 0 -> B
    expect(s.final.toNumber()).toBe(1_194_000); // D + 14,000, not + 4,000
  });

  it('2 ສະຫຼຶງ is exactly twice 1 ສະຫຼຶງ', () => {
    const { prices } = computeJewelrySellPrices(P1);
    expect(prices[TierCode.JW_SALEUNG_2]!.toNumber()).toBe(
      prices[TierCode.JW_SALEUNG_1]!.mul(2).toNumber(),
    );
  });
});

describe('TOR §3.1 — worked examples quoted in the document', () => {
  it('ຄຳ 1 ບາດ buyback: 30,000,000 - 2.60% = 29,220,000', () => {
    const result = computeJewelryBuybackPrices({ [TierCode.JW_BAHT_1]: 30_000_000 });
    expect(result[TierCode.JW_BAHT_1]!.toNumber()).toBe(29_220_000);
  });

  it('ຄຳແທ່ງ 1g buyback: ROUNDDOWN(50,000,000 / 15, -3) = 3,333,000', () => {
    // Feed a bar sell price whose buyback 1-baht price is exactly 50,000,000.
    const result = computeBarBuybackPrices({
      [TierCode.BAR_BAHT_1]: 50_530_000, // 50,530,000 - 530,000 = 50,000,000
    });
    expect(result[TierCode.BAR_BAHT_1]!.toNumber()).toBe(50_000_000);
    expect(result[TierCode.BAR_GRAM_1]!.toNumber()).toBe(3_333_000);
  });

  it('ຄຳແທ່ງ sell prices divide cleanly from the 1 ບາດ bar price', () => {
    const bar = computeBarSellPrices(P1);
    const bar1 = bar[TierCode.BAR_BAHT_1]!;
    expect(bar1.toNumber()).toBe(P1 - 109_000);
    expect(bar[TierCode.BAR_SALEUNG_2]!.toNumber()).toBe(bar1.div(2).toNumber());
    expect(bar[TierCode.BAR_SALEUNG_1]!.toNumber()).toBe(bar1.div(4).toNumber());
  });
});

describe('price board integrity', () => {
  it('produces all 11 tiers in TOR display order', () => {
    const board = buildPriceBoard(P1);
    expect(board.lines).toHaveLength(11);
    expect(board.lines.map((l) => l.tier)).toEqual(TOR_TABLE.map((r) => r.tier));
  });

  it('never returns a buyback price above its sell price', () => {
    for (const p1 of [20_000_000, 30_000_000, 45_859_000, 60_000_000, 99_999_000]) {
      const board = buildPriceBoard(p1);
      for (const line of board.lines) {
        expect(
          line.buybackPrice.lte(line.sellPrice),
          `${line.tier} at P1=${p1}: buyback ${line.buybackPrice} > sell ${line.sellPrice}`,
        ).toBe(true);
      }
    }
  });

  it('is monotonic — a higher 1 ບາດ price never lowers any tier', () => {
    const low = buildPriceBoard(45_000_000);
    const high = buildPriceBoard(46_000_000);
    for (const tier of TOR_TABLE.map((r) => r.tier)) {
      expect(high.sell[tier]!.gte(low.sell[tier]!), `${tier} sell went backwards`).toBe(true);
      expect(high.buyback[tier]!.gte(low.buyback[tier]!), `${tier} buyback went backwards`).toBe(true);
    }
  });
});
