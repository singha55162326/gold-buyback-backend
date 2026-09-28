import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { ApprovalStatus } from '@prisma/client';
import { CreditService } from './credit.service';
import { CreateCreditDto, CreditReceiptDto, ReviewCreditDto } from './dto/credit.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresOpenShift } from '../../common/decorators/requires-shift.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('credit')
@ApiBearerAuth('bearer')
@Controller('credit')
export class CreditController {
  constructor(private readonly credit: CreditService) {}

  @Get()
  list(@Query('status') status?: ApprovalStatus) {
    return this.credit.list(status);
  }

  @Roles('VALUER', 'ADMIN', 'MANAGER')
  @RequiresOpenShift()
  @Post()
  create(@Body() dto: CreateCreditDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    const shiftId = req.shift?.id as string | undefined;
    if (!shiftId) throw new BadRequestException('ຕ້ອງເປີດກະກ່ອນສ້າງລາຍການສິນເຊື່ອ');
    return this.credit.create(dto, user, shiftId);
  }

  @Roles('PAYMENT', 'ADMIN', 'MANAGER')
  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewCreditDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.credit.review(id, dto, user);
  }

  /** ຮັບຄ່າງວດ — draws down the outstanding AR (Cash). */
  @Roles('PAYMENT', 'ADMIN', 'MANAGER')
  @Post(':id/receipts')
  addReceipt(
    @Param('id') id: string,
    @Body() dto: CreditReceiptDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.credit.addReceipt(id, dto, user);
  }
}
