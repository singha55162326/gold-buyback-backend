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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const system_service_1 = require("./system.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const swagger_1 = require("@nestjs/swagger");
let SystemController = class SystemController {
    system;
    constructor(system) {
        this.system = system;
    }
    /**
     * Liveness for scripts and monitors — deliberately unauthenticated so a
     * start-up script can wait on it before opening a browser. It reveals only
     * whether the process and its database are up.
     */
    health() {
        return this.system.health();
    }
    /** The Admin setup checklist (TOR §3). */
    readiness() {
        return this.system.readiness();
    }
};
exports.SystemController = SystemController;
__decorate([
    openapi.ApiOperation({ summary: "Liveness for scripts and monitors \u2014 deliberately unauthenticated so a\nstart-up script can wait on it before opening a browser. It reveals only\nwhether the process and its database are up." }),
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('health'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "health", null);
__decorate([
    openapi.ApiOperation({ summary: "The Admin setup checklist (TOR \u00A73)." }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Get)('system/readiness'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "readiness", null);
exports.SystemController = SystemController = __decorate([
    (0, swagger_1.ApiTags)('system'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [system_service_1.SystemService])
], SystemController);
//# sourceMappingURL=system.controller.js.map