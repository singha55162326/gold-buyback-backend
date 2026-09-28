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
exports.PricingController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const pricing_service_1 = require("./pricing.service");
const set_pricing_dto_1 = require("./dto/set-pricing.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
let PricingController = class PricingController {
    pricing;
    constructor(pricing) {
        this.pricing = pricing;
    }
    /** The current price board — every role needs to read it. */
    current() {
        return this.pricing.current();
    }
    /** History Products — 30 rows by default (TOR §3.1). */
    history(limit) {
        return this.pricing.history(limit);
    }
    /** Live preview of the board before saving. */
    preview(dto) {
        return this.pricing.preview(dto.price1Baht);
    }
    /** Set Pricing (TOR §3.1) — ADMIN/MANAGER only. */
    set(dto, user) {
        return this.pricing.setPricing(dto, user.id);
    }
};
exports.PricingController = PricingController;
__decorate([
    openapi.ApiOperation({ summary: "The current price board \u2014 every role needs to read it." }),
    (0, common_1.Get)('current'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PricingController.prototype, "current", null);
__decorate([
    openapi.ApiOperation({ summary: "History Products \u2014 30 rows by default (TOR \u00A73.1)." }),
    (0, common_1.Get)('history'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(30), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], PricingController.prototype, "history", null);
__decorate([
    openapi.ApiOperation({ summary: "Live preview of the board before saving." }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('preview'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [set_pricing_dto_1.PreviewPricingDto]),
    __metadata("design:returntype", void 0)
], PricingController.prototype, "preview", null);
__decorate([
    openapi.ApiOperation({ summary: "Set Pricing (TOR \u00A73.1) \u2014 ADMIN/MANAGER only." }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('set'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [set_pricing_dto_1.SetPricingDto, Object]),
    __metadata("design:returntype", void 0)
], PricingController.prototype, "set", null);
exports.PricingController = PricingController = __decorate([
    (0, swagger_1.ApiTags)('pricing'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('pricing'),
    __metadata("design:paramtypes", [pricing_service_1.PricingService])
], PricingController);
//# sourceMappingURL=pricing.controller.js.map