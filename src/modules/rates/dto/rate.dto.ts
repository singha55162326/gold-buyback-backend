import { IsNumberString } from 'class-validator';
import { IsDecimalString } from '../../../common/dto/decimal-string.validator';

/** TOR §3.3 — 'Update Price Rate'. All four rates move together. */
export class UpdateRatesDto {
  @IsDecimalString({ labelLo: 'THB Sell Rate' })
  thbSellRate: string;

  @IsDecimalString({ labelLo: 'USD Sell Rate' })
  usdSellRate: string;

  @IsDecimalString({ labelLo: 'THB Buyback Rate' })
  thbBuybackRate: string;

  @IsDecimalString({ labelLo: 'USD Buyback Rate' })
  usdBuybackRate: string;
}
