import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HistoryRangeDto } from '../../../common/dto/history-range.dto';
import { IsDecimalString } from '../../../common/dto/decimal-string.validator';

export class CashAmountLineDto {
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' }) amount: string;
}

/** ເບີກເງິນ (+) / ມອບເງິນ (-) — TOR §4.1. */
export class CreateCashRequestDto {
  @IsIn(['WITHDRAW', 'HANDOVER']) direction: 'WITHDRAW' | 'HANDOVER';

  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງປ້ອນຈຳນວນເງິນຢ່າງໜ້ອຍ 1 ສະກຸນ' })
  @ValidateNested({ each: true })
  @Type(() => CashAmountLineDto)
  lines: CashAmountLineDto[];

  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}

/**
 * ຕົວກອງຂອງລາຍການປະຫວັດ.
 *
 * ຕ້ອງສືບທອດ `HistoryRangeDto` ເພາະ ValidationPipe ຕັ້ງ `forbidNonWhitelisted`:
 * query ໃດທີ່ບໍ່ມີໃນ DTO ຈະຖືກປະຕິເສດ 400 ເຖິງແມ່ນ handler ຈະອ່ານມັນດ້ວຍ
 * `@Query('...')` ກໍຕາມ.
 */
export class BankHistoryDto extends HistoryRangeDto {
  /** ຊຸດອ້າງອີງທີ່ສະແດງຢູ່ໜ້າ Payment — ປັດຈຸບັນມີແຕ່ `counter`. */
  @IsOptional() @IsIn(['counter']) sources?: string;
}

export class ReviewCashRequestDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(300, { message: 'ເຫດຜົນຍາວເກີນ 300 ຕົວ' }) reason?: string;
}

/** Direct Cash In/Out/Other Income/Expense — TOR §3.7. */
export class CreateCashTransactionDto {
  @IsIn(['IN', 'OUT', 'OTHER_INCOME', 'OTHER_EXPENSE'])
  type: 'IN' | 'OUT' | 'OTHER_INCOME' | 'OTHER_EXPENSE';

  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' }) amount: string;
  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}

/** Bank Deposit/Withdraw/Income/Expense — TOR §3.7. */
export class CreateBankTransactionDto {
  @IsString() bankAccountId: string;

  /**
   * Only ຝາກ / ຖອນ may be entered by hand.
   *
   * INCOME and EXPENSE still exist on BankTransaction, but they are written
   * by Module ຈັດການລາຍຮັບລາຍຈ່າຍ, which classifies them against a category.
   * Letting this form post them directly produced bank rows no income or
   * expense report could account for.
   */
  @IsIn(['DEPOSIT', 'WITHDRAW'], { message: 'ປະເພດທຸລະກຳຕ້ອງເປັນ ຝາກ ຫຼື ຖອນ' })
  type: 'DEPOSIT' | 'WITHDRAW';

  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' }) amount: string;
  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}

/** ເງິນ Bank ສຸດທິ — ADMIN/MANAGER only (TOR §3.7). */
export class SetBankNetBalanceDto {
  @IsString() bankAccountId: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsDecimalString({ labelLo: 'ຍອດເງິນສຸດທິ' }) netAmount: string;
}
