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
  @IsNumberString() weightG: string;
  @IsInt() @Min(1) quantity: number;
}

export class CreateStockInDto {
  @IsIn(['NEW', 'OLD']) scope: 'NEW' | 'OLD';
  @IsString() partnerId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງມີລາຍການຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  lines: StockLineDto[];

  /** ຕົ້ນທຶນຄໍາ for the whole movement. */
  @IsNumberString() totalCost: string;

  /** ຄ່າແຮງ (THB) — becomes an AP (Cash) liability. */
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

export class CreateHandoverDto {
  @IsString() goldTypeId: string;
  @IsNumberString() weightG: string;
  @IsOptional() @IsString() note?: string;
}
