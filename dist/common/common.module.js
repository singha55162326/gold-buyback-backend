"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonModule = void 0;
const common_1 = require("@nestjs/common");
const approval_service_1 = require("./services/approval.service");
const audit_service_1 = require("./services/audit.service");
const business_day_service_1 = require("./services/business-day.service");
const stock_ledger_service_1 = require("./services/stock-ledger.service");
const apar_posting_service_1 = require("./services/apar-posting.service");
const advance_service_1 = require("./services/advance.service");
let CommonModule = class CommonModule {
};
exports.CommonModule = CommonModule;
exports.CommonModule = CommonModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [approval_service_1.ApprovalService, audit_service_1.AuditService, business_day_service_1.BusinessDayService, stock_ledger_service_1.StockLedgerService, apar_posting_service_1.ApArPostingService, advance_service_1.AdvanceService],
        exports: [approval_service_1.ApprovalService, audit_service_1.AuditService, business_day_service_1.BusinessDayService, stock_ledger_service_1.StockLedgerService, apar_posting_service_1.ApArPostingService, advance_service_1.AdvanceService],
    })
], CommonModule);
//# sourceMappingURL=common.module.js.map