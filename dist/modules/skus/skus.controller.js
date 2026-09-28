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
exports.SkusController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const skus_service_1 = require("./skus.service");
const sku_dto_1 = require("./dto/sku.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
let SkusController = class SkusController {
    skus;
    constructor(skus) {
        this.skus = skus;
    }
    list(includeInactive) {
        return this.skus.list(includeInactive === 'true');
    }
    /** Real-time SKU-name preview as the user types (TOR §3.6). */
    preview(nameLo, weightG) {
        return this.skus.preview(nameLo ?? '', weightG ?? '0');
    }
    create(dto, user) {
        return this.skus.create(dto, user.id);
    }
    update(id, dto, user) {
        return this.skus.update(id, dto, user.id);
    }
    remove(id, user) {
        return this.skus.remove(id, user.id);
    }
};
exports.SkusController = SkusController;
__decorate([
    openapi.ApiQuery({ name: "includeInactive", required: false }),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SkusController.prototype, "list", null);
__decorate([
    openapi.ApiOperation({ summary: "Real-time SKU-name preview as the user types (TOR \u00A73.6)." }),
    (0, common_1.Get)('preview'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('nameLo')),
    __param(1, (0, common_1.Query)('weightG')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SkusController.prototype, "preview", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sku_dto_1.CreateSkuDto, Object]),
    __metadata("design:returntype", void 0)
], SkusController.prototype, "create", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Patch)(':id'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, sku_dto_1.UpdateSkuDto, Object]),
    __metadata("design:returntype", void 0)
], SkusController.prototype, "update", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SkusController.prototype, "remove", null);
exports.SkusController = SkusController = __decorate([
    (0, swagger_1.ApiTags)('skus'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('skus'),
    __metadata("design:paramtypes", [skus_service_1.SkusService])
], SkusController);
//# sourceMappingURL=skus.controller.js.map