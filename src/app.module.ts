import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ShiftGuard } from './common/guards/shift.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DecimalSerializerInterceptor } from './common/interceptors/decimal-serializer.interceptor';

import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { RatesModule } from './modules/rates/rates.module';
import { FeesModule } from './modules/fees/fees.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { SkusModule } from './modules/skus/skus.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { BuybackModule } from './modules/buyback/buyback.module';
import { CashModule } from './modules/cash/cash.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { ExchangeModule } from './modules/exchange/exchange.module';
import { CreditModule } from './modules/credit/credit.module';
import { OrdersModule } from './modules/orders/orders.module';
import { StockModule } from './modules/stock/stock.module';
import { AdminModule } from './modules/admin/admin.module';
import { SystemModule } from './modules/system/system.module';
import { FinanceModule } from './modules/finance/finance.module';

@Module({
  imports: [
    // Root .env last so a local apps/api/.env can override app-specific
    // settings, while DATABASE_URL is defined only at the root.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    CommonModule,
    NotificationsModule,
    AuthModule,
    PricingModule,
    RatesModule,
    FeesModule,
    CatalogModule,
    SkusModule,
    ShiftsModule,
    BuybackModule,
    CashModule,
    LedgerModule,
    ExchangeModule,
    CreditModule,
    OrdersModule,
    StockModule,
    AdminModule,
    SystemModule,
    FinanceModule,
  ],
  providers: [
    // Order matters: authenticate, then check the role, then check the shift.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ShiftGuard },
    { provide: APP_INTERCEPTOR, useClass: DecimalSerializerInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
