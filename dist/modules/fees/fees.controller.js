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
exports.FeesController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const fees_service_1 = require("./fees.service");
const fee_dto_1 = require("./dto/fee.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
let FeesController = class FeesController {
    fees;
    constructor(fees) {
        this.fees = fees;
    }
    // ຄ່າປ່ຽນ (§3.4)
    jewelryFees() {
        return this.fees.currentJewelryFees();
    }
    upsertJewelryFee(dto, user) {
        return this.fees.upsertJewelryFee(dto, user.id);
    }
    barFees() {
        return this.fees.currentBarFees();
    }
    upsertBarFee(dto, user) {
        return this.fees.upsertBarFee(dto, user.id);
    }
    // ຄ່າອ່ອນ (§3.4)
    softGoldFee() {
        return this.fees.currentSoftGoldFee();
    }
    softGoldFeeHistory(limit) {
        return this.fees.softGoldFeeHistory(limit);
    }
    updateSoftGoldFee(dto, user) {
        return this.fees.updateSoftGoldFee(dto, user.id);
    }
    // ຫັກອອກ (%) / ລາຄາລົບອອກ (§3.2)
    deductions() {
        return this.fees.currentDeductions();
    }
    updateDeduction(dto, user) {
        return this.fees.updateDeduction(dto, user.id);
    }
};
exports.FeesController = FeesController;
__decorate([
    (0, common_1.Get)('conversion/jewelry'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FeesController.prototype, "jewelryFees", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('conversion/jewelry'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fee_dto_1.UpsertJewelryFeeDto, Object]),
    __metadata("design:returntype", void 0)
], FeesController.prototype, "upsertJewelryFee", null);
__decorate([
    (0, common_1.Get)('conversion/bar'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FeesController.prototype, "barFees", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('conversion/bar'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fee_dto_1.UpsertBarFeeDto, Object]),
    __metadata("design:returntype", void 0)
], FeesController.prototype, "upsertBarFee", null);
__decorate([
    (0, common_1.Get)('soft-gold'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FeesController.prototype, "softGoldFee", null);
__decorate([
    (0, common_1.Get)('soft-gold/history'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(30), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], FeesController.prototype, "softGoldFeeHistory", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('soft-gold'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fee_dto_1.UpdateSoftGoldFeeDto, Object]),
    __metadata("design:returntype", void 0)
], FeesController.prototype, "updateSoftGoldFee", null);
__decorate([
    (0, common_1.Get)('buyback-deductions'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FeesController.prototype, "deductions", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('buyback-deductions'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fee_dto_1.UpdateDeductionDto, Object]),
    __metadata("design:returntype", void 0)
], FeesController.prototype, "updateDeduction", null);
exports.FeesController = FeesController = __decorate([
    (0, swagger_1.ApiTags)('fees'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('fees'),
    __metadata("design:paramtypes", [fees_service_1.FeesService])
], FeesController);
//# sourceMappingURL=fees.controller.js.map