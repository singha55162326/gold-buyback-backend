import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PreviewPricingDto, SetPricingDto } from './dto/set-pricing.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('pricing')
@ApiBearerAuth('bearer')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /** The current price board — every role needs to read it. */
  @Get('current')
  current() {
    return this.pricing.current();
  }

  /** History Products — 30 rows by default (TOR §3.1). */
  @Get('history')
  history(@Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number) {
    return this.pricing.history(limit);
  }

  /** Live preview of the board before saving. */
  @Roles('ADMIN', 'MANAGER')
  @Post('preview')
  preview(@Body() dto: PreviewPricingDto) {
    return this.pricing.preview(dto.price1Baht);
  }

  /** Set Pricing (TOR §3.1) — ADMIN/MANAGER only. */
  @Roles('ADMIN', 'MANAGER')
  @Post('set')
  set(@Body() dto: SetPricingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pricing.setPricing(dto, user.id);
  }
}
