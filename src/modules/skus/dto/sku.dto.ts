import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsDecimalString } from '../../../common/dto/decimal-string.validator';

export class CreateSkuDto {
  @IsString()
  goldItemId: string;

  /** ຊື່ສິນຄ້າ, e.g. "ສາຍແຂນ". */
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameLo: string;

  /** ນ້ຳໜັກ (g). String to preserve DECIMAL(18,4) precision. */
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' })
  weightG: string;
}

export class UpdateSkuDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameLo?: string;

  @IsOptional()
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' })
  weightG?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
