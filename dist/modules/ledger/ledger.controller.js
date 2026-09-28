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
exports.LedgerController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const ledger_service_1 = require("./ledger.service");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const swagger_1 = require("@nestjs/swagger");
/**
 * Read-only accounting views (TOR §3.7, §8, §9). Every figure is derived from
 * the ledgers on request, so these endpoints have no write path at all.
 */
let LedgerController = class LedgerController {
    ledger;
    constructor(ledger) {
        this.ledger = ledger;
    }
    wac() {
        return this.ledger.wac();
    }
    coh() {
        return this.ledger.coh();
    }
    wealth() {
        return this.ledger.wealth();
    }
    cashApAr() {
        return this.ledger.cashApAr();
    }
    cashApArHistory() {
        return this.ledger.cashApArHistory();
    }
    goldApAr() {
        return this.ledger.goldApArSummary();
    }
    goldApArByPartner() {
        return this.ledger.goldApArByPartner();
    }
    goldApArHistory() {
        return this.ledger.goldApArHistory();
    }
};
exports.LedgerController = LedgerController;
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'WAREHOUSE', 'FINANCIAL_CONTROLLER'),
    (0, common_1.Get)('wac'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerController.prototype, "wac", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER'),
    (0, common_1.Get)('coh'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerController.prototype, "coh", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Get)('wealth'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerController.prototype, "wealth", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER'),
    (0, common_1.Get)('ap-ar/cash'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerController.prototype, "cashApAr", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER'),
    (0, common_1.Get)('ap-ar/cash/history'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerController.prototype, "cashApArHistory", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER', 'WAREHOUSE'),
    (0, common_1.Get)('ap-ar/gold'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerController.prototype, "goldApAr", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER', 'WAREHOUSE'),
    (0, common_1.Get)('ap-ar/gold/partners'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerController.prototype, "goldApArByPartner", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'FINANCIAL_CONTROLLER', 'WAREHOUSE'),
    (0, common_1.Get)('ap-ar/gold/history'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LedgerController.prototype, "goldApArHistory", null);
exports.LedgerController = LedgerController = __decorate([
    (0, swagger_1.ApiTags)('ledger'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('ledger'),
    __metadata("design:paramtypes", [ledger_service_1.LedgerService])
], LedgerController);
//# sourceMappingURL=ledger.controller.js.map