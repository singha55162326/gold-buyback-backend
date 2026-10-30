import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsDecimalString } from '../../../common/dto/decimal-string.validator';

export class SetPricingDto {
  /**
   * ລາຄາຂາຍ 1 ບາດ. Sent as a string so the value never passes through a
   * JS float on its way from the browser to DECIMAL(18,4).
   */
  @IsDecimalString({ labelLo: 'ລາຄາຂາຍ 1 ບາດ' })
  price1Baht: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PreviewPricingDto extends SetPricingDto {}
