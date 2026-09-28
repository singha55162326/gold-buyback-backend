import { IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';

/** ຄ່າປ່ຽນຮູບປະພັນ — TOR §3.4 */
export class UpsertJewelryFeeDto {
  @IsString() tierCode: string;
  @IsNumberString() weightG: string;
  @IsNumberString() feeGoodShape: string;
  @IsNumberString() feeDamagedShape: string;
}

/** ຄ່າປ່ຽນຄຳແທ່ງ — TOR §3.4 */
export class UpsertBarFeeDto {
  @IsNumberString() weightG: string;
  @IsNumberString() barToJewelry: string;
  @IsNumberString() barToBar: string;
}

/** ຄ່າອ່ອນ — TOR §3.4 */
export class UpdateSoftGoldFeeDto {
  @IsNumberString({}, { message: 'ຄ່າຄຳອ່ອນຕ້ອງເປັນຕົວເລກ' })
  value: string;
}

/** ຫັກອອກ (%) / ລາຄາລົບອອກ — TOR §3.2 */
export class UpdateDeductionDto {
  @IsString() tierCode: string;
  @IsIn(['PERCENT', 'AMOUNT']) kind: 'PERCENT' | 'AMOUNT';
  @IsNumberString() value: string;
  @IsOptional() @IsString() note?: string;
}
