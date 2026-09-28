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

export class BuybackPaymentLineDto {
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';

  /** Required when method is BANK. */
  @IsOptional() @IsString() bankAccountId?: string;

  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';

  @IsNumberString({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' })
  amount: string;
}

export class CreateBuybackDto {
  /** ເບີໂທ 8 ໂຕ (TOR §5.1). */
  @Matches(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' })
  phone: string;

  @IsIn(['KPV', 'OTHER_SHOP']) source: 'KPV' | 'OTHER_SHOP';

  @IsString() goldTypeId: string;

  @IsOptional() @IsString() goldItemId?: string;

  @IsNumberString({}, { message: 'ນ້ຳໜັກຕ້ອງເປັນຕົວເລກ' })
  weightG: string;

  @IsInt() @Min(1, { message: 'ຈຳນວນຕ້ອງຢ່າງໜ້ອຍ 1' })
  quantity: number;

  /** %ຄຳ — required for ຄຳຕົ້ມ (OTHER_SHOP). */
  @IsOptional() @IsNumberString() goldPercent?: string;

  /** ຄ່າອ່ອນ / ຄ່າຫັກ per piece. */
  @IsOptional() @IsNumberString() deduction?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງມີລາຍການຈ່າຍເງິນຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @ValidateNested({ each: true })
  @Type(() => BuybackPaymentLineDto)
  payments: BuybackPaymentLineDto[];
}

/** Preview the §5.1 calculation without creating anything. */
export class PreviewBuybackDto {
  @IsIn(['KPV', 'OTHER_SHOP']) source: 'KPV' | 'OTHER_SHOP';
  @IsString() goldTypeId: string;
  @IsNumberString() weightG: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsNumberString() goldPercent?: string;
  @IsOptional() @IsNumberString() deduction?: string;
}

export class ReviewBuybackDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() reason?: string;
}
