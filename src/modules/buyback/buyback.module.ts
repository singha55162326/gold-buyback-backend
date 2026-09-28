import { Module } from '@nestjs/common';
import { BuybackController } from './buyback.controller';
import { BuybackService } from './buyback.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [BuybackController],
  providers: [BuybackService],
  exports: [BuybackService],
})
export class BuybackModule {}
