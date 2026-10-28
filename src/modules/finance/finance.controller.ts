import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
  UpdateApArCashCategoryDto,
  UpdateBankAccountDto,
  UpdateIncomeExpenseCategoryDto,
} from './dto/finance.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HistoryRangeDto } from '../../common/dto/history-range.dto';

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

  @Roles('ADMIN', 'MANAGER')
  @Patch('banks/:id')
  updateBankAccount(
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.updateBankAccount(id, dto, user);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete('banks/:id')
  deleteBankAccount(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.deleteBankAccount(id, user);
  }

  /* ---- §3.7 ລາຍຮັບ / ລາຍຈ່າຍ ---- */

  @Get('income-expense/categories')
  categories(@Query('kind') kind?: IncomeExpenseKind, @Query('withActor') withActor?: string) {
    return this.finance.listIncomeExpenseCategories(kind, withActor === 'true');
  }

  @Roles('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER')
  @Post('income-expense/categories')
  createCategory(
    @Body() dto: CreateIncomeExpenseCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.createIncomeExpenseCategory(dto, user);
  }

  @Roles('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER')
  @Patch('income-expense/categories/:id')
  updateIncomeExpenseCategory(
    @Param('id') id: string,
    @Body() dto: UpdateIncomeExpenseCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.updateIncomeExpenseCategory(id, dto, user);
  }

  @Roles('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER')
  @Delete('income-expense/categories/:id')
  deleteIncomeExpenseCategory(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.deleteIncomeExpenseCategory(id, user);
  }

  @Get('income-expense')
  incomeExpenseHistory(
    @Query() query: HistoryRangeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('kind') kind?: IncomeExpenseKind,
  ) {
    return this.finance.incomeExpenseHistory(kind, query, user);
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
  consignments(
    @Query() query: HistoryRangeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: 'HELD' | 'RETURNED',
  ) {
    return this.finance.consignments(status, query, user);
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
  advanceHistory(@Query() query: HistoryRangeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.advance.history(query, user);
  }

  /* ---- §9.1 ລາຍການ AP-AR (Cash) ---- */

  @Get('ap-ar/categories')
  apArCategories(@Query('side') side?: ApArSide, @Query('withActor') withActor?: string) {
    return this.finance.listApArCategories(side, withActor === 'true');
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('ap-ar/categories')
  createApArCategory(
    @Body() dto: CreateApArCashCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.createApArCategory(dto, user);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch('ap-ar/categories/:id')
  updateApArCategory(
    @Param('id') id: string,
    @Body() dto: UpdateApArCashCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.updateApArCategory(id, dto, user);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete('ap-ar/categories/:id')
  deleteApArCategory(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.deleteApArCategory(id, user);
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
  history(
    @Param('side') side: ApArSide,
    @Query() query: HistoryRangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.apArHistory(side, query, user);
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
