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

export class CreditReceiptDto {
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' }) amount: string;
}

/**
 * One payment leg. A single transaction may mix ສົດ and ໂອນ across several
 * currencies, so these arrive as a list and the shop's money moves once per
 * leg rather than once per transaction.
 */
export class ReceiptLinesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງມີລາຍການຮັບເງິນຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @ValidateNested({ each: true })
  @Type(() => CreditReceiptDto)
  receipts: CreditReceiptDto[];
}

/**
 * ຕົວກອງຂອງລາຍການປະຫວັດ.
 *
 * ຕ້ອງສືບທອດ `HistoryRangeDto` ເພາະ ValidationPipe ຕັ້ງ `forbidNonWhitelisted`:
 * query ໃດທີ່ບໍ່ມີໃນ DTO ຈະຖືກປະຕິເສດ 400 ເຖິງແມ່ນ handler ຈະອ່ານມັນດ້ວຍ
 * `@Query('...')` ກໍຕາມ.
 */
export class ListCreditDto extends HistoryRangeDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
}

export class CreateCreditDto {
  @Matches(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' })
  phone: string;

  @IsString() goldItemId: string;
  @IsOptional() @IsString() cabinetId?: string;
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' }) weightG: string;
  @IsInt() @Min(1) quantity: number;
  @IsDecimalString({ labelLo: 'ລາຄາຂາຍ' }) sellPrice: string;
  @IsDecimalString({ labelLo: 'ເງິນວາງດາວ' }) downPayment: string;

  @ValidateNested()
  /** Superseded by `receipts`; accepted so an older client still works. */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreditReceiptDto)
  receipt?: CreditReceiptDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditReceiptDto)
  receipts?: CreditReceiptDto[];
}

export class ReviewCreditDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(300, { message: 'ເຫດຜົນຍາວເກີນ 300 ຕົວ' }) reason?: string;
}

export class ReceiveCreditDto {
  /** Single-leg form, kept so an older client still works. */
  @IsOptional() @IsIn(['CASH', 'BANK']) method?: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsOptional() @IsIn(['LAK', 'THB', 'USD']) currency?: 'LAK' | 'THB' | 'USD';
  @IsOptional() @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' }) amount?: string;

  /** Multi-leg form: ສົດ and ໂອນ, several currencies, one receipt. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditReceiptDto)
  receipts?: CreditReceiptDto[];
}
