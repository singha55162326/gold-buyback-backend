import { Global, Module } from '@nestjs/common';
import { ApprovalService } from './services/approval.service';
import { AuditService } from './services/audit.service';
import { BusinessDayService } from './services/business-day.service';
import { StockLedgerService } from './services/stock-ledger.service';
import { ApArPostingService } from './services/apar-posting.service';
import { AdvanceService } from './services/advance.service';

@Global()
@Module({
  providers: [ApprovalService, AuditService, BusinessDayService, StockLedgerService, ApArPostingService, AdvanceService],
  exports: [ApprovalService, AuditService, BusinessDayService, StockLedgerService, ApArPostingService, AdvanceService],
})
export class CommonModule {}
