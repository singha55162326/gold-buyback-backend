import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { CashService } from './cash.service';
import {
  BankHistoryDto,
  CreateBankTransactionDto,
  CreateCashRequestDto,
  CreateCashTransactionDto,
  ReviewCashRequestDto,
  SetBankNetBalanceDto,
} from './dto/cash.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresOpenShift } from '../../common/decorators/requires-shift.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HistoryRangeDto } from '../../common/dto/history-range.dto';

/**
 * ທີ່ມາຂອງເງິນສຳລັບໜ້າ Bank (To Day).
 *
 * ລູກຄ້າກຳນົດວ່າ ໜ້ານີ້ນັບສະເພາະເງິນທີ່ເຂົ້າ-ອອກຜ່ານໜ້າຮ້ານ (Buyback,
 * ປ່ຽນເປັນເງິນ, ສິນເຊື່ອ) ບໍ່ລວມການຝາກ/ຖອນຂອງການເງິນ. ບໍ່ສົ່ງ sources
 * ມາ = ນັບທັງໝົດຄືເກົ່າ.
 */
const COUNTER_SOURCES: Record<string, string[] | undefined> = {
  counter: ['Buyback', 'GoldExchange', 'GoldCredit'],
};

@ApiTags('cash')
@ApiBearerAuth('bearer')
@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  /* ---- §4.1 / §6 ເບີກ / ມອບເງິນ ---- */

  @Get('requests')
  listRequests(@Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED') {
    return this.cash.listRequests(status);
  }

  @Roles('PAYMENT', 'ADMIN', 'MANAGER')
  @RequiresOpenShift()
  @Post('requests')
  createRequest(
    @Body() dto: CreateCashRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    const shiftId = req.shift?.id as string | undefined;
    if (!shiftId) throw new BadRequestException('ຕ້ອງເປີດກະກ່ອນເບີກ ຫຼື ມອບເງິນ');
    return this.cash.createRequest(dto, user, shiftId);
  }

  @Roles('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER')
  @Post('requests/:id/review')
  reviewRequest(
    @Param('id') id: string,
    @Body() dto: ReviewCashRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cash.reviewRequest(id, dto, user);
  }

  /** payment confirms receipt — the point at which cash actually moves. */
  @Roles('PAYMENT', 'ADMIN', 'MANAGER')
  @Post('requests/:id/complete')
  completeRequest(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cash.completeRequest(id, user);
  }

  /* ---- §3.7 Module Cash ---- */

  @Get('balances')
  cashBalances() {
    return this.cash.cashBalances();
  }

  /** ຍອດໃນກະເປົ໋າເງິນສົດຂອງຜູ້ໃຊ້ທີ່ກຳລັງເປີດກະຢູ່. */
  @Get('wallet')
  wallet(@CurrentUser() user: AuthenticatedUser) {
    return this.cash.walletBalance(user.id);
  }

  @Get('history')
  cashHistory(@Query() query: HistoryRangeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cash.cashHistory(query, user);
  }

  @Roles('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER')
  @Post('transactions')
  createCashTransaction(
    @Body() dto: CreateCashTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cash.createCashTransaction(dto, user);
  }

  /* ---- §3.7 Module Bank ---- */

  @Get('bank/balances')
  bankBalances(@Query('sources') sources?: string) {
    return this.cash.bankBalances(undefined, COUNTER_SOURCES[sources ?? ''] );
  }

  @Get('bank/history')
  bankHistory(@Query() query: BankHistoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cash.bankHistory(query, user, COUNTER_SOURCES[query.sources ?? '']);
  }

  @Roles('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER')
  @Post('bank/transactions')
  createBankTransaction(
    @Body() dto: CreateBankTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cash.createBankTransaction(dto, user);
  }

  /** ເງິນ Bank ສຸດທິ — Admin & Manager only (TOR §3.7). */
  @Roles('ADMIN', 'MANAGER')
  @Post('bank/net-balance')
  setBankNetBalance(@Body() dto: SetBankNetBalanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cash.setBankNetBalance(dto, user);
  }
}
