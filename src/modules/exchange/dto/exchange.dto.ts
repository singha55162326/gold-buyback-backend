import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HistoryRangeDto } from '../../../common/dto/history-range.dto';
import { IsDecimalString } from '../../../common/dto/decimal-string.validator';

/**
 * ຕົວກອງຂອງລາຍການປະຫວັດ.
 *
 * ຕ້ອງສືບທອດ `HistoryRangeDto` ເພາະ ValidationPipe ຕັ້ງ `forbidNonWhitelisted`:
 * query ໃດທີ່ບໍ່ມີໃນ DTO ຈະຖືກປະຕິເສດ 400 ເຖິງແມ່ນ handler ຈະອ່ານມັນດ້ວຍ
 * `@Query('...')` ກໍຕາມ.
 */
export class ListExchangeDto extends HistoryRangeDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
}

export class ExchangeOldLineDto {
  @IsString() goldTypeId: string;
  @IsOptional() @IsString() goldItemId?: string;
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' }) weightG: string;
  @IsInt() @Min(1) quantity: number;
  /** ເກນນ້ຳໜັກ standard — the weight the piece left the shop at. */
  @IsDecimalString({ labelLo: 'ເກນນ້ຳໜັກ' }) standardWeightG: string;
}

export class ExchangeNewLineDto {
  @IsString() goldSkuId: string;
  @IsOptional() @IsString() cabinetId?: string;
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' }) weightG: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsDecimalString({ labelLo: 'ຄ່າຄຳຫຍຸບ' }) humpFee?: string;
  @IsOptional() @IsDecimalString({ labelLo: 'ຄ່າປ່ຽນຄຳແທ່ງ' }) barConvertFee?: string;
  @IsOptional() @IsDecimalString({ labelLo: 'ຄ່າລາຍ' }) patternFee?: string;
}

export class ExchangeRemainingLineDto {
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' }) weightG: string;
  @IsInt() @Min(1) quantity: number;
}

/** §5.2 now carries the same Cash/Bank payment step as §5.1. */
export class ExchangePaymentLineDto {
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' }) amount: string;
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
  @IsOptional() @IsString() @MaxLength(300, { message: 'ເຫດຜົນຍາວເກີນ 300 ຕົວ' }) reason?: string;
}
