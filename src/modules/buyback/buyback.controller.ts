import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { ApprovalStatus } from '@prisma/client';
import { BuybackService } from './buyback.service';
import {
  CreateBuybackDto,
  ListBuybackDto,
  PreviewBuybackDto,
  ReviewBuybackDto,
} from './dto/buyback.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresOpenShift } from '../../common/decorators/requires-shift.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('buyback')
@ApiBearerAuth('bearer')
@Controller('buyback')
export class BuybackController {
  constructor(private readonly buyback: BuybackService) {}

  // The date range defaults to today and a Valuer cannot widen it —
  // HistoryRangeService enforces that, not the client.
  @Get()
  list(@Query() query: ListBuybackDto, @CurrentUser() user: AuthenticatedUser) {
    return this.buyback.list(query.status as ApprovalStatus | undefined, query, user);
  }

  /** Live §5.1 calculation for the Valuer's form. */
  @Roles('VALUER', 'ADMIN', 'MANAGER')
  @Post('preview')
  preview(@Body() dto: PreviewBuybackDto) {
    return this.buyback.preview(dto);
  }

  @Roles('VALUER', 'ADMIN', 'MANAGER')
  @RequiresOpenShift()
  @Post()
  create(@Body() dto: CreateBuybackDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    // ShiftGuard attaches the open shift; ADMIN/MANAGER are exempt from the
    // guard, so they must be acting on an explicit shift.
    const shiftId = req.shift?.id as string | undefined;
    if (!shiftId) throw new BadRequestException('ຕ້ອງເປີດກະກ່ອນສ້າງລາຍການ Buyback');
    return this.buyback.create(dto, user, shiftId);
  }

  /** payment ກົດ Approve / Reject (TOR §4.2). */
  @Roles('PAYMENT', 'ADMIN', 'MANAGER')
  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewBuybackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.buyback.review(id, dto, user);
  }

  /** ຜູ້ປະເມີນ ກົດຢືນຢັນອີກຄັ້ງ -> Completed. */
  @Roles('VALUER', 'ADMIN', 'MANAGER')
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.buyback.confirm(id, user);
  }
}
