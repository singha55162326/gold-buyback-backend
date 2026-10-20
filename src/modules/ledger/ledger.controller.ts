import { Controller, Get, Query } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HistoryRangeDto } from '../../common/dto/history-range.dto';

/**
 * Read-only accounting views (TOR §3.7, §8, §9). Every figure is derived from
 * the ledgers on request, so these endpoints have no write path at all.
 */
@ApiTags('ledger')
@ApiBearerAuth('bearer')
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Roles('ADMIN', 'MANAGER', 'WAREHOUSE', 'FINANCIAL_CONTROLLER')
  @Get('wac')
  wac() {
    return this.ledger.wac();
  }

  @Roles('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER')
  // COH ເປັນຍອດຢູ່ເວລາໜຶ່ງ: filter ເປັນວັນທີດຽວ (as_of) ບໍ່ແມ່ນຊ່ວງວັນທີ.
  @Get('coh')
  coh(@Query('as_of') asOf?: string) {
    return this.ledger.coh(asOf);
  }

  @Roles('ADMIN', 'MANAGER')
  /** 30 ມື້ລ່າສຸດ — ຕາຕະລາງຫຼັກຂອງໜ້າ Wealth. */
  @Get('wealth/history')
  wealthHistory() {
    return this.ledger.wealthHistory();
  }

  @Get('wealth')
  wealth() {
    return this.ledger.wealth();
  }

  @Roles('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER')
  @Get('ap-ar/cash')
  cashApAr() {
    return this.ledger.cashApAr();
  }

  @Roles('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER')
  @Get('ap-ar/cash/history')
  cashApArHistory(@Query() query: HistoryRangeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ledger.cashApArHistory(query, user);
  }

  @Roles('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER', 'WAREHOUSE')
  @Get('ap-ar/gold')
  goldApAr() {
    return this.ledger.goldApArSummary();
  }

  @Roles('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER', 'WAREHOUSE')
  @Get('ap-ar/gold/partners')
  goldApArByPartner() {
    return this.ledger.goldApArByPartner();
  }

  @Roles('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER', 'WAREHOUSE')
  @Get('ap-ar/gold/history')
  goldApArHistory(@Query() query: HistoryRangeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ledger.goldApArHistory(query, user);
  }
}
