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
exports.CreatePartnerDto = exports.CreateCabinetDto = exports.CreateGoldItemDto = exports.CreateGoldTypeDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateGoldTypeDto {
    code;
    nameLo;
    isStockType;
    static _OPENAPI_METADATA_FACTORY() {
        return { code: { required: true, type: () => String, minLength: 2, maxLength: 40 }, nameLo: { required: true, type: () => String, minLength: 1, maxLength: 80 }, isStockType: { required: false, type: () => Boolean } };
    }
}
exports.CreateGoldTypeDto = CreateGoldTypeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateGoldTypeDto.prototype, "code", void 0);
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
class CreateGoldItemDto {
    code;
    nameLo;
    static _OPENAPI_METADATA_FACTORY() {
        return { code: { required: true, type: () => String, minLength: 2, maxLength: 40 }, nameLo: { required: true, type: () => String, minLength: 1, maxLength: 80 } };
    }
}
exports.CreateGoldItemDto = CreateGoldItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateGoldItemDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateGoldItemDto.prototype, "nameLo", void 0);
class CreateCabinetDto {
    code;
    nameLo;
    static _OPENAPI_METADATA_FACTORY() {
        return { code: { required: true, type: () => String, minLength: 2, maxLength: 40 }, nameLo: { required: true, type: () => String, minLength: 1, maxLength: 80 } };
    }
}
exports.CreateCabinetDto = CreateCabinetDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateCabinetDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateCabinetDto.prototype, "nameLo", void 0);
class CreatePartnerDto {
    code;
    nameLo;
    direction;
    tracksGoldApAr;
    static _OPENAPI_METADATA_FACTORY() {
        return { code: { required: true, type: () => String, minLength: 2, maxLength: 40 }, nameLo: { required: true, type: () => String, minLength: 1, maxLength: 80 }, direction: { required: true, enum: ["IN", "OUT", "BOTH"], enum: ['IN', 'OUT', 'BOTH'] }, tracksGoldApAr: { required: false, type: () => Boolean } };
    }
}
exports.CreatePartnerDto = CreatePartnerDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreatePartnerDto.prototype, "code", void 0);
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
//# sourceMappingURL=catalog.dto.js.map