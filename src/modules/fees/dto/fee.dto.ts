import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsDecimalString } from '../../../common/dto/decimal-string.validator';

/** ຄ່າປ່ຽນຮູບປະພັນ — TOR §3.4 */
export class UpsertJewelryFeeDto {
  @IsString() tierCode: string;
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' }) weightG: string;
  @IsDecimalString({ labelLo: 'ຄ່າປ່ຽນ (ຮູບຊົງດີ)' }) feeGoodShape: string;
  @IsDecimalString({ labelLo: 'ຄ່າປ່ຽນ (ຮູບຊົງເພ)' }) feeDamagedShape: string;
}

/** ຄ່າປ່ຽນຄຳແທ່ງ — TOR §3.4 */
export class UpsertBarFeeDto {
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' }) weightG: string;
  @IsDecimalString({ labelLo: 'ຄ່າປ່ຽນ ແທ່ງ → ຮູບປະພັນ' }) barToJewelry: string;
  @IsDecimalString({ labelLo: 'ຄ່າປ່ຽນ ແທ່ງ → ແທ່ງ' }) barToBar: string;
}

/** ຄ່າອ່ອນ — TOR §3.4 */
export class UpdateSoftGoldFeeDto {
  @IsDecimalString({ labelLo: 'ຄ່າ' })
  value: string;
}

/** ຫັກອອກ (%) / ລາຄາລົບອອກ — TOR §3.2 */
export class UpdateDeductionDto {
  @IsString() tierCode: string;
  @IsIn(['PERCENT', 'AMOUNT']) kind: 'PERCENT' | 'AMOUNT';
  @IsDecimalString({ labelLo: 'ຄ່າ' }) value: string;
  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}
