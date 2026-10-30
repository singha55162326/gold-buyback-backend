import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HistoryRangeDto } from '../../../common/dto/history-range.dto';
import { IsDecimalString } from '../../../common/dto/decimal-string.validator';

export class StockLineDto {
  /** Stock (NEW) lines reference a SKU. */
  @IsOptional() @IsString() goldSkuId?: string;
  /** Stock (OLD) lines reference a ປະເພດຄຳ. */
  @IsOptional() @IsString() goldTypeId?: string;
  /** ລາຍການຄຳ — ຝັ່ງ OLD ບໍ່ມີ SKU, ແຕ່ຍັງຢາກຮູ້ວ່າເປັນສາຍແຂນ ຫຼື ແຫວນ. */
  @IsOptional() @IsString() goldItemId?: string;
  /** ໝວດ (ຮູບປະພັນ / ແທ່ງ) — Stock OLD IN ເທົ່ານັ້ນ. */
  @IsOptional() @IsIn(['JEWELRY', 'BAR']) oldCategory?: 'JEWELRY' | 'BAR';
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' }) weightG: string;
  @IsInt() @Min(1) quantity: number;
}

export class CreateStockInDto {
  @IsIn(['NEW', 'OLD']) scope: 'NEW' | 'OLD';
  /** Stock (NEW) ເທົ່ານັ້ນ — ຄຳເກົ່າເຂົ້າສາງ ແມ່ນ Cashier ສະເໝີ. */
  @IsOptional() @IsString() partnerId?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງມີລາຍການຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  lines: StockLineDto[];

  /** ຕົ້ນທຶນຄໍາ for the whole movement. */
  @IsDecimalString({ labelLo: 'ຕົ້ນທຶນຄຳ' }) totalCost: string;

  /**
   * ຄ່າແຮງ (THB) — becomes an AP (Cash) liability.
   * Stock (NEW) ເທົ່ານັ້ນ; ຄຳເກົ່າຮັບມາຈາກ Cashier ບໍ່ມີຄ່າແຮງ.
   */
  @IsOptional() @IsDecimalString({ labelLo: 'ຄ່າແຮງ' }) laborFeeThb?: string;

  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}

export class CreateStockOutDto {
  @IsIn(['NEW', 'OLD']) scope: 'NEW' | 'OLD';
  @IsString() partnerId: string;
  @IsOptional() @IsString() cabinetId?: string;

  /** ແປງສະພາບ — ຍ້ອມ / ກັດ / ຫຼອມ. */
  @IsOptional() @IsIn(['DYE', 'ETCH', 'MELT']) transformType?: 'DYE' | 'ETCH' | 'MELT';

  /** %ຄຳ — for OUT to ຊ່າງນອກ / ອື່ນໆ. */
  @IsOptional() @IsDecimalString({ labelLo: '%ຄຳ', max: 100 }) goldPercent?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  lines: StockLineDto[];

  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}

export class CreateTransferDto {
  @IsIn(['NEW_TO_OLD', 'OLD_TO_NEW']) direction: 'NEW_TO_OLD' | 'OLD_TO_NEW';
  /** The ປະເພດຄຳ bucket on the OLD side of the transfer. */
  @IsString() goldTypeId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  lines: StockLineDto[];

  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}

export class ReviewStockDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(300, { message: 'ເຫດຜົນຍາວເກີນ 300 ຕົວ' }) reason?: string;
}

export class FactoryAssessmentDto {
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກທີ່ FACTORY ປະເມີນ' })
  factoryAssessedG: string;
}

/**
 * ມອບຄຳລະຫວ່າງມື້ (TOR §4.2).
 *
 * ສອງຮູບແບບໃນ DTO ດຽວ ເພາະເປັນທຸລະກຳອັນດຽວກັນໃນສາຍຕາລູກຄ້າ:
 *  - ຄຳດີ / ຄຳຫຍຸບ / ແທ່ງ → ປ້ອນ ນ້ຳໜັກອອກ + ເນື້ອລ້ວນ + ມີແກ້ວ, ໄລ່ເປັນຮອບ.
 *  - ຄຳຕົ້ມ → ເລືອກລາຍການ Buyback ທີ່ຍັງບໍ່ໄດ້ມອບ, ບໍ່ໄລ່ເປັນຮອບ.
 * ຝ່າຍ server ເປັນຜູ້ຕັດສິນວ່າເປັນຮູບແບບໃດ ຈາກ ປະເພດຄຳ — ບໍ່ເຊື່ອ flag ຈາກ client.
 */
