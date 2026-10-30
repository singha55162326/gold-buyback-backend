import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ຊ່ອງວ່າງ = ບໍ່ໄດ້ສົ່ງມາ.
 *
 * `@IsOptional()` ຂອງ class-validator ຖືວ່າມີແຕ່ `undefined`/`null` ເທົ່ານັ້ນ
 * ທີ່ "ບໍ່ມີ" — ສະຕຣິງວ່າງຍັງຖືວ່າມີ ແລ້ວຕົກ `@Matches` ເປັນ 400. ແຕ່
 * `<input type="date">` ທີ່ຜູ້ໃຊ້ລ້າງອອກ ສົ່ງມາເປັນ `from_date=` ແທ້ໆ, ແລະ
 * `?from_date=` ຄວນໝາຍຄວາມວ່າ "ບໍ່ໄດ້ກອງ" ບໍ່ແມ່ນ "ຮູບແບບວັນທີຜິດ".
 */
const BlankIsAbsent = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value));

/** ຄືກັນ ແຕ່ແປງເປັນຕົວເລກ — ແທນ `@Type(() => Number)` ເພາະ `Number('')` = 0. */
const BlankIsAbsentNumber = () =>
  Transform(({ value }) =>
    value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
      ? undefined
      : Number(value),
  );

/**
 * The query contract every history endpoint accepts.
 *
 * `from_date` / `to_date` are snake_case because that is what the client
 * specification fixed; the rest of the API is camelCase, so the camelCase
 * spellings are accepted too rather than leaving a trap for whoever writes
 * the next caller.
 *
 * Both bounds are inclusive whole days in the SHOP's timezone — a range of
 * 2026-10-19 → 2026-10-19 returns that day's entries, not an empty set.
 * Omitting them means today, so a history screen never opens by dumping
 * every row the shop has ever recorded.
 */
export class HistoryRangeDto {
  @ApiPropertyOptional({ example: '2026-10-19', description: 'ຈາກວັນທີ (ຄ່າເລີ່ມຕົ້ນ = ມື້ນີ້)' })
  @IsOptional()
  @BlankIsAbsent()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from_date ຕ້ອງເປັນຮູບແບບ YYYY-MM-DD' })
  from_date?: string;

  @ApiPropertyOptional({ example: '2026-10-19', description: 'ຫາວັນທີ (ຄ່າເລີ່ມຕົ້ນ = ມື້ນີ້)' })
  @IsOptional()
  @BlankIsAbsent()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to_date ຕ້ອງເປັນຮູບແບບ YYYY-MM-DD' })
  to_date?: string;

  /** camelCase alias for from_date. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @BlankIsAbsent()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  /** camelCase alias for to_date. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @BlankIsAbsent()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @BlankIsAbsentNumber()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @BlankIsAbsentNumber()
  @IsInt()
  @Min(1)
  @Max(200)
  page_size?: number;

  /** camelCase alias for page_size. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @BlankIsAbsentNumber()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  /**
   * Return every row in the range instead of one page. For the few screens
   * that genuinely need the whole range at once — a CSV export, a chart —
   * and never the default, because a ledger grows without bound.
   */
  @ApiPropertyOptional({ description: 'ເອົາທຸກແຖວໃນຊ່ວງ (ສຳລັບ export)' })
  @IsOptional()
  all?: string;
}

/** What a paginated history endpoint returns. */
export interface PagedResult<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  /** Echoed back so the client can show the range it actually got. */
  fromDate: string;
  toDate: string;
}
