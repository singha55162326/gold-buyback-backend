"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const finance_service_1 = require("./finance.service");
const advance_service_1 = require("../../common/services/advance.service");
const finance_dto_1 = require("./dto/finance.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
/** The §3.7 and §9 modules added by the updated TOR, plus Module Advace (§7). */
let FinanceController = class FinanceController {
    finance;
    advance;
    constructor(finance, advance) {
        this.finance = finance;
        this.advance = advance;
    }
    /* ---- §3.7 ລາຍການ Bank ---- */
    createBank(dto, user) {
        return this.finance.createBankAccount(dto, user);
    }
    /* ---- §3.7 ລາຍຮັບ / ລາຍຈ່າຍ ---- */
    categories(kind) {
        return this.finance.listIncomeExpenseCategories(kind);
    }
    createCategory(dto, user) {
        return this.finance.createIncomeExpenseCategory(dto, user);
    }
    incomeExpenseHistory(kind) {
        return this.finance.incomeExpenseHistory(kind);
    }
    createIncomeExpense(dto, user) {
        return this.finance.createIncomeExpense(dto, user);
    }
    /* ---- §3.7 ຝາກສິນຄ້າ ---- */
    consignments(status) {
        return this.finance.consignments(status);
    }
    createConsignment(dto, user) {
        return this.finance.createConsignment(dto, user);
    }
    /** ຢືນຢັນການສົ່ງມອບຄືນ. */
    returnConsignment(id, user) {
        return this.finance.returnConsignment(id, user);
    }
    /* ---- §7 Module Advace ---- */
    advanceSummary() {
        return this.advance.summary();
    }
    advanceHistory() {
        return this.advance.history();
    }
    /* ---- §9.1 ລາຍການ AP-AR (Cash) ---- */
    apArCategories(side) {
        return this.finance.listApArCategories(side);
    }
    createApArCategory(dto, user) {
        return this.finance.createApArCategory(dto, user);
    }
    /* ---- §9.3 / §9.4 AP (Cash) ແລະ AR (Cash) ---- */
    totals(side) {
        return this.finance.apArTotals(side);
    }
    byPartner(side) {
        return this.finance.apArByPartner(side);
    }
    history(side) {
        return this.finance.apArHistory(side);
    }
    addEntry(side, dto, user) {
        return this.finance.addApArEntry(side, dto, user);
    }
    /** ປຸ່ມ Payment — settles the Supplier's balance and moves the money. */
    settle(side, dto, user) {
        return this.finance.settleApAr(side, dto, user);
    }
};
exports.FinanceController = FinanceController;
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('banks'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [finance_dto_1.CreateBankAccountDto, Object]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "createBank", null);
__decorate([
    openapi.ApiQuery({ name: "kind", required: false }),
    (0, common_1.Get)('income-expense/categories'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('kind')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "categories", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('income-expense/categories'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [finance_dto_1.CreateIncomeExpenseCategoryDto, Object]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "createCategory", null);
__decorate([
    openapi.ApiQuery({ name: "kind", required: false }),
    (0, common_1.Get)('income-expense'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('kind')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "incomeExpenseHistory", null);
__decorate([
    (0, roles_decorator_1.Roles)('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('income-expense'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [finance_dto_1.CreateIncomeExpenseDto, Object]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "createIncomeExpense", null);
__decorate([
    openapi.ApiQuery({ name: "status", required: false }),
    (0, common_1.Get)('consignments'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "consignments", null);
__decorate([
    (0, roles_decorator_1.Roles)('PAYMENT', 'FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('consignments'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [finance_dto_1.CreateConsignmentDto, Object]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "createConsignment", null);
__decorate([
    openapi.ApiOperation({ summary: "\u0EA2\u0EB7\u0E99\u0EA2\u0EB1\u0E99\u0E81\u0EB2\u0E99\u0EAA\u0EBB\u0EC8\u0E87\u0EA1\u0EAD\u0E9A\u0E84\u0EB7\u0E99." }),
    (0, roles_decorator_1.Roles)('PAYMENT', 'FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('consignments/:id/return'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "returnConsignment", null);
__decorate([
    (0, common_1.Get)('advance'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "advanceSummary", null);
__decorate([
    (0, common_1.Get)('advance/history'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "advanceHistory", null);
__decorate([
    openapi.ApiQuery({ name: "side", required: false }),
    (0, common_1.Get)('ap-ar/categories'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('side')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "apArCategories", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('ap-ar/categories'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [finance_dto_1.CreateApArCashCategoryDto, Object]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "createApArCategory", null);
__decorate([
    openapi.ApiParam({ name: "side", enum: ["AP", "AR"] }),
    (0, common_1.Get)('ap-ar/:side/totals'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('side')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "totals", null);
__decorate([
    openapi.ApiParam({ name: "side", enum: ["AP", "AR"] }),
    (0, common_1.Get)('ap-ar/:side/partners'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('side')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "byPartner", null);
__decorate([
    openapi.ApiParam({ name: "side", enum: ["AP", "AR"] }),
    (0, common_1.Get)('ap-ar/:side/history'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('side')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "history", null);
__decorate([
    openapi.ApiParam({ name: "side", enum: ["AP", "AR"] }),
    (0, roles_decorator_1.Roles)('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('ap-ar/:side/entries'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Param)('side')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, finance_dto_1.CreateApArCashEntryDto, Object]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "addEntry", null);
__decorate([
    openapi.ApiOperation({ summary: "\u0E9B\u0EB8\u0EC8\u0EA1 Payment \u2014 settles the Supplier's balance and moves the money." }),
    openapi.ApiParam({ name: "side", enum: ["AP", "AR"] }),
    (0, roles_decorator_1.Roles)('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('ap-ar/:side/settle'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Param)('side')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, finance_dto_1.SettleApArCashDto, Object]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "settle", null);
exports.FinanceController = FinanceController = __decorate([
    (0, swagger_1.ApiTags)('finance'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('finance'),
    __metadata("design:paramtypes", [finance_service_1.FinanceService,
        advance_service_1.AdvanceService])
], FinanceController);
//# sourceMappingURL=finance.controller.js.map