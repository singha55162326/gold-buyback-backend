import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,  ArrayMinSize,  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderReceiptDto {
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }) amount: string;
}

/** The legs of one receipt — ສົດ and ໂອນ, several currencies, one bill. */
export class OrderReceiptLinesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'ຕ້ອງມີລາຍການຮັບເງິນຢ່າງໜ້ອຍ 1 ລາຍການ' })
  @ValidateNested({ each: true })
  @Type(() => OrderReceiptDto)
  receipts: OrderReceiptDto[];
}

export class CreateOrderDto {
  @Matches(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' })
  phone: string;

  /** ເລກບິນ 4 ຕົວຫຼັກ (TOR §7). */
  @Matches(/^\d{4}$/, { message: 'ເລກບິນຕ້ອງເປັນຕົວເລກ 4 ຕົວ' })
  billNo: string;

  @IsIn(['IT', 'ITP'], { message: 'ປະເພດສິນຄ້າຕ້ອງເປັນ IT ຫຼື ITP' })
  productType: 'IT' | 'ITP';

  /** ຊື່ພະນັກງານ ທີ່ຮັບ Order. */
  @IsString() staffName: string;

  @IsString() goldItemId: string;
  @IsNumberString() weightG: string;
  @IsInt() @Min(1) quantity: number;
  @IsNumberString() totalAmount: string;
  @IsOptional() @IsString() note?: string;

  @ValidateNested()
  /** Superseded by `receipts`; accepted so an older client still works. */
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderReceiptDto)
  receipt?: OrderReceiptDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderReceiptDto)
  receipts?: OrderReceiptDto[];
}

export class UpdateOrderStatusDto {
  @IsIn([
    'SENT_TO_SMITH',
    'RECEIVED_FROM_SMITH',
    'AWAITING_PICKUP',
    'COMPLETED',
    'CANCELLED',
  ])
  status:
    | 'SENT_TO_SMITH'
    | 'RECEIVED_FROM_SMITH'
    | 'AWAITING_PICKUP'
    | 'COMPLETED'
    | 'CANCELLED';

  /** Required for SENT_TO_SMITH — ເລືອກ Supplier (TOR §7). */
  @IsOptional() @IsString() supplierId?: string;

  /** Required for RECEIVED_FROM_SMITH — ວັນທີຮັບເຄື່ອງ. */
  @IsOptional() @IsDateString() receivedFromSmithAt?: string;

  /** Required for COMPLETED — ວັນທີລູກຄ້າມາຮັບເຄື່ອງ. */
  @IsOptional() @IsDateString() customerPickupAt?: string;

  @IsOptional() @IsString() note?: string;
}

export class ReceiveOrderDto {
  /** Single-leg form, kept so an older client still works. */
  @IsOptional() @IsIn(['CASH', 'BANK']) method?: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsOptional() @IsIn(['LAK', 'THB', 'USD']) currency?: 'LAK' | 'THB' | 'USD';
  @IsOptional() @IsNumberString() amount?: string;

  /** Multi-leg form: ສົດ and ໂອນ, several currencies, one receipt. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderReceiptDto)
  receipts?: OrderReceiptDto[];
}
