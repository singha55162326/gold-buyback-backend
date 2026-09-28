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
exports.ExchangeController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const exchange_service_1 = require("./exchange.service");
const exchange_dto_1 = require("./dto/exchange.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const requires_shift_decorator_1 = require("../../common/decorators/requires-shift.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
let ExchangeController = class ExchangeController {
    exchange;
    constructor(exchange) {
        this.exchange = exchange;
    }
    list(status) {
        return this.exchange.list(status);
    }
    /**
     * Live totals plus the §5.2 balance check — the form calls this on every
     * change so the Save button reflects the same rule the API enforces.
     */
    preview(dto) {
        return this.exchange.preview(dto);
    }
    create(dto, user, req) {
        const shiftId = req.shift?.id;
        if (!shiftId)
            throw new common_1.BadRequestException('ຕ້ອງເປີດກະກ່ອນສ້າງລາຍການ');
        return this.exchange.create(dto, user, shiftId);
    }
    review(id, dto, user) {
        return this.exchange.review(id, dto, user);
    }
};
exports.ExchangeController = ExchangeController;
__decorate([
    openapi.ApiQuery({ name: "status", required: false }),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ExchangeController.prototype, "list", null);
__decorate([
    openapi.ApiOperation({ summary: "Live totals plus the \u00A75.2 balance check \u2014 the form calls this on every\nchange so the Save button reflects the same rule the API enforces." }),
    (0, roles_decorator_1.Roles)('VALUER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('preview'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [exchange_dto_1.PreviewExchangeDto]),
    __metadata("design:returntype", void 0)
], ExchangeController.prototype, "preview", null);
__decorate([
    (0, roles_decorator_1.Roles)('VALUER', 'ADMIN', 'MANAGER'),
    (0, requires_shift_decorator_1.RequiresOpenShift)(),
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [exchange_dto_1.CreateExchangeDto, Object, Object]),
    __metadata("design:returntype", void 0)
], ExchangeController.prototype, "create", null);
__decorate([
    (0, roles_decorator_1.Roles)('PAYMENT', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)(':id/review'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, exchange_dto_1.ReviewExchangeDto, Object]),
    __metadata("design:returntype", void 0)
], ExchangeController.prototype, "review", null);
exports.ExchangeController = ExchangeController = __decorate([
    (0, swagger_1.ApiTags)('exchange'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('exchange'),
    __metadata("design:paramtypes", [exchange_service_1.ExchangeService])
], ExchangeController);
//# sourceMappingURL=exchange.controller.js.map