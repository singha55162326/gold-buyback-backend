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
exports.AdminController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const admin_service_1 = require("./admin.service");
const admin_dto_1 = require("./dto/admin.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
/** User Setting, Deleted List, Audit Log and the day-rollover job (§3.7, §10). */
let AdminController = class AdminController {
    admin;
    constructor(admin) {
        this.admin = admin;
    }
    listUsers() {
        return this.admin.listUsers();
    }
    createUser(dto, user) {
        return this.admin.createUser(dto, user);
    }
    updateUser(id, dto, user) {
        return this.admin.updateUser(id, dto, user);
    }
    resetPassword(id, dto, user) {
        return this.admin.resetPassword(id, dto, user);
    }
    deletedList() {
        return this.admin.deletedList();
    }
    auditLog(limit) {
        return this.admin.auditLog(limit);
    }
    /**
     * Audit trail for one entity — backs the VIEW (Action, Change Details)
     * buttons the TOR asks for in §3.2 and §3.4.
     */
    auditForEntity(entity, entityId) {
        return this.admin.auditForEntity(entity, entityId);
    }
    /** ປິດມື້ ແລະ ຍົກຍອດ — §7.1, §7.2, §9.2. */
    rollover(user) {
        return this.admin.rolloverDay(user);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('users'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Post)('users'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_dto_1.CreateUserDto, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createUser", null);
__decorate([
    (0, common_1.Patch)('users/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_dto_1.UpdateUserDto, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateUser", null);
__decorate([
    (0, common_1.Post)('users/:id/password'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_dto_1.ResetPasswordDto, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Get)('deleted'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deletedList", null);
__decorate([
    (0, common_1.Get)('audit-log'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(200), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "auditLog", null);
__decorate([
    openapi.ApiOperation({ summary: "Audit trail for one entity \u2014 backs the VIEW (Action, Change Details)\nbuttons the TOR asks for in \u00A73.2 and \u00A73.4." }),
    openapi.ApiQuery({ name: "entityId", required: false }),
    (0, common_1.Get)('audit-log/:entity'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Param)('entity')),
    __param(1, (0, common_1.Query)('entityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "auditForEntity", null);
__decorate([
    openapi.ApiOperation({ summary: "\u0E9B\u0EB4\u0E94\u0EA1\u0EB7\u0EC9 \u0EC1\u0EA5\u0EB0 \u0E8D\u0EBB\u0E81\u0E8D\u0EAD\u0E94 \u2014 \u00A77.1, \u00A77.2, \u00A79.2." }),
    (0, common_1.Post)('rollover'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "rollover", null);
exports.AdminController = AdminController = __decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, swagger_1.ApiTags)('admin'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('admin'),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map