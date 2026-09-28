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
exports.CreditController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const credit_service_1 = require("./credit.service");
const credit_dto_1 = require("./dto/credit.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const requires_shift_decorator_1 = require("../../common/decorators/requires-shift.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
let CreditController = class CreditController {
    credit;
    constructor(credit) {
        this.credit = credit;
    }
    list(status) {
        return this.credit.list(status);
    }
    create(dto, user, req) {
        const shiftId = req.shift?.id;
        if (!shiftId)
            throw new common_1.BadRequestException('ຕ້ອງເປີດກະກ່ອນສ້າງລາຍການສິນເຊື່ອ');
        return this.credit.create(dto, user, shiftId);
    }
    review(id, dto, user) {
        return this.credit.review(id, dto, user);
    }
    /** ຮັບຄ່າງວດ — draws down the outstanding AR (Cash). */
    addReceipt(id, dto, user) {
        return this.credit.addReceipt(id, dto, user);
    }
};
exports.CreditController = CreditController;
__decorate([
    openapi.ApiQuery({ name: "status", required: false }),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "list", null);
__decorate([
    (0, roles_decorator_1.Roles)('VALUER', 'ADMIN', 'MANAGER'),
    (0, requires_shift_decorator_1.RequiresOpenShift)(),
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [credit_dto_1.CreateCreditDto, Object, Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "create", null);
__decorate([
    (0, roles_decorator_1.Roles)('PAYMENT', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)(':id/review'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, credit_dto_1.ReviewCreditDto, Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "review", null);
__decorate([
    openapi.ApiOperation({ summary: "\u0EAE\u0EB1\u0E9A\u0E84\u0EC8\u0EB2\u0E87\u0EA7\u0E94 \u2014 draws down the outstanding AR (Cash)." }),
    (0, roles_decorator_1.Roles)('PAYMENT', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)(':id/receipts'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, credit_dto_1.CreditReceiptDto, Object]),
    __metadata("design:returntype", void 0)
], CreditController.prototype, "addReceipt", null);
exports.CreditController = CreditController = __decorate([
    (0, swagger_1.ApiTags)('credit'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('credit'),
    __metadata("design:paramtypes", [credit_service_1.CreditService])
], CreditController);
//# sourceMappingURL=credit.controller.js.map