"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const prisma_module_1 = require("./prisma/prisma.module");
const common_module_1 = require("./common/common.module");
const jwt_auth_guard_1 = require("./common/guards/jwt-auth.guard");
const roles_guard_1 = require("./common/guards/roles.guard");
const shift_guard_1 = require("./common/guards/shift.guard");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const decimal_serializer_interceptor_1 = require("./common/interceptors/decimal-serializer.interceptor");
const auth_module_1 = require("./modules/auth/auth.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const pricing_module_1 = require("./modules/pricing/pricing.module");
const rates_module_1 = require("./modules/rates/rates.module");
const fees_module_1 = require("./modules/fees/fees.module");
const catalog_module_1 = require("./modules/catalog/catalog.module");
const skus_module_1 = require("./modules/skus/skus.module");
const shifts_module_1 = require("./modules/shifts/shifts.module");
const buyback_module_1 = require("./modules/buyback/buyback.module");
const cash_module_1 = require("./modules/cash/cash.module");
const ledger_module_1 = require("./modules/ledger/ledger.module");
const exchange_module_1 = require("./modules/exchange/exchange.module");
const credit_module_1 = require("./modules/credit/credit.module");
const orders_module_1 = require("./modules/orders/orders.module");
const stock_module_1 = require("./modules/stock/stock.module");
const admin_module_1 = require("./modules/admin/admin.module");
const system_module_1 = require("./modules/system/system.module");
const finance_module_1 = require("./modules/finance/finance.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // Root .env last so a local backend/.env can override app-specific
            // settings, while DATABASE_URL is defined only at the root.
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
            prisma_module_1.PrismaModule,
            common_module_1.CommonModule,
            notifications_module_1.NotificationsModule,
            auth_module_1.AuthModule,
            pricing_module_1.PricingModule,
            rates_module_1.RatesModule,
            fees_module_1.FeesModule,
            catalog_module_1.CatalogModule,
            skus_module_1.SkusModule,
            shifts_module_1.ShiftsModule,
            buyback_module_1.BuybackModule,
            cash_module_1.CashModule,
            ledger_module_1.LedgerModule,
            exchange_module_1.ExchangeModule,
            credit_module_1.CreditModule,
            orders_module_1.OrdersModule,
            stock_module_1.StockModule,
            admin_module_1.AdminModule,
            system_module_1.SystemModule,
            finance_module_1.FinanceModule,
        ],
        providers: [
            // Order matters: authenticate, then check the role, then check the shift.
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: roles_guard_1.RolesGuard },
            { provide: core_1.APP_GUARD, useClass: shift_guard_1.ShiftGuard },
            { provide: core_1.APP_INTERCEPTOR, useClass: decimal_serializer_interceptor_1.DecimalSerializerInterceptor },
            { provide: core_1.APP_FILTER, useClass: all_exceptions_filter_1.AllExceptionsFilter },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map