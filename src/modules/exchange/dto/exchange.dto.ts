import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExchangeOldLineDto {
  @IsString() goldTypeId: string;
  @IsOptional() @IsString() goldItemId?: string;
  @IsNumberString() weightG: string;
  @IsInt() @Min(1) quantity: number;
  /** ເກນນ້ຳໜັກ standard — the weight the piece left the shop at. */
  @IsNumberString() standardWeightG: string;
}

export class ExchangeNewLineDto {
  @IsString() goldSkuId: string;
  @IsOptional() @IsString() cabinetId?: string;
  @IsNumberString() weightG: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsNumberString() humpFee?: string;
  @IsOptional() @IsNumberString() barConvertFee?: string;
  @IsOptional() @IsNumberString() patternFee?: string;
}

export class ExchangeRemainingLineDto {
  @IsNumberString() weightG: string;
  @IsInt() @Min(1) quantity: number;
}

/** §5.2 now carries the same Cash/Bank payment step as §5.1. */
export class ExchangePaymentLineDto {
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }) amount: string;
}

export class CreateExchangeDto {
  @Matches(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' })
  phone: string;

  @IsIn(['EXCHANGE_TO_CASH', 'FREE_EXCHANGE'])
  txnType: 'EXCHANGE_TO_CASH' | 'FREE_EXCHANGE';

  @IsIn(['GOOD', 'DAMAGED']) shapeCondition: 'GOOD' | 'DAMAGED';

  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງມີລາຍການຄຳເກົ່າຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @ValidateNested({ each: true })
  @Type(() => ExchangeOldLineDto)
  oldLines: ExchangeOldLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExchangeNewLineDto)
  newLines: ExchangeNewLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExchangeRemainingLineDto)
  remainingLines: ExchangeRemainingLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExchangePaymentLineDto)
  payments?: ExchangePaymentLineDto[];
}

/** Same shape, but only calculates — used by the live form. */
export class PreviewExchangeDto extends CreateExchangeDto {}

export class ReviewExchangeDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() reason?: string;
}
