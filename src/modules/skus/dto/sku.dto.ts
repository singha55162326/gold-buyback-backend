import { IsBoolean, IsNumberString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSkuDto {
  @IsString()
  goldItemId: string;

  /** ຊື່ສິນຄ້າ, e.g. "ສາຍແຂນ". */
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameLo: string;

  /** ນ້ຳໜັກ (g). String to preserve DECIMAL(18,4) precision. */
  @IsNumberString({ no_symbols: false }, { message: 'ນ້ຳໜັກຕ້ອງເປັນຕົວເລກ' })
  weightG: string;
}

export class UpdateSkuDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameLo?: string;

  @IsOptional()
  @IsNumberString()
  weightG?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
