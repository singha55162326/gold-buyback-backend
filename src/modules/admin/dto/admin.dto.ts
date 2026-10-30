import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const ROLES = [
  'ADMIN',
  'MANAGER',
  'PAYMENT',
  'VALUER',
  'FINANCIAL_CONTROLLER',
  'WAREHOUSE',
] as const;

export class CreateUserDto {
  @IsString() @MaxLength(40, { message: 'ຊື່ຜູ້ໃຊ້ຍາວເກີນ 40 ຕົວ' }) @MinLength(3, { message: 'ຊື່ຜູ້ໃຊ້ສັ້ນເກີນໄປ' }) username: string;
  @IsString() @MaxLength(120, { message: 'ຊື່ ແລະ ນາມສະກຸນຍາວເກີນ 120 ຕົວ' }) @MinLength(1) fullName: string;
  @IsIn(ROLES) role: (typeof ROLES)[number];
  @IsString() @MinLength(8, { message: 'ລະຫັດຜ່ານຕ້ອງຢ່າງໜ້ອຍ 8 ໂຕ' })
  @MaxLength(72, { message: 'ລະຫັດຜ່ານຍາວເກີນ 72 ຕົວ' })
  password: string;
  @IsOptional() @IsString() @Matches(/^(\d{8})?$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' }) phone?: string;
  @IsOptional() @IsString() @Matches(/^(\d{8})?$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' }) whatsappNumber?: string;
  @IsOptional() @IsBoolean() notifyWhatsApp?: boolean;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(120, { message: 'ຊື່ ແລະ ນາມສະກຸນຍາວເກີນ 120 ຕົວ' }) fullName?: string;
  @IsOptional() @IsIn(ROLES) role?: (typeof ROLES)[number];
  @IsOptional() @IsString() @Matches(/^(\d{8})?$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' }) phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** TOR §10 — WhatsApp alert number and opt-in. */
  @IsOptional() @IsString() @Matches(/^(\d{8})?$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' }) whatsappNumber?: string;
  @IsOptional() @IsBoolean() notifyWhatsApp?: boolean;
}

export class ResetPasswordDto {
  @IsString() @MinLength(8, { message: 'ລະຫັດຜ່ານຕ້ອງຢ່າງໜ້ອຍ 8 ໂຕ' })
  @MaxLength(72, { message: 'ລະຫັດຜ່ານຍາວເກີນ 72 ຕົວ' })
  password: string;
}
