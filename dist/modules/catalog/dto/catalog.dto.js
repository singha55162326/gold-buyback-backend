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
exports.UpdatePartnerDto = exports.UpdateCabinetDto = exports.UpdateGoldItemDto = exports.UpdateGoldTypeDto = exports.CreatePartnerDto = exports.CreateCabinetDto = exports.CreateGoldItemDto = exports.CreateGoldTypeDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
/**
 * `code` is no longer accepted on create — it is issued by
 * CodeGeneratorService so two people saving at once cannot collide, and so
 * the forms have one less field to get wrong. It stays here only to keep an
 * older client from being rejected outright; the value is ignored.
 */
class LegacyCode {
    code;
    static _OPENAPI_METADATA_FACTORY() {
        return { code: { required: false, type: () => String, maxLength: 40 } };
    }
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ deprecated: true, description: 'ບໍ່ໃຊ້ແລ້ວ — ລະຫັດອອກອັດຕະໂນມັດ' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], LegacyCode.prototype, "code", void 0);
class CreateGoldTypeDto extends LegacyCode {
    nameLo;
    isStockType;
    static _OPENAPI_METADATA_FACTORY() {
        return { nameLo: { required: true, type: () => String, minLength: 1, maxLength: 80 }, isStockType: { required: false, type: () => Boolean } };
    }
}
exports.CreateGoldTypeDto = CreateGoldTypeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateGoldTypeDto.prototype, "nameLo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateGoldTypeDto.prototype, "isStockType", void 0);
class CreateGoldItemDto extends LegacyCode {
    nameLo;
    static _OPENAPI_METADATA_FACTORY() {
        return { nameLo: { required: true, type: () => String, minLength: 1, maxLength: 80 } };
    }
}
exports.CreateGoldItemDto = CreateGoldItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateGoldItemDto.prototype, "nameLo", void 0);
class CreateCabinetDto extends LegacyCode {
    nameLo;
    static _OPENAPI_METADATA_FACTORY() {
        return { nameLo: { required: true, type: () => String, minLength: 1, maxLength: 80 } };
    }
}
exports.CreateCabinetDto = CreateCabinetDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateCabinetDto.prototype, "nameLo", void 0);
class CreatePartnerDto extends LegacyCode {
    nameLo;
    direction;
    tracksGoldApAr;
    static _OPENAPI_METADATA_FACTORY() {
        return { nameLo: { required: true, type: () => String, minLength: 1, maxLength: 80 }, direction: { required: true, enum: ["IN", "OUT", "BOTH"], enum: ['IN', 'OUT', 'BOTH'] }, tracksGoldApAr: { required: false, type: () => Boolean } };
    }
}
exports.CreatePartnerDto = CreatePartnerDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreatePartnerDto.prototype, "nameLo", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['IN', 'OUT', 'BOTH']),
    __metadata("design:type", String)
], CreatePartnerDto.prototype, "direction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreatePartnerDto.prototype, "tracksGoldApAr", void 0);
/**
 * Updates never touch `code`. An issued code may already be printed on a
 * receipt or quoted in a ledger row, so it is the one field that has to stay
 * put once the row exists.
 */
class UpdateGoldTypeDto {
    nameLo;
    isStockType;
    isActive;
    static _OPENAPI_METADATA_FACTORY() {
        return { nameLo: { required: false, type: () => String, minLength: 1, maxLength: 80 }, isStockType: { required: false, type: () => Boolean }, isActive: { required: false, type: () => Boolean } };
    }
}
exports.UpdateGoldTypeDto = UpdateGoldTypeDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], UpdateGoldTypeDto.prototype, "nameLo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateGoldTypeDto.prototype, "isStockType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateGoldTypeDto.prototype, "isActive", void 0);
class UpdateGoldItemDto {
    nameLo;
    isActive;
    static _OPENAPI_METADATA_FACTORY() {
        return { nameLo: { required: false, type: () => String, minLength: 1, maxLength: 80 }, isActive: { required: false, type: () => Boolean } };
    }
}
exports.UpdateGoldItemDto = UpdateGoldItemDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], UpdateGoldItemDto.prototype, "nameLo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateGoldItemDto.prototype, "isActive", void 0);
class UpdateCabinetDto {
    nameLo;
    isActive;
    static _OPENAPI_METADATA_FACTORY() {
        return { nameLo: { required: false, type: () => String, minLength: 1, maxLength: 80 }, isActive: { required: false, type: () => Boolean } };
    }
}
exports.UpdateCabinetDto = UpdateCabinetDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], UpdateCabinetDto.prototype, "nameLo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCabinetDto.prototype, "isActive", void 0);
class UpdatePartnerDto {
    nameLo;
    direction;
    tracksGoldApAr;
    isActive;
    static _OPENAPI_METADATA_FACTORY() {
        return { nameLo: { required: false, type: () => String, minLength: 1, maxLength: 80 }, direction: { required: false, enum: ["IN", "OUT", "BOTH"], enum: ['IN', 'OUT', 'BOTH'] }, tracksGoldApAr: { required: false, type: () => Boolean }, isActive: { required: false, type: () => Boolean } };
    }
}
exports.UpdatePartnerDto = UpdatePartnerDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], UpdatePartnerDto.prototype, "nameLo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['IN', 'OUT', 'BOTH']),
    __metadata("design:type", String)
], UpdatePartnerDto.prototype, "direction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdatePartnerDto.prototype, "tracksGoldApAr", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdatePartnerDto.prototype, "isActive", void 0);
//# sourceMappingURL=catalog.dto.js.map