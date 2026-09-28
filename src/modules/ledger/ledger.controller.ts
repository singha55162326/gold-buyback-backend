import { Controller, Get } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

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
  @Get('coh')
  coh() {
    return this.ledger.coh();
  }

  @Roles('ADMIN', 'MANAGER')
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
  cashApArHistory() {
    return this.ledger.cashApArHistory();
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
  goldApArHistory() {
    return this.ledger.goldApArHistory();
  }
}
