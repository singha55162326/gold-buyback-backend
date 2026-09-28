import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query } from '@nestjs/common';
import { FeesService } from './fees.service';
import {
  UpdateDeductionDto,
  UpdateSoftGoldFeeDto,
  UpsertBarFeeDto,
  UpsertJewelryFeeDto,
} from './dto/fee.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('fees')
@ApiBearerAuth('bearer')
@Controller('fees')
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  // ຄ່າປ່ຽນ (§3.4)
  @Get('conversion/jewelry')
  jewelryFees() {
    return this.fees.currentJewelryFees();
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('conversion/jewelry')
  upsertJewelryFee(@Body() dto: UpsertJewelryFeeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.fees.upsertJewelryFee(dto, user.id);
  }

  @Get('conversion/bar')
  barFees() {
    return this.fees.currentBarFees();
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('conversion/bar')
  upsertBarFee(@Body() dto: UpsertBarFeeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.fees.upsertBarFee(dto, user.id);
  }

  // ຄ່າອ່ອນ (§3.4)
  @Get('soft-gold')
  softGoldFee() {
    return this.fees.currentSoftGoldFee();
  }

  @Get('soft-gold/history')
  softGoldFeeHistory(@Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number) {
    return this.fees.softGoldFeeHistory(limit);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('soft-gold')
  updateSoftGoldFee(@Body() dto: UpdateSoftGoldFeeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.fees.updateSoftGoldFee(dto, user.id);
  }

  // ຫັກອອກ (%) / ລາຄາລົບອອກ (§3.2)
  @Get('buyback-deductions')
  deductions() {
    return this.fees.currentDeductions();
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('buyback-deductions')
  updateDeduction(@Body() dto: UpdateDeductionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.fees.updateDeduction(dto, user.id);
  }
}
