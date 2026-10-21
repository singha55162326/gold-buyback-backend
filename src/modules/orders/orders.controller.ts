import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto, ReceiveOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HistoryRangeDto } from '../../common/dto/history-range.dto';

@ApiTags('orders')
@ApiBearerAuth('bearer')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // The date range defaults to today and a Valuer cannot widen it —
  // HistoryRangeService enforces that, not the client.
  @Get()
  list(
    @Query() query: HistoryRangeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: OrderStatus,
  ) {
    return this.orders.list(status, query, user);
  }

  @Roles('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER')
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.create(dto, user);
  }

  @Roles('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.updateStatus(id, dto, user);
  }

  /** ຊຳລະເພີ່ມ — auto-completes the order when the balance reaches zero. */
  @Roles('FINANCIAL_CONTROLLER', 'PAYMENT', 'ADMIN', 'MANAGER')
  @Post(':id/receipts')
  addReceipt(
    @Param('id') id: string,
    @Body() dto: ReceiveOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.addReceipt(id, dto, user);
  }
}
