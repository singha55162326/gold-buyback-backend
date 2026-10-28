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
exports.OrdersController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const order_dto_1 = require("./dto/order.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
const history_range_dto_1 = require("../../common/dto/history-range.dto");
let OrdersController = class OrdersController {
    orders;
    constructor(orders) {
        this.orders = orders;
    }
    // The date range defaults to today and a Valuer cannot widen it —
    // HistoryRangeService enforces that, not the client.
    list(query, user, status) {
        return this.orders.list(status, query, user);
    }
    create(dto, user) {
        return this.orders.create(dto, user);
    }
    updateStatus(id, dto, user) {
        return this.orders.updateStatus(id, dto, user);
    }
    /** ຈ່າຍເງິນຄືນທີ່ຮັບຈາກລູກຄ້າ — ຕອນລູກຄ້າມາຮັບເຄື່ອງ. */
    refund(id, dto, user) {
        return this.orders.refund(id, dto, user);
    }
    /** ຊຳລະເພີ່ມ — auto-completes the order when the balance reaches zero. */
    addReceipt(id, dto, user) {
        return this.orders.addReceipt(id, dto, user);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    openapi.ApiQuery({ name: "status", required: false }),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [history_range_dto_1.HistoryRangeDto, Object, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "list", null);
__decorate([
    (0, roles_decorator_1.Roles)('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [order_dto_1.CreateOrderDto, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "create", null);
__decorate([
    (0, roles_decorator_1.Roles)('FINANCIAL_CONTROLLER', 'ADMIN', 'MANAGER'),
    (0, common_1.Patch)(':id/status'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, order_dto_1.UpdateOrderStatusDto, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "updateStatus", null);
__decorate([
    openapi.ApiOperation({ summary: "\u0E88\u0EC8\u0EB2\u0E8D\u0EC0\u0E87\u0EB4\u0E99\u0E84\u0EB7\u0E99\u0E97\u0EB5\u0EC8\u0EAE\u0EB1\u0E9A\u0E88\u0EB2\u0E81\u0EA5\u0EB9\u0E81\u0E84\u0EC9\u0EB2 \u2014 \u0E95\u0EAD\u0E99\u0EA5\u0EB9\u0E81\u0E84\u0EC9\u0EB2\u0EA1\u0EB2\u0EAE\u0EB1\u0E9A\u0EC0\u0E84\u0EB7\u0EC8\u0EAD\u0E87." }),
    (0, roles_decorator_1.Roles)('FINANCIAL_CONTROLLER', 'PAYMENT', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)(':id/refund'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, order_dto_1.ReceiveOrderDto, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "refund", null);
__decorate([
    openapi.ApiOperation({ summary: "\u0E8A\u0EB3\u0EA5\u0EB0\u0EC0\u0E9E\u0EB5\u0EC8\u0EA1 \u2014 auto-completes the order when the balance reaches zero." }),
    (0, roles_decorator_1.Roles)('FINANCIAL_CONTROLLER', 'PAYMENT', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)(':id/receipts'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, order_dto_1.ReceiveOrderDto, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "addReceipt", null);
exports.OrdersController = OrdersController = __decorate([
    (0, swagger_1.ApiTags)('orders'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map