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
exports.UpdateRatesDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
/** TOR §3.3 — 'Update Price Rate'. All four rates move together. */
class UpdateRatesDto {
    thbSellRate;
    usdSellRate;
    thbBuybackRate;
    usdBuybackRate;
    static _OPENAPI_METADATA_FACTORY() {
        return { thbSellRate: { required: true, type: () => String }, usdSellRate: { required: true, type: () => String }, thbBuybackRate: { required: true, type: () => String }, usdBuybackRate: { required: true, type: () => String } };
    }
}
exports.UpdateRatesDto = UpdateRatesDto;
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'THB Sell Rate ຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], UpdateRatesDto.prototype, "thbSellRate", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'USD Sell Rate ຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], UpdateRatesDto.prototype, "usdSellRate", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'THB Buyback Rate ຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], UpdateRatesDto.prototype, "thbBuybackRate", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'USD Buyback Rate ຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], UpdateRatesDto.prototype, "usdBuybackRate", void 0);
//# sourceMappingURL=rate.dto.js.map