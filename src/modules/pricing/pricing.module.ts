import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { PricingContextService } from './pricing-context.service';

@Module({
  controllers: [PricingController],
  providers: [PricingService, PricingContextService],
  exports: [PricingService, PricingContextService],
})
export class PricingModule {}
