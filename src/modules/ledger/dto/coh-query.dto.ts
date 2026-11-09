import { IsOptional, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CohQueryDto {
  @ApiPropertyOptional({ example: '2026-11-08', description: 'ຢູ່ວັນທີ (YYYY-MM-DD, ຄ່າເລີ່ມຕົ້ນ = ມື້ນີ້)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'as_of ຕ້ອງເປັນຮູບແບບ YYYY-MM-DD' })
  as_of?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'camelCase alias for as_of' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'asOf ຕ້ອງເປັນຮູບແບບ YYYY-MM-DD' })
  asOf?: string;
}

