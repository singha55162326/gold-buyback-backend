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
exports.StockController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const stock_service_1 = require("./stock.service");
const stock_dto_1 = require("./dto/stock.dto");
const prisma_service_1 = require("../../prisma/prisma.service");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const requires_shift_decorator_1 = require("../../common/decorators/requires-shift.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
let StockController = class StockController {
    stock;
    prisma;
    constructor(stock, prisma) {
        this.stock = stock;
        this.prisma = prisma;
    }
    /* ---- Reads ---- */
    listMovements(scope, status) {
        return this.stock.listMovements(scope, status);
    }
    newHistory() {
        return this.stock.newHistory();
    }
    newBalances() {
        return this.stock.newBalances();
    }
    oldHistory() {
        return this.stock.oldHistory();
    }
    oldBalances() {
        return this.stock.oldBalances();
    }
    /* ---- Movements ---- */
    stockIn(dto, user) {
        return this.stock.stockIn(dto, user);
    }
    stockOut(dto, user) {
        return this.stock.stockOut(dto, user);
    }
    /** Stock OUT approval is Admin/Manager only (TOR §2, §7.1). */
    reviewOut(id, dto, user) {
        return this.stock.reviewOut(id, dto, user);
    }
    transfer(dto, user) {
        return this.stock.transfer(dto, user);
    }
    /* ---- §7.3 FACTORY tracking ---- */
    listFactoryTracking() {
        return this.stock.listFactoryTracking();
    }
    /**
     * ອັບເດດ ນໍ້າໜັກg FACTORY ປະເມີນ.
     *
     * §7.3: ເມື່ອ Completed ແລ້ວ ຜູ້ໃຊ້ທົ່ວໄປບໍ່ສາມາດແກ້ໄຂໄດ້ — ສິດແກ້ໄຂຫຼັງ
     * Completed ມີສະເພາະ ROLE Admin & Manager ເທົ່ານັ້ນ.
     */
    async recordFactoryAssessment(id, dto, user) {
        const tracking = await this.prisma.factoryOutTracking.findUnique({ where: { id } });
        if (!tracking)
            throw new common_1.BadRequestException('ບໍ່ພົບລາຍການຕິດຕາມ');
        if (tracking.status === 'COMPLETED' && !['ADMIN', 'MANAGER'].includes(user.role)) {
            throw new common_1.ForbiddenException('ລາຍການນີ້ Completed ແລ້ວ — ມີພຽງ Admin ຫຼື Manager ເທົ່ານັ້ນທີ່ແກ້ໄຂໄດ້');
        }
        return this.stock.recordFactoryAssessment(id, dto, user);
    }
    /* ---- §4.2 ສະຫຼຸບປະເພດຄຳ ---- */
    oldGoldSummary() {
        return this.stock.oldGoldSummary();
    }
    /* ---- §4.2 ມອບຄຳລະຫວ່າງມື້ ---- */
    listHandovers(status) {
        return this.stock.listHandovers(status);
    }
    createHandover(dto, user, req) {
        const shiftId = req.shift?.id;
        if (!shiftId)
            throw new common_1.BadRequestException('ຕ້ອງເປີດກະກ່ອນມອບຄຳ');
        return this.stock.createHandover(dto, user, shiftId);
    }
    reviewHandover(id, dto, user) {
        return this.stock.reviewHandover(id, dto, user);
    }
};
exports.StockController = StockController;
__decorate([
    openapi.ApiQuery({ name: "scope", required: false }),
    openapi.ApiQuery({ name: "status", required: false }),
    (0, common_1.Get)('movements'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('scope')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "listMovements", null);
__decorate([
    (0, common_1.Get)('new/history'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockController.prototype, "newHistory", null);
__decorate([
    (0, common_1.Get)('new/balances'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockController.prototype, "newBalances", null);
__decorate([
    (0, common_1.Get)('old/history'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockController.prototype, "oldHistory", null);
__decorate([
    (0, common_1.Get)('old/balances'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockController.prototype, "oldBalances", null);
__decorate([
    (0, roles_decorator_1.Roles)('WAREHOUSE', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('in'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_dto_1.CreateStockInDto, Object]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "stockIn", null);
__decorate([
    (0, roles_decorator_1.Roles)('WAREHOUSE', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('out'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_dto_1.CreateStockOutDto, Object]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "stockOut", null);
__decorate([
    openapi.ApiOperation({ summary: "Stock OUT approval is Admin/Manager only (TOR \u00A72, \u00A77.1)." }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('out/:id/review'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, stock_dto_1.ReviewStockDto, Object]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "reviewOut", null);
__decorate([
    (0, roles_decorator_1.Roles)('WAREHOUSE', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('transfer'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_dto_1.CreateTransferDto, Object]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "transfer", null);
__decorate([
    (0, common_1.Get)('factory'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockController.prototype, "listFactoryTracking", null);
__decorate([
    openapi.ApiOperation({ summary: "\u0EAD\u0EB1\u0E9A\u0EC0\u0E94\u0E94 \u0E99\u0ECD\u0EC9\u0EB2\u0EDC\u0EB1\u0E81g FACTORY \u0E9B\u0EB0\u0EC0\u0EA1\u0EB5\u0E99.\n\n\u00A77.3: \u0EC0\u0EA1\u0EB7\u0EC8\u0EAD Completed \u0EC1\u0EA5\u0EC9\u0EA7 \u0E9C\u0EB9\u0EC9\u0EC3\u0E8A\u0EC9\u0E97\u0EBB\u0EC8\u0EA7\u0EC4\u0E9B\u0E9A\u0ECD\u0EC8\u0EAA\u0EB2\u0EA1\u0EB2\u0E94\u0EC1\u0E81\u0EC9\u0EC4\u0E82\u0EC4\u0E94\u0EC9 \u2014 \u0EAA\u0EB4\u0E94\u0EC1\u0E81\u0EC9\u0EC4\u0E82\u0EAB\u0EBC\u0EB1\u0E87\nCompleted \u0EA1\u0EB5\u0EAA\u0EB0\u0EC0\u0E9E\u0EB2\u0EB0 ROLE Admin & Manager \u0EC0\u0E97\u0EBB\u0EC8\u0EB2\u0E99\u0EB1\u0EC9\u0E99." }),
    (0, roles_decorator_1.Roles)('WAREHOUSE', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('factory/:id/assessment'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, stock_dto_1.FactoryAssessmentDto, Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "recordFactoryAssessment", null);
__decorate([
    (0, common_1.Get)('old-gold-summary'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockController.prototype, "oldGoldSummary", null);
__decorate([
    openapi.ApiQuery({ name: "status", required: false }),
    (0, common_1.Get)('handovers'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "listHandovers", null);
__decorate([
    (0, roles_decorator_1.Roles)('PAYMENT', 'ADMIN', 'MANAGER'),
    (0, requires_shift_decorator_1.RequiresOpenShift)(),
    (0, common_1.Post)('handovers'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_dto_1.CreateHandoverDto, Object, Object]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "createHandover", null);
__decorate([
    (0, roles_decorator_1.Roles)('WAREHOUSE', 'ADMIN', 'MANAGER'),
    (0, common_1.Post)('handovers/:id/review'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, stock_dto_1.ReviewStockDto, Object]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "reviewHandover", null);
exports.StockController = StockController = __decorate([
    (0, swagger_1.ApiTags)('stock'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('stock'),
    __metadata("design:paramtypes", [stock_service_1.StockService,
        prisma_service_1.PrismaService])
], StockController);
//# sourceMappingURL=stock.controller.js.map