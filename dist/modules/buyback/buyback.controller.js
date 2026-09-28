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
exports.BuybackController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const buyback_service_1 = require("./buyback.service");
const buyback_dto_1 = require("./dto/buyback.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const requires_shift_decorator_1 = require("../../common/decorators/requires-shift.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
let BuybackController = class BuybackController {
    buyback;
    constructor(buyback) {
        this.buyback = buyback;
    }
    list(status) {
        return this.buyback.list(status);
    }
    /** Live §5.1 calculation for the Valuer's form. */
    preview(dto) {
        return this.buyback.preview(dto);
    }
    create(dto, user, req) {
        // ShiftGuard attaches the open shift; ADMIN/MANAGER are exempt from the
        // guard, so they must be acting on an explicit shift.
        const shiftId = req.shift?.id;
        if (!shiftId)
            throw new common_1.BadRequestException('ຕ້ອງເປີດກະກ່ອນສ້າງລາຍການ Buyback');
        return this.buyback.create(dto, user, shiftId);
    }
    /** payment ກົດ Approve / Reject (TOR §4.2). */
    review(id, dto, user) {
        return this.buyback.review(id, dto, user);
    }
    /** ຜູ້ປະເມີນ ກົດຢືນຢັນອີກຄັ້ງ -> Completed. */
    confirm(id, user) {
        return this.buyback.confirm(id, user);
    }
};
exports.BuybackController = BuybackController;
__decorate([
    openapi.ApiQuery({ name: "status", required: false }),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BuybackController.prototype, "list", null);
__decorate([
    openapi.ApiOperation({ summary: "Live \u00A75.1 calculation for the Valuer's form." }),
    (0, roles_decorator_1.Roles)('VALUER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('preview'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [buyback_dto_1.PreviewBuybackDto]),
    __metadata("design:returntype", void 0)
], BuybackController.prototype, "preview", null);
__decorate([
    (0, roles_decorator_1.Roles)('VALUER', 'ADMIN', 'MANAGER'),
    (0, requires_shift_decorator_1.RequiresOpenShift)(),
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [buyback_dto_1.CreateBuybackDto, Object, Object]),
    __metadata("design:returntype", void 0)
], BuybackController.prototype, "create", null);
__decorate([
    openapi.ApiOperation({ summary: "payment \u0E81\u0EBB\u0E94 Approve / Reject (TOR \u00A74.2)." }),
    (0, roles_decorator_1.Roles)('PAYMENT', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)(':id/review'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, buyback_dto_1.ReviewBuybackDto, Object]),
    __metadata("design:returntype", void 0)
], BuybackController.prototype, "review", null);
__decorate([
    openapi.ApiOperation({ summary: "\u0E9C\u0EB9\u0EC9\u0E9B\u0EB0\u0EC0\u0EA1\u0EB5\u0E99 \u0E81\u0EBB\u0E94\u0EA2\u0EB7\u0E99\u0EA2\u0EB1\u0E99\u0EAD\u0EB5\u0E81\u0E84\u0EB1\u0EC9\u0E87 -> Completed." }),
    (0, roles_decorator_1.Roles)('VALUER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)(':id/confirm'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BuybackController.prototype, "confirm", null);
exports.BuybackController = BuybackController = __decorate([
    (0, swagger_1.ApiTags)('buyback'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('buyback'),
    __metadata("design:paramtypes", [buyback_service_1.BuybackService])
], BuybackController);
//# sourceMappingURL=buyback.controller.js.map