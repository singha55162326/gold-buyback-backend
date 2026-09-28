import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { CashModule } from '../cash/cash.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [CashModule, PricingModule],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
