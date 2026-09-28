"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuybackModule = void 0;
const common_1 = require("@nestjs/common");
const buyback_controller_1 = require("./buyback.controller");
const buyback_service_1 = require("./buyback.service");
const pricing_module_1 = require("../pricing/pricing.module");
let BuybackModule = class BuybackModule {
};
exports.BuybackModule = BuybackModule;
exports.BuybackModule = BuybackModule = __decorate([
    (0, common_1.Module)({
        imports: [pricing_module_1.PricingModule],
        controllers: [buyback_controller_1.BuybackController],
        providers: [buyback_service_1.BuybackService],
        exports: [buyback_service_1.BuybackService],
    })
], BuybackModule);
//# sourceMappingURL=buyback.module.js.map