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
exports.ReviewExchangeDto = exports.PreviewExchangeDto = exports.CreateExchangeDto = exports.ExchangePaymentLineDto = exports.ExchangeRemainingLineDto = exports.ExchangeNewLineDto = exports.ExchangeOldLineDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class ExchangeOldLineDto {
    goldTypeId;
    goldItemId;
    weightG;
    quantity;
    /** ເກນນ້ຳໜັກ standard — the weight the piece left the shop at. */
    standardWeightG;
    static _OPENAPI_METADATA_FACTORY() {
        return { goldTypeId: { required: true, type: () => String }, goldItemId: { required: false, type: () => String }, weightG: { required: true, type: () => String }, quantity: { required: true, type: () => Number, minimum: 1 }, standardWeightG: { required: true, type: () => String, description: "\u0EC0\u0E81\u0E99\u0E99\u0EC9\u0EB3\u0EDC\u0EB1\u0E81 standard \u2014 the weight the piece left the shop at." } };
    }
}
exports.ExchangeOldLineDto = ExchangeOldLineDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ExchangeOldLineDto.prototype, "goldTypeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ExchangeOldLineDto.prototype, "goldItemId", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], ExchangeOldLineDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ExchangeOldLineDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], ExchangeOldLineDto.prototype, "standardWeightG", void 0);
class ExchangeNewLineDto {
    goldSkuId;
    cabinetId;
    weightG;
    quantity;
    humpFee;
    barConvertFee;
    patternFee;
    static _OPENAPI_METADATA_FACTORY() {
        return { goldSkuId: { required: true, type: () => String }, cabinetId: { required: false, type: () => String }, weightG: { required: true, type: () => String }, quantity: { required: true, type: () => Number, minimum: 1 }, humpFee: { required: false, type: () => String }, barConvertFee: { required: false, type: () => String }, patternFee: { required: false, type: () => String } };
    }
}
exports.ExchangeNewLineDto = ExchangeNewLineDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ExchangeNewLineDto.prototype, "goldSkuId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ExchangeNewLineDto.prototype, "cabinetId", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], ExchangeNewLineDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ExchangeNewLineDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], ExchangeNewLineDto.prototype, "humpFee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], ExchangeNewLineDto.prototype, "barConvertFee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], ExchangeNewLineDto.prototype, "patternFee", void 0);
class ExchangeRemainingLineDto {
    weightG;
    quantity;
    static _OPENAPI_METADATA_FACTORY() {
        return { weightG: { required: true, type: () => String }, quantity: { required: true, type: () => Number, minimum: 1 } };
    }
}
exports.ExchangeRemainingLineDto = ExchangeRemainingLineDto;
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], ExchangeRemainingLineDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ExchangeRemainingLineDto.prototype, "quantity", void 0);
/** §5.2 now carries the same Cash/Bank payment step as §5.1. */
class ExchangePaymentLineDto {
    method;
    bankAccountId;
    currency;
    amount;
    static _OPENAPI_METADATA_FACTORY() {
        return { method: { required: true, enum: ["CASH", "BANK"], enum: ['CASH', 'BANK'] }, bankAccountId: { required: false, type: () => String }, currency: { required: true, enum: ["LAK", "THB", "USD"], enum: ['LAK', 'THB', 'USD'] }, amount: { required: true, type: () => String } };
    }
}
exports.ExchangePaymentLineDto = ExchangePaymentLineDto;
__decorate([
    (0, class_validator_1.IsIn)(['CASH', 'BANK']),
    __metadata("design:type", String)
], ExchangePaymentLineDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ExchangePaymentLineDto.prototype, "bankAccountId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['LAK', 'THB', 'USD']),
    __metadata("design:type", String)
], ExchangePaymentLineDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], ExchangePaymentLineDto.prototype, "amount", void 0);
class CreateExchangeDto {
    phone;
    txnType;
    shapeCondition;
    oldLines;
    newLines;
    remainingLines;
    payments;
    static _OPENAPI_METADATA_FACTORY() {
        return { phone: { required: true, type: () => String, pattern: "^\\d{8}$" }, txnType: { required: true, enum: ["EXCHANGE_TO_CASH", "FREE_EXCHANGE"], enum: ['EXCHANGE_TO_CASH', 'FREE_EXCHANGE'] }, shapeCondition: { required: true, enum: ["GOOD", "DAMAGED"], enum: ['GOOD', 'DAMAGED'] }, oldLines: { required: true, type: () => [require("./exchange.dto").ExchangeOldLineDto], minItems: 1 }, newLines: { required: true, type: () => [require("./exchange.dto").ExchangeNewLineDto] }, remainingLines: { required: true, type: () => [require("./exchange.dto").ExchangeRemainingLineDto] }, payments: { required: false, type: () => [require("./exchange.dto").ExchangePaymentLineDto] } };
    }
}
exports.CreateExchangeDto = CreateExchangeDto;
__decorate([
    (0, class_validator_1.Matches)(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' }),
    __metadata("design:type", String)
], CreateExchangeDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['EXCHANGE_TO_CASH', 'FREE_EXCHANGE']),
    __metadata("design:type", String)
], CreateExchangeDto.prototype, "txnType", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['GOOD', 'DAMAGED']),
    __metadata("design:type", String)
], CreateExchangeDto.prototype, "shapeCondition", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: 'ຕ້ອງມີລາຍການຄຳເກົ່າຢ່າງໜ້ອຍ 1 ລາຍການ' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ExchangeOldLineDto),
    __metadata("design:type", Array)
], CreateExchangeDto.prototype, "oldLines", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ExchangeNewLineDto),
    __metadata("design:type", Array)
], CreateExchangeDto.prototype, "newLines", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ExchangeRemainingLineDto),
    __metadata("design:type", Array)
], CreateExchangeDto.prototype, "remainingLines", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ExchangePaymentLineDto),
    __metadata("design:type", Array)
], CreateExchangeDto.prototype, "payments", void 0);
/** Same shape, but only calculates — used by the live form. */
class PreviewExchangeDto extends CreateExchangeDto {
    static _OPENAPI_METADATA_FACTORY() {
        return {};
    }
}
exports.PreviewExchangeDto = PreviewExchangeDto;
class ReviewExchangeDto {
    decision;
    reason;
    static _OPENAPI_METADATA_FACTORY() {
        return { decision: { required: true, enum: ["APPROVED", "REJECTED"], enum: ['APPROVED', 'REJECTED'] }, reason: { required: false, type: () => String } };
    }
}
exports.ReviewExchangeDto = ReviewExchangeDto;
__decorate([
    (0, class_validator_1.IsIn)(['APPROVED', 'REJECTED']),
    __metadata("design:type", String)
], ReviewExchangeDto.prototype, "decision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReviewExchangeDto.prototype, "reason", void 0);
//# sourceMappingURL=exchange.dto.js.map