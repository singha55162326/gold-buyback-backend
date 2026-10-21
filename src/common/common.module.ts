import { Global, Module } from '@nestjs/common';
import { ApprovalService } from './services/approval.service';
import { AuditService } from './services/audit.service';
import { BusinessDayService } from './services/business-day.service';
import { StockLedgerService } from './services/stock-ledger.service';
import { ApArPostingService } from './services/apar-posting.service';
import { AdvanceService } from './services/advance.service';
import { HistoryRangeService } from './services/history-range.service';
import { CodeGeneratorService } from './services/code-generator.service';

@Global()
@Module({
  providers: [
    ApprovalService,
    AuditService,
    BusinessDayService,
    StockLedgerService,
    ApArPostingService,
    AdvanceService,
    HistoryRangeService,
    CodeGeneratorService,
  ],
  exports: [
    ApprovalService,
    AuditService,
    BusinessDayService,
    StockLedgerService,
    ApArPostingService,
    AdvanceService,
    HistoryRangeService,
    CodeGeneratorService,
  ],
})
export class CommonModule {}
