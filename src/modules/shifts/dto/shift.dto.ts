import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsDecimalString } from '../../../common/dto/decimal-string.validator';
import { Type } from 'class-transformer';

export class ShiftBalanceLineDto {
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' }) amount: string;
}

/** ປິດກະ — the closing LAK/THB/USD go to Module Cash pending FC approval. */
export class CloseShiftDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftBalanceLineDto)
  balances: ShiftBalanceLineDto[];

  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}

export class ReviewShiftDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(300, { message: 'ເຫດຜົນຍາວເກີນ 300 ຕົວ' }) reason?: string;
}
