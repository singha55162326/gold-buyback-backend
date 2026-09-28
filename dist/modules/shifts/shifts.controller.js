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
exports.ShiftsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const shifts_service_1 = require("./shifts.service");
const shift_dto_1 = require("./dto/shift.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
let ShiftsController = class ShiftsController {
    shifts;
    constructor(shifts) {
        this.shifts = shifts;
    }
    /** The caller's shift for today — drives the open/close banner in the UI. */
    me(user) {
        return this.shifts.currentFor(user.id);
    }
    open(user) {
        return this.shifts.open(user);
    }
    close(user, dto) {
        return this.shifts.close(user, dto);
    }
    pending() {
        return this.shifts.pending();
    }
    review(id, dto, user) {
        return this.shifts.review(id, dto, user);
    }
};
exports.ShiftsController = ShiftsController;
__decorate([
    openapi.ApiOperation({ summary: "The caller's shift for today \u2014 drives the open/close banner in the UI." }),
    (0, common_1.Get)('me'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ShiftsController.prototype, "me", null);
__decorate([
    (0, roles_decorator_1.Roles)('PAYMENT', 'VALUER'),
    (0, common_1.Post)('open'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ShiftsController.prototype, "open", null);
__decorate([
    (0, roles_decorator_1.Roles)('PAYMENT', 'VALUER'),
    (0, common_1.Post)('close'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, shift_dto_1.CloseShiftDto]),
    __metadata("design:returntype", void 0)
], ShiftsController.prototype, "close", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER'),
    (0, common_1.Get)('pending'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ShiftsController.prototype, "pending", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER'),
    (0, common_1.Post)(':id/review'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, shift_dto_1.ReviewShiftDto, Object]),
    __metadata("design:returntype", void 0)
], ShiftsController.prototype, "review", null);
exports.ShiftsController = ShiftsController = __decorate([
    (0, swagger_1.ApiTags)('shifts'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('shifts'),
    __metadata("design:paramtypes", [shifts_service_1.ShiftsService])
], ShiftsController);
//# sourceMappingURL=shifts.controller.js.map