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
exports.UpdateSkuDto = exports.CreateSkuDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateSkuDto {
    goldItemId;
    /** ຊື່ສິນຄ້າ, e.g. "ສາຍແຂນ". */
    nameLo;
    /** ນ້ຳໜັກ (g). String to preserve DECIMAL(18,4) precision. */
    weightG;
    static _OPENAPI_METADATA_FACTORY() {
        return { goldItemId: { required: true, type: () => String }, nameLo: { required: true, type: () => String, description: "\u0E8A\u0EB7\u0EC8\u0EAA\u0EB4\u0E99\u0E84\u0EC9\u0EB2, e.g. \"\u0EAA\u0EB2\u0E8D\u0EC1\u0E82\u0E99\".", minLength: 1, maxLength: 120 }, weightG: { required: true, type: () => String, description: "\u0E99\u0EC9\u0EB3\u0EDC\u0EB1\u0E81 (g). String to preserve DECIMAL(18,4) precision." } };
    }
}
exports.CreateSkuDto = CreateSkuDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSkuDto.prototype, "goldItemId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateSkuDto.prototype, "nameLo", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({ no_symbols: false }, { message: 'ນ້ຳໜັກຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], CreateSkuDto.prototype, "weightG", void 0);
class UpdateSkuDto {
    nameLo;
    weightG;
    isActive;
    static _OPENAPI_METADATA_FACTORY() {
        return { nameLo: { required: false, type: () => String, maxLength: 120 }, weightG: { required: false, type: () => String }, isActive: { required: false, type: () => Boolean } };
    }
}
exports.UpdateSkuDto = UpdateSkuDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateSkuDto.prototype, "nameLo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], UpdateSkuDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateSkuDto.prototype, "isActive", void 0);
//# sourceMappingURL=sku.dto.js.map