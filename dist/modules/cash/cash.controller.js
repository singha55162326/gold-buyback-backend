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
exports.CashController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const cash_service_1 = require("./cash.service");
const cash_dto_1 = require("./dto/cash.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const requires_shift_decorator_1 = require("../../common/decorators/requires-shift.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
let CashController = class CashController {
    cash;
    constructor(cash) {
        this.cash = cash;
    }
    /* ---- §4.1 / §6 ເບີກ / ມອບເງິນ ---- */
    listRequests(status) {
        return this.cash.listRequests(status);
    }
    createRequest(dto, user, req) {
        const shiftId = req.shift?.id;
        if (!shiftId)
            throw new common_1.BadRequestException('ຕ້ອງເປີດກະກ່ອນເບີກ ຫຼື ມອບເງິນ');
        return this.cash.createRequest(dto, user, shiftId);
    }
    reviewRequest(id, dto, user) {
        return this.cash.reviewRequest(id, dto, user);
    }
    /** payment confirms receipt — the point at which cash actually moves. */
    completeRequest(id, user) {
        return this.cash.completeRequest(id, user);
    }
    /* ---- §3.7 Module Cash ---- */
    cashBalances() {
        return this.cash.cashBalances();
    }
    cashHistory() {
        return this.cash.cashHistory();
    }
    createCashTransaction(dto, user) {
        return this.cash.createCashTransaction(dto, user);
    }
    /* ---- §3.7 Module Bank ---- */
    bankBalances() {
        return this.cash.bankBalances();
    }
    bankHistory() {
        return this.cash.bankHistory();
    }
    createBankTransaction(dto, user) {
        return this.cash.createBankTransaction(dto, user);
    }
    /** ເງິນ Bank ສຸດທິ — Admin & Manager only (TOR §3.7). */
    setBankNetBalance(dto, user) {
        return this.cash.setBankNetBalance(dto, user);
    }
};
exports.CashController = CashController;
__decorate([
    openapi.ApiQuery({ name: "status", required: false }),
    (0, common_1.Get)('requests'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "listRequests", null);
__decorate([
    (0, roles_decorator_1.Roles)('PAYMENT', 'ADMIN', 'MANAGER'),
    (0, requires_shift_decorator_1.RequiresOpenShift)(),
    (0, common_1.Post)('requests'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cash_dto_1.CreateCashRequestDto, Object, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "createRequest", null);
__decorate([
    (0, roles_decorator_1.Roles)('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('requests/:id/review'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cash_dto_1.ReviewCashRequestDto, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "reviewRequest", null);
__decorate([
    openapi.ApiOperation({ summary: "payment confirms receipt \u2014 the point at which cash actually moves." }),
    (0, roles_decorator_1.Roles)('PAYMENT', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('requests/:id/complete'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "completeRequest", null);
__decorate([
    (0, common_1.Get)('balances'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CashController.prototype, "cashBalances", null);
__decorate([
    (0, common_1.Get)('history'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CashController.prototype, "cashHistory", null);
__decorate([
    (0, roles_decorator_1.Roles)('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('transactions'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cash_dto_1.CreateCashTransactionDto, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "createCashTransaction", null);
__decorate([
    (0, common_1.Get)('bank/balances'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CashController.prototype, "bankBalances", null);
__decorate([
    (0, common_1.Get)('bank/history'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CashController.prototype, "bankHistory", null);
__decorate([
    (0, roles_decorator_1.Roles)('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('bank/transactions'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cash_dto_1.CreateBankTransactionDto, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "createBankTransaction", null);
__decorate([
    openapi.ApiOperation({ summary: "\u0EC0\u0E87\u0EB4\u0E99 Bank \u0EAA\u0EB8\u0E94\u0E97\u0EB4 \u2014 Admin & Manager only (TOR \u00A73.7)." }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('bank/net-balance'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cash_dto_1.SetBankNetBalanceDto, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "setBankNetBalance", null);
exports.CashController = CashController = __decorate([
    (0, swagger_1.ApiTags)('cash'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('cash'),
    __metadata("design:paramtypes", [cash_service_1.CashService])
], CashController);
//# sourceMappingURL=cash.controller.js.map