/**
 * ຕົວກອງຂອງ History ມອບຄຳ.
 *
 * ຕ້ອງສືບທອດ `HistoryRangeDto` ເພາະ ValidationPipe ຕັ້ງ `forbidNonWhitelisted`
 * ໄວ້: query ໃດທີ່ບໍ່ມີໃນ DTO ຈະຖືກປະຕິເສດ 400 ເຖິງແມ່ນ handler ຈະອ່ານມັນ
 * ດ້ວຍ `@Query('...')` ກໍຕາມ.
 */
export class HandoverQueryDto extends HistoryRangeDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';

  /** ກອງຕາມປະເພດຄຳ. */
  @IsOptional() @IsString() goldTypeId?: string;

  /** ຄົ້ນຫາ ລະຫັດ / ລາຍການ / ຜູ້ມອບ. */
  @IsOptional() @IsString() @MaxLength(100, { message: 'ຄຳຄົ້ນຫາຍາວເກີນ 100 ຕົວ' }) q?: string;
}

/** ໜຶ່ງປະເພດຄຳໃນຮອບດຽວ — ຮອບໜຶ່ງມອບໄດ້ ຄຳດີ + ຄຳຫຍຸບ + ແທ່ງ ພ້ອມກັນ. */
export class HandoverTypeLineDto {
  @IsString() goldTypeId: string;

  /** ນ້ຳໜັກລວມອອກ. */
  @IsDecimalString({ labelLo: 'ນ້ຳໜັກລວມອອກ' })
  outWeightG: string;

  /** ເນື້ອລ້ວນ — ຄຳດີ / ຄຳຫຍຸບ ເທົ່ານັ້ນ. */
  @IsOptional() @IsDecimalString({ labelLo: 'ເນື້ອລ້ວນ' })
  pureWeightG?: string;

  /** ມີແກ້ວ — ຄຳດີ / ຄຳຫຍຸບ ເທົ່ານັ້ນ. */
  @IsOptional() @IsDecimalString({ labelLo: 'ນ້ຳໜັກມີແກ້ວ' })
  glassWeightG?: string;
}

export class CreateHandoverDto {
  /** ບັງຄັບສຳລັບ ຄຳຕົ້ມ ແລະ ຮູບແບບແຖວດຽວເກົ່າ; ຮອບຫຼາຍປະເພດໃຊ້ `lines`. */
  @IsOptional() @IsString() goldTypeId?: string;

  /** ຮອບດຽວ ຫຼາຍປະເພດຄຳ — ທຸກແຖວໄດ້ ຮອບທີ ອັນດຽວກັນ. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງເລືອກປະເພດຄຳຢ່າງໜ້ອຍ 1 ປະເພດ' })
  @ValidateNested({ each: true })
  @Type(() => HandoverTypeLineDto)
  lines?: HandoverTypeLineDto[];

  /** ນ້ຳໜັກອອກ — ບັງຄັບສຳລັບ ຄຳດີ/ຄຳຫຍຸບ/ແທ່ງ. */
  @IsOptional() @IsDecimalString({ labelLo: 'ນ້ຳໜັກອອກ' })
  grossWeightG?: string;

  /** ເນື້ອລ້ວນ. */
  @IsOptional() @IsDecimalString({ labelLo: 'ເນື້ອລ້ວນ' })
  pureWeightG?: string;

  /** ມີແກ້ວ. */
  @IsOptional() @IsDecimalString({ labelLo: 'ນ້ຳໜັກມີແກ້ວ' })
  glassWeightG?: string;

  /** ລາຍການ Buyback ຄຳຕົ້ມ ທີ່ມອບໃນຮອບນີ້. */
  @IsOptional() @IsArray() @ArrayMinSize(1, { message: 'ຕ້ອງເລືອກລາຍການຄຳເກົ່າຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @IsString({ each: true })
  buybackIds?: string[];

  /**
   * ຮູບແບບເກົ່າ: ນ້ຳໜັກກ້ອນດຽວ. ຍັງຮັບໄວ້ເພື່ອບໍ່ໃຫ້ client ເກົ່າພັງ,
   * ແຕ່ຟອມໃໝ່ສົ່ງ grossWeightG ມາແທນ.
   */
  @IsOptional() @IsDecimalString({ labelLo: 'ນ້ຳໜັກ' }) weightG?: string;

  @IsOptional() @IsString() @MaxLength(500, { message: 'ໝາຍເຫດຍາວເກີນ 500 ຕົວ' }) note?: string;
}
