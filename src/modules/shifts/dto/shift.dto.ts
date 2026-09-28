import { IsArray, IsIn, IsNumberString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ShiftBalanceLineDto {
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString() amount: string;
}

/** ປິດກະ — the closing LAK/THB/USD go to Module Cash pending FC approval. */
export class CloseShiftDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftBalanceLineDto)
  balances: ShiftBalanceLineDto[];

  @IsOptional() @IsString() note?: string;
}

export class ReviewShiftDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() reason?: string;
}
