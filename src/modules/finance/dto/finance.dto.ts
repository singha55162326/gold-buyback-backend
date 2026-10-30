import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HistoryRangeDto } from '../../../common/dto/history-range.dto';
import { IsDecimalString } from '../../../common/dto/decimal-string.validator';

/** §3.7 — Module ລາຍການ Bank */
export class CreateBankAccountDto {
  /** Ignored — the code is issued by CodeGeneratorService. */
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
}

export class UpdateBankAccountDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) nameLo?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** §3.7 — Module ເພີ້ມລາຍການຮັບຈ່າຍ */
export class CreateIncomeExpenseCategoryDto {
  /** Ignored — the code is issued by CodeGeneratorService. */
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
  @IsIn(['INCOME', 'EXPENSE']) kind: 'INCOME' | 'EXPENSE';
}

export class UpdateIncomeExpenseCategoryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) nameLo?: string;
  @IsOptional() @IsIn(['INCOME', 'EXPENSE']) kind?: 'INCOME' | 'EXPENSE';
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** §3.7 — Module ຈັດການລາຍຮັບລາຍຈ່າຍ */
/** One leg of a ລາຍຮັບ / ລາຍຈ່າຍ — ສົດ or ໂອນ, in one currency. */
export class IncomeExpenseLineDto {
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' }) amount: string;
}

/**
 * ຕົວກອງຂອງລາຍການປະຫວັດ.
 *
 * ຕ້ອງສືບທອດ `HistoryRangeDto` ເພາະ ValidationPipe ຕັ້ງ `forbidNonWhitelisted`:
 * query ໃດທີ່ບໍ່ມີໃນ DTO ຈະຖືກປະຕິເສດ 400 ເຖິງແມ່ນ handler ຈະອ່ານມັນດ້ວຍ
 * `@Query('...')` ກໍຕາມ.
 */
export class IncomeExpenseHistoryDto extends HistoryRangeDto {
  @IsOptional() @IsIn(['INCOME', 'EXPENSE']) kind?: 'INCOME' | 'EXPENSE';
}

export class ConsignmentListDto extends HistoryRangeDto {
  @IsOptional() @IsIn(['HELD', 'RETURNED']) status?: 'HELD' | 'RETURNED';
}

export class CreateIncomeExpenseDto {
  @IsString() categoryId: string;

  /** Single-leg form, kept so an older client still works. */
  @IsOptional() @IsIn(['CASH', 'BANK']) method?: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsOptional() @IsIn(['LAK', 'THB', 'USD']) currency?: 'LAK' | 'THB' | 'USD';
  @IsOptional() @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' }) amount?: string;

  /** Multi-leg form: one transaction paid part ສົດ, part ໂອນ. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncomeExpenseLineDto)
  payments?: IncomeExpenseLineDto[];

  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}

/** §3.7 — Module ຝາກສິນຄ້າ */
export class ConsignmentLineDto {
  @IsString() @MinLength(1) nameLo: string;
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' }) weightG: string;
  @IsInt() @Min(1) quantity: number;
}

export class CreateConsignmentDto {
  /** ປ້ອນລະຫັດ — the shop's own bill reference. */
  /** BILL ID — ຕົວເລກ 6 ໂຕ ຕາມໃບບິນເຈ້ຍຂອງຮ້ານ. */
  @Matches(/^\d{6}$/, { message: 'ລະຫັດ / BILL ID ຕ້ອງເປັນຕົວເລກ 6 ໂຕ' })
  billId: string;

  @Matches(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' })
  phone: string;

  @IsString() @MaxLength(80, { message: 'ຊື່ລູກຄ້າຍາວເກີນ 80 ຕົວ' }) @MinLength(1) customerName: string;
  @IsString() @MaxLength(80, { message: 'ຊື່ພະນັກງານຍາວເກີນ 80 ຕົວ' }) @MinLength(1) staffName: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງມີລາຍການຝາກຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @ValidateNested({ each: true })
  @Type(() => ConsignmentLineDto)
  lines: ConsignmentLineDto[];

  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}

/** §9.1 — Module ລາຍການ AP-AR (Cash) */
export class CreateApArCashCategoryDto {
  /** Ignored — the code is issued by CodeGeneratorService. */
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
  /**
   * Omit — or send 'AP_AR' — to allow the category on both sides. That is
   * the ດ້ານ = 'AP-AR' option the client asked for; it is stored as NULL,
   * which is what every reader already treats as "either side".
   */
  @IsOptional() @IsIn(['AP', 'AR', 'AP_AR']) side?: 'AP' | 'AR' | 'AP_AR';
}

export class UpdateApArCashCategoryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) nameLo?: string;
  @IsOptional() @IsIn(['AP', 'AR', 'AP_AR']) side?: 'AP' | 'AR' | 'AP_AR';
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** §9.3 / §9.4 — +Add AP Cash / +Add AR Cash */
export class CreateApArCashEntryDto {
  @IsString() partnerId: string;
  @IsString() categoryId: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' }) amount: string;
  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}

/** §9.3 / §9.4 — ປຸ່ມ Payment */
export class SettleApArCashDto {
  @IsString() partnerId: string;
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' }) amount: string;
  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}
