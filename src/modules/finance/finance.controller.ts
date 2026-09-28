import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { ApArSide, IncomeExpenseKind } from '@prisma/client';
import { FinanceService } from './finance.service';
import { AdvanceService } from '../../common/services/advance.service';
import {
  CreateApArCashCategoryDto,
  CreateApArCashEntryDto,
  CreateBankAccountDto,
  CreateConsignmentDto,
  CreateIncomeExpenseCategoryDto,
  CreateIncomeExpenseDto,
  SettleApArCashDto,
} from './dto/finance.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** The §3.7 and §9 modules added by the updated TOR, plus Module Advace (§7). */
@ApiTags('finance')
@ApiBearerAuth('bearer')
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly advance: AdvanceService,
  ) {}

  /* ---- §3.7 ລາຍການ Bank ---- */

  @Roles('ADMIN', 'MANAGER')
  @Post('banks')
  createBank(@Body() dto: CreateBankAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.createBankAccount(dto, user);
  }

  /* ---- §3.7 ລາຍຮັບ / ລາຍຈ່າຍ ---- */

  @Get('income-expense/categories')
  categories(@Query('kind') kind?: IncomeExpenseKind) {
    return this.finance.listIncomeExpenseCategories(kind);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('income-expense/categories')
  createCategory(
    @Body() dto: CreateIncomeExpenseCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.createIncomeExpenseCategory(dto, user);
  }

  @Get('income-expense')
  incomeExpenseHistory(@Query('kind') kind?: IncomeExpenseKind) {
    return this.finance.incomeExpenseHistory(kind);
  }

  @Roles('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER')
  @Post('income-expense')
  createIncomeExpense(
    @Body() dto: CreateIncomeExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.createIncomeExpense(dto, user);
  }

  /* ---- §3.7 ຝາກສິນຄ້າ ---- */

  @Get('consignments')
  consignments(@Query('status') status?: 'HELD' | 'RETURNED') {
    return this.finance.consignments(status);
  }

  @Roles('PAYMENT', 'FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER')
  @Post('consignments')
  createConsignment(@Body() dto: CreateConsignmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.createConsignment(dto, user);
  }

  /** ຢືນຢັນການສົ່ງມອບຄືນ. */
  @Roles('PAYMENT', 'FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER')
  @Post('consignments/:id/return')
  returnConsignment(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.returnConsignment(id, user);
  }

  /* ---- §7 Module Advace ---- */

  @Get('advance')
  advanceSummary() {
    return this.advance.summary();
  }

  @Get('advance/history')
  advanceHistory() {
    return this.advance.history();
  }

  /* ---- §9.1 ລາຍການ AP-AR (Cash) ---- */

  @Get('ap-ar/categories')
  apArCategories(@Query('side') side?: ApArSide) {
    return this.finance.listApArCategories(side);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('ap-ar/categories')
  createApArCategory(
    @Body() dto: CreateApArCashCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.createApArCategory(dto, user);
  }

  /* ---- §9.3 / §9.4 AP (Cash) ແລະ AR (Cash) ---- */

  @Get('ap-ar/:side/totals')
  totals(@Param('side') side: ApArSide) {
    return this.finance.apArTotals(side);
  }

  @Get('ap-ar/:side/partners')
  byPartner(@Param('side') side: ApArSide) {
    return this.finance.apArByPartner(side);
  }

  @Get('ap-ar/:side/history')
  history(@Param('side') side: ApArSide) {
    return this.finance.apArHistory(side);
  }

  @Roles('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER')
  @Post('ap-ar/:side/entries')
  addEntry(
    @Param('side') side: ApArSide,
    @Body() dto: CreateApArCashEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.addApArEntry(side, dto, user);
  }

  /** ປຸ່ມ Payment — settles the Supplier's balance and moves the money. */
  @Roles('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER')
  @Post('ap-ar/:side/settle')
  settle(
    @Param('side') side: ApArSide,
    @Body() dto: SettleApArCashDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.settleApAr(side, dto, user);
  }
}
