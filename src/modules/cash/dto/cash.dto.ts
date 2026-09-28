import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CashAmountLineDto {
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }) amount: string;
}

/** ເບີກເງິນ (+) / ມອບເງິນ (-) — TOR §4.1. */
export class CreateCashRequestDto {
  @IsIn(['WITHDRAW', 'HANDOVER']) direction: 'WITHDRAW' | 'HANDOVER';

  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງປ້ອນຈຳນວນເງິນຢ່າງໜ້ອຍ 1 ສະກຸນ' })
  @ValidateNested({ each: true })
  @Type(() => CashAmountLineDto)
  lines: CashAmountLineDto[];

  @IsOptional() @IsString() note?: string;
}

export class ReviewCashRequestDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() reason?: string;
}

/** Direct Cash In/Out/Other Income/Expense — TOR §3.7. */
export class CreateCashTransactionDto {
  @IsIn(['IN', 'OUT', 'OTHER_INCOME', 'OTHER_EXPENSE'])
  type: 'IN' | 'OUT' | 'OTHER_INCOME' | 'OTHER_EXPENSE';

  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString() amount: string;
  @IsOptional() @IsString() note?: string;
}

/** Bank Deposit/Withdraw/Income/Expense — TOR §3.7. */
export class CreateBankTransactionDto {
  @IsString() bankAccountId: string;

  @IsIn(['DEPOSIT', 'WITHDRAW', 'INCOME', 'EXPENSE'])
  type: 'DEPOSIT' | 'WITHDRAW' | 'INCOME' | 'EXPENSE';

  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString() amount: string;
  @IsOptional() @IsString() note?: string;
}

/** ເງິນ Bank ສຸດທິ — ADMIN/MANAGER only (TOR §3.7). */
export class SetBankNetBalanceDto {
  @IsString() bankAccountId: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString() netAmount: string;
}
