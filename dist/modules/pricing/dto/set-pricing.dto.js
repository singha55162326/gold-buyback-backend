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
exports.PreviewPricingDto = exports.SetPricingDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class SetPricingDto {
    /**
     * ລາຄາຂາຍ 1 ບາດ. Sent as a string so the value never passes through a
     * JS float on its way from the browser to DECIMAL(18,4).
     */
    price1Baht;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { price1Baht: { required: true, type: () => String, description: "\u0EA5\u0EB2\u0E84\u0EB2\u0E82\u0EB2\u0E8D 1 \u0E9A\u0EB2\u0E94. Sent as a string so the value never passes through a\nJS float on its way from the browser to DECIMAL(18,4)." }, note: { required: false, type: () => String, maxLength: 500 } };
    }
}
exports.SetPricingDto = SetPricingDto;
__decorate([
    (0, class_validator_1.IsNumberString)({ no_symbols: false }, { message: 'ລາຄາຂາຍ 1 ບາດ ຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], SetPricingDto.prototype, "price1Baht", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SetPricingDto.prototype, "note", void 0);
class PreviewPricingDto extends SetPricingDto {
    static _OPENAPI_METADATA_FACTORY() {
        return {};
    }
}
exports.PreviewPricingDto = PreviewPricingDto;
//# sourceMappingURL=set-pricing.dto.js.map