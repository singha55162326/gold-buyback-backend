import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { ApprovalStatus } from '@prisma/client';
import { ExchangeService } from './exchange.service';
import { CreateExchangeDto, PreviewExchangeDto, ReviewExchangeDto } from './dto/exchange.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresOpenShift } from '../../common/decorators/requires-shift.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('exchange')
@ApiBearerAuth('bearer')
@Controller('exchange')
export class ExchangeController {
  constructor(private readonly exchange: ExchangeService) {}

  @Get()
  list(@Query('status') status?: ApprovalStatus) {
    return this.exchange.list(status);
  }

  /**
   * Live totals plus the §5.2 balance check — the form calls this on every
   * change so the Save button reflects the same rule the API enforces.
   */
  @Roles('VALUER', 'ADMIN', 'MANAGER')
  @Post('preview')
  preview(@Body() dto: PreviewExchangeDto) {
    return this.exchange.preview(dto);
  }

  @Roles('VALUER', 'ADMIN', 'MANAGER')
  @RequiresOpenShift()
  @Post()
  create(@Body() dto: CreateExchangeDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    const shiftId = req.shift?.id as string | undefined;
    if (!shiftId) throw new BadRequestException('ຕ້ອງເປີດກະກ່ອນສ້າງລາຍການ');
    return this.exchange.create(dto, user, shiftId);
  }

  @Roles('PAYMENT', 'ADMIN', 'MANAGER')
  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewExchangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exchange.review(id, dto, user);
  }
}
