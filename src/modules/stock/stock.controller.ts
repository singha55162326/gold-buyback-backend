import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { ApprovalStatus, StockScope } from '@prisma/client';
import { StockService } from './stock.service';
import {
  CreateHandoverDto,
  CreateStockInDto,
  CreateStockOutDto,
  CreateTransferDto,
  FactoryAssessmentDto,
  ReviewStockDto,
} from './dto/stock.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresOpenShift } from '../../common/decorators/requires-shift.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('stock')
@ApiBearerAuth('bearer')
@Controller('stock')
export class StockController {
  constructor(
    private readonly stock: StockService,
    private readonly prisma: PrismaService,
  ) {}

  /* ---- Reads ---- */

  @Get('movements')
  listMovements(@Query('scope') scope?: StockScope, @Query('status') status?: ApprovalStatus) {
    return this.stock.listMovements(scope, status);
  }

  @Get('new/history')
  newHistory() {
    return this.stock.newHistory();
  }

  @Get('new/balances')
  newBalances() {
    return this.stock.newBalances();
  }

  @Get('old/history')
  oldHistory() {
    return this.stock.oldHistory();
  }

  @Get('old/balances')
  oldBalances() {
    return this.stock.oldBalances();
  }

  /* ---- Movements ---- */

  @Roles('WAREHOUSE', 'ADMIN', 'MANAGER')
  @Post('in')
  stockIn(@Body() dto: CreateStockInDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stock.stockIn(dto, user);
  }

  @Roles('WAREHOUSE', 'ADMIN', 'MANAGER')
  @Post('out')
  stockOut(@Body() dto: CreateStockOutDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stock.stockOut(dto, user);
  }

  /** Stock OUT approval is Admin/Manager only (TOR §2, §7.1). */
  @Roles('ADMIN', 'MANAGER')
  @Post('out/:id/review')
  reviewOut(
    @Param('id') id: string,
    @Body() dto: ReviewStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stock.reviewOut(id, dto, user);
  }

  @Roles('WAREHOUSE', 'ADMIN', 'MANAGER')
  @Post('transfer')
  transfer(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stock.transfer(dto, user);
  }

  /* ---- §7.3 FACTORY tracking ---- */

  @Get('factory')
  listFactoryTracking() {
    return this.stock.listFactoryTracking();
  }

  /**
   * ອັບເດດ ນໍ້າໜັກg FACTORY ປະເມີນ.
   *
   * §7.3: ເມື່ອ Completed ແລ້ວ ຜູ້ໃຊ້ທົ່ວໄປບໍ່ສາມາດແກ້ໄຂໄດ້ — ສິດແກ້ໄຂຫຼັງ
   * Completed ມີສະເພາະ ROLE Admin & Manager ເທົ່ານັ້ນ.
   */
  @Roles('WAREHOUSE', 'ADMIN', 'MANAGER')
  @Post('factory/:id/assessment')
  async recordFactoryAssessment(
    @Param('id') id: string,
    @Body() dto: FactoryAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tracking = await this.prisma.factoryOutTracking.findUnique({ where: { id } });
    if (!tracking) throw new BadRequestException('ບໍ່ພົບລາຍການຕິດຕາມ');

    if (tracking.status === 'COMPLETED' && !['ADMIN', 'MANAGER'].includes(user.role)) {
      throw new ForbiddenException(
        'ລາຍການນີ້ Completed ແລ້ວ — ມີພຽງ Admin ຫຼື Manager ເທົ່ານັ້ນທີ່ແກ້ໄຂໄດ້',
      );
    }

    return this.stock.recordFactoryAssessment(id, dto, user);
  }

  /* ---- §4.2 ສະຫຼຸບປະເພດຄຳ ---- */

  @Get('old-gold-summary')
  oldGoldSummary() {
    return this.stock.oldGoldSummary();
  }

  /* ---- §4.2 ມອບຄຳລະຫວ່າງມື້ ---- */

  @Get('handovers')
  listHandovers(@Query('status') status?: ApprovalStatus) {
    return this.stock.listHandovers(status);
  }

  @Roles('PAYMENT', 'ADMIN', 'MANAGER')
  @RequiresOpenShift()
  @Post('handovers')
  createHandover(
    @Body() dto: CreateHandoverDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    const shiftId = req.shift?.id as string | undefined;
    if (!shiftId) throw new BadRequestException('ຕ້ອງເປີດກະກ່ອນມອບຄຳ');
    return this.stock.createHandover(dto, user, shiftId);
  }

  @Roles('WAREHOUSE', 'ADMIN', 'MANAGER')
  @Post('handovers/:id/review')
  reviewHandover(
    @Param('id') id: string,
    @Body() dto: ReviewStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stock.reviewHandover(id, dto, user);
  }
}
