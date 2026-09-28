import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const ROLES = [
  'ADMIN',
  'MANAGER',
  'PAYMENT',
  'VALUER',
  'FINANCIAL_CONTROLLER',
  'WAREHOUSE',
] as const;

export class CreateUserDto {
  @IsString() @MinLength(3, { message: 'ຊື່ຜູ້ໃຊ້ສັ້ນເກີນໄປ' }) username: string;
  @IsString() @MinLength(1) fullName: string;
  @IsIn(ROLES) role: (typeof ROLES)[number];
  @IsString() @MinLength(8, { message: 'ລະຫັດຜ່ານຕ້ອງຢ່າງໜ້ອຍ 8 ໂຕ' }) password: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() whatsappNumber?: string;
  @IsOptional() @IsBoolean() notifyWhatsApp?: boolean;
}

export class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsIn(ROLES) role?: (typeof ROLES)[number];
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** TOR §10 — WhatsApp alert number and opt-in. */
  @IsOptional() @IsString() whatsappNumber?: string;
  @IsOptional() @IsBoolean() notifyWhatsApp?: boolean;
}

export class ResetPasswordDto {
  @IsString() @MinLength(8, { message: 'ລະຫັດຜ່ານຕ້ອງຢ່າງໜ້ອຍ 8 ໂຕ' }) password: string;
}
