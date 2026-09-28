import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query } from '@nestjs/common';
import { RatesService } from './rates.service';
import { UpdateRatesDto } from './dto/rate.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('rates')
@ApiBearerAuth('bearer')
@Controller('rates')
export class RatesController {
  constructor(private readonly rates: RatesService) {}

  @Get('current')
  current() {
    return this.rates.current();
  }

  @Get('history')
  history(@Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number) {
    return this.rates.history(limit);
  }

  /** Data for the THB/LAK and USD/LAK history charts (TOR §3.3). */
  @Get('series')
  series(@Query('months', new DefaultValuePipe(12), ParseIntPipe) months: number) {
    return this.rates.monthlySeries(months);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('update')
  update(@Body() dto: UpdateRatesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rates.update(dto, user.id);
  }
}
