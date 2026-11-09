import { Module } from '@nestjs/common';
import { BuybackController } from './buyback.controller';
import { BuybackService } from './buyback.service';
import { PricingModule } from '../pricing/pricing.module';
import { CashModule } from '../cash/cash.module';

@Module({
  imports: [PricingModule, CashModule],
  controllers: [BuybackController],
  providers: [BuybackService],
  exports: [BuybackService],
})
export class BuybackModule {}
