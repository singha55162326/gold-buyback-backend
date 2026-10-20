import {
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,  ArrayMinSize,  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreditReceiptDto {
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }) amount: string;
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

export class CreateCreditDto {
  @Matches(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' })
  phone: string;

  @IsString() goldItemId: string;
  @IsOptional() @IsString() cabinetId?: string;
  @IsNumberString() weightG: string;
  @IsInt() @Min(1) quantity: number;
  @IsNumberString() sellPrice: string;
  @IsNumberString() downPayment: string;

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
  @IsOptional() @IsString() reason?: string;
}

export class ReceiveCreditDto {
  /** Single-leg form, kept so an older client still works. */
  @IsOptional() @IsIn(['CASH', 'BANK']) method?: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsOptional() @IsIn(['LAK', 'THB', 'USD']) currency?: 'LAK' | 'THB' | 'USD';
  @IsOptional() @IsNumberString() amount?: string;

  /** Multi-leg form: ສົດ and ໂອນ, several currencies, one receipt. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditReceiptDto)
  receipts?: CreditReceiptDto[];
}
