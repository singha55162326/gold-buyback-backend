import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HistoryRangeDto } from '../../../common/dto/history-range.dto';
import { IsDecimalString } from '../../../common/dto/decimal-string.validator';

export class BuybackPaymentLineDto {
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';

  /** Required when method is BANK. */
  @IsOptional() @IsString() bankAccountId?: string;

  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';

  @IsDecimalString({ labelLo: 'ຈຳນວນເງິນ' })
  amount: string;
}

/** ແຖວລາຍການຄຳໃນບິນ Buyback. */
export class BuybackLineDto {
  @IsString() goldTypeId: string;
  @IsOptional() @IsString() goldItemId?: string;

  @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' })
  weightG: string;

  @IsInt() @Min(1, { message: 'ຈຳນວນຕ້ອງຢ່າງໜ້ອຍ 1' })
  quantity: number;

  /** %ຄຳ — ບັງຄັບສຳລັບ ຄຳຕົ້ມ (OTHER_SHOP). */
  @IsOptional() @IsDecimalString({ labelLo: '%ຄຳ', max: 100 }) goldPercent?: string;

  /** ຄ່າອ່ອນ / ຄ່າຫັກ ຕໍ່ໜ່ວຍ. */
  @IsOptional() @IsDecimalString({ labelLo: 'ຄ່າອ່ອນ / ຄ່າຫັກ' }) deduction?: string;
}

export class CreateBuybackDto {
  /** ເບີໂທ 8 ໂຕ (TOR §5.1). */
  @Matches(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' })
  phone: string;

  @IsIn(['KPV', 'OTHER_SHOP']) source: 'KPV' | 'OTHER_SHOP';

  /**
   * ຫຼາຍລາຍການຄຳໃນບິນດຽວ (ທີ່ລູກຄ້າຂໍ).
   *
   * ຍັງຮັບຊ່ອງແຖວດຽວຂ້າງລຸ່ມໄວ້ ເພື່ອບໍ່ໃຫ້ client ເກົ່າ ແລະ ສະຄຣິບທົດສອບ
   * ທີ່ມີຢູ່ແລ້ວພັງ — ຖ້າບໍ່ສົ່ງ lines ມາ ລະບົບຈະຖືວ່າເປັນບິນແຖວດຽວ.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງມີລາຍການຄຳຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @ValidateNested({ each: true })
  @Type(() => BuybackLineDto)
  lines?: BuybackLineDto[];

  @IsOptional() @IsString() goldTypeId?: string;

  @IsOptional() @IsString() goldItemId?: string;

  @IsOptional() @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' })
  weightG?: string;

  @IsOptional() @IsInt() @Min(1, { message: 'ຈຳນວນຕ້ອງຢ່າງໜ້ອຍ 1' })
  quantity?: number;

  /** %ຄຳ — required for ຄຳຕົ້ມ (OTHER_SHOP). */
  @IsOptional() @IsDecimalString({ labelLo: '%ຄຳ', max: 100 }) goldPercent?: string;

  /** ຄ່າອ່ອນ / ຄ່າຫັກ per piece. */
  @IsOptional() @IsDecimalString({ labelLo: 'ຄ່າອ່ອນ / ຄ່າຫັກ' }) deduction?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງມີລາຍການຈ່າຍເງິນຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @ValidateNested({ each: true })
  @Type(() => BuybackPaymentLineDto)
  payments: BuybackPaymentLineDto[];
}

/** Preview the §5.1 calculation without creating anything. */
/**
 * ຕົວກອງຂອງລາຍການປະຫວັດ.
 *
 * ຕ້ອງສືບທອດ `HistoryRangeDto` ເພາະ ValidationPipe ຕັ້ງ `forbidNonWhitelisted`:
 * query ໃດທີ່ບໍ່ມີໃນ DTO ຈະຖືກປະຕິເສດ 400 ເຖິງແມ່ນ handler ຈະອ່ານມັນດ້ວຍ
 * `@Query('...')` ກໍຕາມ.
 */
export class ListBuybackDto extends HistoryRangeDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
}

export class PreviewBuybackDto {
  @IsIn(['KPV', 'OTHER_SHOP']) source: 'KPV' | 'OTHER_SHOP';

  /** ຫຼາຍແຖວ — ຄືນທັງລາຄາຕໍ່ແຖວ ແລະ ຍອດລວມ. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuybackLineDto)
  lines?: BuybackLineDto[];

  @IsOptional() @IsString() goldTypeId?: string;
  @IsOptional() @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' }) weightG?: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsDecimalString({ labelLo: '%ຄຳ', max: 100 }) goldPercent?: string;
  @IsOptional() @IsDecimalString({ labelLo: 'ຄ່າອ່ອນ / ຄ່າຫັກ' }) deduction?: string;
}

export class ReviewBuybackDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(300, { message: 'ເຫດຜົນຍາວເກີນ 300 ຕົວ' }) reason?: string;
}
