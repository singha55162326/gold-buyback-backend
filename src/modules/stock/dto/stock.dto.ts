import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StockLineDto {
  /** Stock (NEW) lines reference a SKU. */
  @IsOptional() @IsString() goldSkuId?: string;
  /** Stock (OLD) lines reference a ປະເພດຄຳ. */
  @IsOptional() @IsString() goldTypeId?: string;
  /** ໝວດ (ຮູບປະພັນ / ແທ່ງ) — Stock OLD IN ເທົ່ານັ້ນ. */
  @IsOptional() @IsIn(['JEWELRY', 'BAR']) oldCategory?: 'JEWELRY' | 'BAR';
  @IsNumberString() weightG: string;
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
  @IsNumberString() totalCost: string;

  /**
   * ຄ່າແຮງ (THB) — becomes an AP (Cash) liability.
   * Stock (NEW) ເທົ່ານັ້ນ; ຄຳເກົ່າຮັບມາຈາກ Cashier ບໍ່ມີຄ່າແຮງ.
   */
  @IsOptional() @IsNumberString() laborFeeThb?: string;

  @IsOptional() @IsString() note?: string;
}

export class CreateStockOutDto {
  @IsIn(['NEW', 'OLD']) scope: 'NEW' | 'OLD';
  @IsString() partnerId: string;
  @IsOptional() @IsString() cabinetId?: string;

  /** ແປງສະພາບ — ຍ້ອມ / ກັດ / ຫຼອມ. */
  @IsOptional() @IsIn(['DYE', 'ETCH', 'MELT']) transformType?: 'DYE' | 'ETCH' | 'MELT';

  /** %ຄຳ — for OUT to ຊ່າງນອກ / ອື່ນໆ. */
  @IsOptional() @IsNumberString() goldPercent?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  lines: StockLineDto[];

  @IsOptional() @IsString() note?: string;
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

  @IsOptional() @IsString() note?: string;
}

export class ReviewStockDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() reason?: string;
}

export class FactoryAssessmentDto {
  @IsNumberString({}, { message: 'ນ້ຳໜັກຕ້ອງເປັນຕົວເລກ' })
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
export class CreateHandoverDto {
  @IsString() goldTypeId: string;

  /** ນ້ຳໜັກອອກ — ບັງຄັບສຳລັບ ຄຳດີ/ຄຳຫຍຸບ/ແທ່ງ. */
  @IsOptional() @IsNumberString({}, { message: 'ນ້ຳໜັກອອກຕ້ອງເປັນຕົວເລກ' })
  grossWeightG?: string;

  /** ເນື້ອລ້ວນ. */
  @IsOptional() @IsNumberString({}, { message: 'ເນື້ອລ້ວນຕ້ອງເປັນຕົວເລກ' })
  pureWeightG?: string;

  /** ມີແກ້ວ. */
  @IsOptional() @IsNumberString({}, { message: 'ນ້ຳໜັກມີແກ້ວຕ້ອງເປັນຕົວເລກ' })
  glassWeightG?: string;

  /** ລາຍການ Buyback ຄຳຕົ້ມ ທີ່ມອບໃນຮອບນີ້. */
  @IsOptional() @IsArray() @ArrayMinSize(1, { message: 'ຕ້ອງເລືອກລາຍການຄຳເກົ່າຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @IsString({ each: true })
  buybackIds?: string[];

  /**
   * ຮູບແບບເກົ່າ: ນ້ຳໜັກກ້ອນດຽວ. ຍັງຮັບໄວ້ເພື່ອບໍ່ໃຫ້ client ເກົ່າພັງ,
   * ແຕ່ຟອມໃໝ່ສົ່ງ grossWeightG ມາແທນ.
   */
  @IsOptional() @IsNumberString() weightG?: string;

  @IsOptional() @IsString() note?: string;
}
