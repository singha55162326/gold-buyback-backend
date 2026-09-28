import {
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

export class CreditReceiptDto {
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }) amount: string;
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
  @Type(() => CreditReceiptDto)
  receipt: CreditReceiptDto;
}

export class ReviewCreditDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() reason?: string;
}
