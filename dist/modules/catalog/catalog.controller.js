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
exports.CatalogController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const catalog_service_1 = require("./catalog.service");
const catalog_dto_1 = require("./dto/catalog.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
const history_range_dto_1 = require("../../common/dto/history-range.dto");
const history_range_service_1 = require("../../common/services/history-range.service");
let CatalogController = class CatalogController {
    catalog;
    range;
    constructor(catalog, range) {
        this.catalog = catalog;
        this.range = range;
    }
    goldTypes(stockOnly, withActor) {
        return this.catalog.listGoldTypes(stockOnly === 'true', withActor === 'true');
    }
    createGoldType(dto, user) {
        return this.catalog.createGoldType(dto, user.id);
    }
    updateGoldType(id, dto, user) {
        return this.catalog.updateGoldType(id, dto, user.id);
    }
    deleteGoldType(id, user) {
        return this.catalog.deleteGoldType(id, user.id);
    }
    goldItems(withActor) {
        return this.catalog.listGoldItems(withActor === 'true');
    }
    createGoldItem(dto, user) {
        return this.catalog.createGoldItem(dto, user.id);
    }
    updateGoldItem(id, dto, user) {
        return this.catalog.updateGoldItem(id, dto, user.id);
    }
    deleteGoldItem(id, user) {
        return this.catalog.deleteGoldItem(id, user.id);
    }
    cabinets(withActor) {
        return this.catalog.listCabinets(withActor === 'true');
    }
    // ບໍ່ສົ່ງວັນທີມາ = ເຫັນຄຳທັງໝົດໃນຕູ້ (ຕູ້ເປັນຍອດຄົງຄ້າງ ບໍ່ແມ່ນປະຫວັດ);
    // ສົ່ງ from_date / to_date ມາ = ເບິ່ງສະເພາະຄຳທີ່ເຂົ້າຕູ້ໃນຊ່ວງນັ້ນ.
    cabinet(id, query, user) {
        const asked = query.from_date ?? query.fromDate ?? query.to_date ?? query.toDate;
        if (!asked)
            return this.catalog.cabinetContents(id);
        const range = this.range.resolve(query, user);
        return this.catalog.cabinetContents(id, history_range_service_1.HistoryRangeService.window(range));
    }
    createCabinet(dto, user) {
        return this.catalog.createCabinet(dto, user.id);
    }
    updateCabinet(id, dto, user) {
        return this.catalog.updateCabinet(id, dto, user.id);
    }
    deleteCabinet(id, user) {
        return this.catalog.deleteCabinet(id, user.id);
    }
    partners(direction, withActor) {
        return this.catalog.listPartners(direction, withActor === 'true');
    }
    createPartner(dto, user) {
        return this.catalog.createPartner(dto, user.id);
    }
    updatePartner(id, dto, user) {
        return this.catalog.updatePartner(id, dto, user.id);
    }
    deletePartner(id, user) {
        return this.catalog.deletePartner(id, user.id);
    }
    bankAccounts(withActor) {
        return this.catalog.listBankAccounts(withActor === 'true');
    }
};
exports.CatalogController = CatalogController;
__decorate([
    openapi.ApiQuery({ name: "stockOnly", required: false }),
    openapi.ApiQuery({ name: "withActor", required: false }),
    (0, common_1.Get)('gold-types'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('stockOnly')),
    __param(1, (0, common_1.Query)('withActor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "goldTypes", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('gold-types'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [catalog_dto_1.CreateGoldTypeDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "createGoldType", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Patch)('gold-types/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, catalog_dto_1.UpdateGoldTypeDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "updateGoldType", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Delete)('gold-types/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "deleteGoldType", null);
__decorate([
    openapi.ApiQuery({ name: "withActor", required: false }),
    (0, common_1.Get)('gold-items'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('withActor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "goldItems", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('gold-items'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [catalog_dto_1.CreateGoldItemDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "createGoldItem", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Patch)('gold-items/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, catalog_dto_1.UpdateGoldItemDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "updateGoldItem", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Delete)('gold-items/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "deleteGoldItem", null);
__decorate([
    openapi.ApiQuery({ name: "withActor", required: false }),
    (0, common_1.Get)('cabinets'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('withActor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "cabinets", null);
__decorate([
    (0, common_1.Get)('cabinets/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, history_range_dto_1.HistoryRangeDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "cabinet", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('cabinets'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [catalog_dto_1.CreateCabinetDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "createCabinet", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Patch)('cabinets/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, catalog_dto_1.UpdateCabinetDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "updateCabinet", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Delete)('cabinets/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "deleteCabinet", null);
__decorate([
    openapi.ApiQuery({ name: "direction", required: false }),
    openapi.ApiQuery({ name: "withActor", required: false }),
    (0, common_1.Get)('partners'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('direction')),
    __param(1, (0, common_1.Query)('withActor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "partners", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('partners'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [catalog_dto_1.CreatePartnerDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "createPartner", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Patch)('partners/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, catalog_dto_1.UpdatePartnerDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "updatePartner", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Delete)('partners/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "deletePartner", null);
__decorate([
    openapi.ApiQuery({ name: "withActor", required: false }),
    (0, common_1.Get)('bank-accounts'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('withActor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "bankAccounts", null);
exports.CatalogController = CatalogController = __decorate([
    (0, swagger_1.ApiTags)('catalog'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('catalog'),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService,
        history_range_service_1.HistoryRangeService])
], CatalogController);
//# sourceMappingURL=catalog.controller.js.map