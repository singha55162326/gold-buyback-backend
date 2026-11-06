import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApArSide } from '@prisma/client';
import { HistoryRangeDto } from '../../../common/dto/history-range.dto';

export class GoldApArHistoryDto extends HistoryRangeDto {
  @ApiPropertyOptional({ enum: ['AP', 'AR'], description: 'ດ້ານ AP ຫຼື AR' })
  @IsOptional()
  @IsEnum(['AP', 'AR'])
  side?: ApArSide;

  @ApiPropertyOptional({ description: 'ID ຂອງຄູ່ຄ້າ/ແຫຼ່ງ' })
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'ID ຂອງຄູ່ຄ້າ/ແຫຼ່ງ (snake_case alias)' })
  @IsOptional()
  @IsString()
  partner_id?: string;
}
