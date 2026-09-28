import { Injectable, NotFoundException } from '@nestjs/common';
import type { ExchangeRateSnapshot, PriceSnapshot } from '@prisma/client';
import {
  dec,
  lookupExact,
  makePriceTable,
  TIER_META,
  TierCode,
  type BuybackGoldKind,
  type BuybackPriceSource,
  type Currency,
  type Decimal,
  type PriceTableEntry,
} from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Everything a transaction needs in order to be priced, loaded once and
 * passed around as a unit: the price snapshot it is quoted against, the
 * §5.1 lookup table, the current ຄ່າອ່ອນ and the current exchange rates.
 *
 * Bundling them matters for correctness, not just convenience — a buyback
 * must quote its buyback price and its currency rate from the same instant,
 * or a receipt cannot be reproduced later.
 */
export interface PricingContext {
  snapshot: PriceSnapshot;
  source: BuybackPriceSource;
  table: PriceTableEntry[];
  /** ຄ່າອ່ອນ per gram (TOR §3.4). */
  softGoldFeePerGram: Decimal;
  rates: ExchangeRateSnapshot;
}

/** Which of the two 1-baht buyback prices a ປະເພດຄຳ is settled against. */
const BAR_KINDS = new Set<BuybackGoldKind>(['BAR']);

@Injectable()
export class PricingContextService {
  constructor(private readonly prisma: PrismaService) {}

  async load(): Promise<PricingContext> {
    const [snapshot, softFee, rates] = await Promise.all([
      this.prisma.priceSnapshot.findFirst({
        orderBy: { effectiveAt: 'desc' },
        include: { lines: true },
      }),
      this.prisma.softGoldFeeSnapshot.findFirst({ orderBy: { effectiveAt: 'desc' } }),
      this.prisma.exchangeRateSnapshot.findFirst({ orderBy: { effectiveAt: 'desc' } }),
    ]);

    if (!snapshot) throw new NotFoundException('ຍັງບໍ່ມີການຕັ້ງລາຄາ — ກະລຸນາຕັ້ງລາຄາຂາຍ 1 ບາດ ກ່ອນ');
    if (!softFee) throw new NotFoundException('ຍັງບໍ່ມີການຕັ້ງຄ່າອ່ອນ');
    if (!rates) throw new NotFoundException('ຍັງບໍ່ມີການຕັ້ງອັດຕາແລກປ່ຽນ');

    const buybackByTier = new Map(
      snapshot.lines.map((line) => [line.tierCode, dec(line.buybackPrice.toFixed())]),
    );

    // Keyed by DISPLAY weight (1.87), which is what the shop's own workbook
    // matches on: both the buyback price (ຄຳຮ້ານKPV!G6) and the ຄ່າອ່ອນ
    // standard (ປ່ຽນເປັນເງິນ!F9) look up Produets column B, the printed
    // weight — not column C, the 1.875 figure. Column C keys the ຄ່າປ່ຽນ
    // table instead. Using 1.875 here priced a genuine 1.87 g piece at zero.
    const table = makePriceTable(
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
      )
        .filter((tier) => buybackByTier.has(tier))
        .map((tier) => ({
          tierCode: tier,
          weightG: TIER_META[tier].displayWeightG,
          buybackPrice: buybackByTier.get(tier)!,
        })),
    );

    const barTable = makePriceTable(
      (
        [
          TierCode.BAR_BAHT_1,
          TierCode.BAR_SALEUNG_2,
          TierCode.BAR_SALEUNG_1,
          TierCode.BAR_GRAM_1,
        ] as const
      )
        .filter((tier) => buybackByTier.has(tier))
        .map((tier) => ({
          tierCode: tier,
          weightG: TIER_META[tier].displayWeightG,
          buybackPrice: buybackByTier.get(tier)!,
        })),
    );

    const source: BuybackPriceSource = {
      price1BahtFor: (kind) =>
        buybackByTier.get(BAR_KINDS.has(kind) ? TierCode.BAR_BAHT_1 : TierCode.JW_BAHT_1) ?? dec(0),
      lookup: (kind, weightG) =>
        lookupExact(BAR_KINDS.has(kind) ? barTable : table, weightG),
    };

    return {
      snapshot,
      source,
      table,
      softGoldFeePerGram: dec(softFee.value.toFixed()),
      rates,
    };
  }

  /**
   * The rate to apply to a foreign-currency leg.
   *
   * `sell` rates are used when the shop TAKES money in (Order, Credit);
   * `buyback` rates when it PAYS money out (Buyback, Exchange). LAK is always
   * 1 so callers never special-case the home currency.
   */
  static rateFor(
    rates: ExchangeRateSnapshot,
    currency: Currency,
    direction: 'sell' | 'buyback',
  ): Decimal {
    if (currency === 'LAK') return dec(1);
    if (currency === 'THB') {
      return dec((direction === 'sell' ? rates.thbSellRate : rates.thbBuybackRate).toFixed());
    }
    return dec((direction === 'sell' ? rates.usdSellRate : rates.usdBuybackRate).toFixed());
  }
}
