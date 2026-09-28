import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGoldTypeDto {
  @IsString() @MinLength(2) @MaxLength(40) code: string;
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
  @IsOptional() @IsBoolean() isStockType?: boolean;
}

export class CreateGoldItemDto {
  @IsString() @MinLength(2) @MaxLength(40) code: string;
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
}

export class CreateCabinetDto {
  @IsString() @MinLength(2) @MaxLength(40) code: string;
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
}

export class CreatePartnerDto {
  @IsString() @MinLength(2) @MaxLength(40) code: string;
  @IsString() @MinLength(1) @MaxLength(80) nameLo: string;
  @IsIn(['IN', 'OUT', 'BOTH']) direction: 'IN' | 'OUT' | 'BOTH';
  @IsOptional() @IsBoolean() tracksGoldApAr?: boolean;
}
