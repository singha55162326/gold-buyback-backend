import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { CloseShiftDto, ReviewShiftDto } from './dto/shift.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('shifts')
@ApiBearerAuth('bearer')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  /** The caller's shift for today — drives the open/close banner in the UI. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.shifts.currentFor(user.id);
  }

  @Roles('PAYMENT', 'VALUER')
  @Post('open')
  open(@CurrentUser() user: AuthenticatedUser) {
    return this.shifts.open(user);
  }

  @Roles('PAYMENT', 'VALUER')
  @Post('close')
  close(@CurrentUser() user: AuthenticatedUser, @Body() dto: CloseShiftDto) {
    return this.shifts.close(user, dto);
  }

  @Roles('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER')
  @Get('pending')
  pending() {
    return this.shifts.pending();
  }

  @Roles('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER')
  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewShiftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shifts.review(id, dto, user);
  }
}
