import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto, OrderReceiptDto, UpdateOrderStatusDto } from './dto/order.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('orders')
@ApiBearerAuth('bearer')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query('status') status?: OrderStatus) {
    return this.orders.list(status);
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
    @Body() dto: OrderReceiptDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.addReceipt(id, dto, user);
  }
}
