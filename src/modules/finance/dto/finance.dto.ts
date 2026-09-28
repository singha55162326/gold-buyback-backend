import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** §3.7 — Module ລາຍການ Bank */
export class CreateBankAccountDto {
  @IsString() @MinLength(2) @MaxLength(40) code: string;
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
}

/** §3.7 — Module ເພີ້ມລາຍການຮັບຈ່າຍ */
export class CreateIncomeExpenseCategoryDto {
  @IsString() @MinLength(2) @MaxLength(40) code: string;
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
  @IsIn(['INCOME', 'EXPENSE']) kind: 'INCOME' | 'EXPENSE';
}

/** §3.7 — Module ຈັດການລາຍຮັບລາຍຈ່າຍ */
export class CreateIncomeExpenseDto {
  @IsString() categoryId: string;
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }) amount: string;
  @IsOptional() @IsString() note?: string;
}

/** §3.7 — Module ຝາກສິນຄ້າ */
export class ConsignmentLineDto {
  @IsString() @MinLength(1) nameLo: string;
  @IsNumberString() weightG: string;
  @IsInt() @Min(1) quantity: number;
}

export class CreateConsignmentDto {
  /** ປ້ອນລະຫັດ — the shop's own bill reference. */
  @IsString() @MinLength(1) @MaxLength(40) billId: string;

  @Matches(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' })
  phone: string;

  @IsString() @MinLength(1) customerName: string;
  @IsString() @MinLength(1) staffName: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງມີລາຍການຝາກຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @ValidateNested({ each: true })
  @Type(() => ConsignmentLineDto)
  lines: ConsignmentLineDto[];

  @IsOptional() @IsString() note?: string;
}

/** §9.1 — Module ລາຍການ AP-AR (Cash) */
export class CreateApArCashCategoryDto {
  @IsString() @MinLength(2) @MaxLength(40) code: string;
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
  /** Omit to allow the category on both sides. */
  @IsOptional() @IsIn(['AP', 'AR']) side?: 'AP' | 'AR';
}

/** §9.3 / §9.4 — +Add AP Cash / +Add AR Cash */
export class CreateApArCashEntryDto {
  @IsString() partnerId: string;
  @IsString() categoryId: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }) amount: string;
  @IsOptional() @IsString() note?: string;
}

/** §9.3 / §9.4 — ປຸ່ມ Payment */
export class SettleApArCashDto {
  @IsString() partnerId: string;
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString() amount: string;
  @IsOptional() @IsString() note?: string;
}
