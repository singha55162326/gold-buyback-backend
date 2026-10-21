import { Module } from '@nestjs/common';
import { FeesController } from './fees.controller';
import { FeesService } from './fees.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  // Editing a deduction re-prices the board, so the pricing service
  // comes along.
  imports: [PricingModule],
  controllers: [FeesController],
  providers: [FeesService],
  exports: [FeesService],
})
export class FeesModule {}
