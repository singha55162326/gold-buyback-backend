import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `code` is no longer accepted on create — it is issued by
 * CodeGeneratorService so two people saving at once cannot collide, and so
 * the forms have one less field to get wrong. It stays here only to keep an
 * older client from being rejected outright; the value is ignored.
 */
class LegacyCode {
  @ApiPropertyOptional({ deprecated: true, description: 'ບໍ່ໃຊ້ແລ້ວ — ລະຫັດອອກອັດຕະໂນມັດ' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;
}

export class CreateGoldTypeDto extends LegacyCode {
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
  @IsOptional() @IsBoolean() isStockType?: boolean;
}

export class CreateGoldItemDto extends LegacyCode {
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
}

export class CreateCabinetDto extends LegacyCode {
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
}

export class CreatePartnerDto extends LegacyCode {
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
  @IsIn(['IN', 'OUT', 'BOTH']) direction: 'IN' | 'OUT' | 'BOTH';
  @IsOptional() @IsBoolean() tracksGoldApAr?: boolean;
}

/**
 * Updates never touch `code`. An issued code may already be printed on a
 * receipt or quoted in a ledger row, so it is the one field that has to stay
 * put once the row exists.
 */
export class UpdateGoldTypeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) nameLo?: string;
  @IsOptional() @IsBoolean() isStockType?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateGoldItemDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) nameLo?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCabinetDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) nameLo?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdatePartnerDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) nameLo?: string;
  @IsOptional() @IsIn(['IN', 'OUT', 'BOTH']) direction?: 'IN' | 'OUT' | 'BOTH';
  @IsOptional() @IsBoolean() tracksGoldApAr?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
