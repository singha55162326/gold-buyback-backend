import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderReceiptDto {
  @IsIn(['CASH', 'BANK']) method: 'CASH' | 'BANK';
  @IsOptional() @IsString() bankAccountId?: string;
  @IsIn(['LAK', 'THB', 'USD']) currency: 'LAK' | 'THB' | 'USD';
  @IsNumberString({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }) amount: string;
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
  @Type(() => OrderReceiptDto)
  receipt: OrderReceiptDto;
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
