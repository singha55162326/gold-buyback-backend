import { IsNumberString } from 'class-validator';

/** TOR §3.3 — 'Update Price Rate'. All four rates move together. */
export class UpdateRatesDto {
  @IsNumberString({}, { message: 'THB Sell Rate ຕ້ອງເປັນຕົວເລກ' })
  thbSellRate: string;

  @IsNumberString({}, { message: 'USD Sell Rate ຕ້ອງເປັນຕົວເລກ' })
  usdSellRate: string;

  @IsNumberString({}, { message: 'THB Buyback Rate ຕ້ອງເປັນຕົວເລກ' })
  thbBuybackRate: string;

  @IsNumberString({}, { message: 'USD Buyback Rate ຕ້ອງເປັນຕົວເລກ' })
  usdBuybackRate: string;
}
