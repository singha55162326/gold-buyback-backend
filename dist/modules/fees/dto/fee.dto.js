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
exports.UpdateDeductionDto = exports.UpdateSoftGoldFeeDto = exports.UpsertBarFeeDto = exports.UpsertJewelryFeeDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
/** ຄ່າປ່ຽນຮູບປະພັນ — TOR §3.4 */
class UpsertJewelryFeeDto {
    tierCode;
    weightG;
    feeGoodShape;
    feeDamagedShape;
    static _OPENAPI_METADATA_FACTORY() {
        return { tierCode: { required: true, type: () => String }, weightG: { required: true, type: () => String }, feeGoodShape: { required: true, type: () => String }, feeDamagedShape: { required: true, type: () => String } };
    }
}
exports.UpsertJewelryFeeDto = UpsertJewelryFeeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertJewelryFeeDto.prototype, "tierCode", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], UpsertJewelryFeeDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], UpsertJewelryFeeDto.prototype, "feeGoodShape", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], UpsertJewelryFeeDto.prototype, "feeDamagedShape", void 0);
/** ຄ່າປ່ຽນຄຳແທ່ງ — TOR §3.4 */
class UpsertBarFeeDto {
    weightG;
    barToJewelry;
    barToBar;
    static _OPENAPI_METADATA_FACTORY() {
        return { weightG: { required: true, type: () => String }, barToJewelry: { required: true, type: () => String }, barToBar: { required: true, type: () => String } };
    }
}
exports.UpsertBarFeeDto = UpsertBarFeeDto;
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], UpsertBarFeeDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], UpsertBarFeeDto.prototype, "barToJewelry", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], UpsertBarFeeDto.prototype, "barToBar", void 0);
/** ຄ່າອ່ອນ — TOR §3.4 */
class UpdateSoftGoldFeeDto {
    value;
    static _OPENAPI_METADATA_FACTORY() {
        return { value: { required: true, type: () => String } };
    }
}
exports.UpdateSoftGoldFeeDto = UpdateSoftGoldFeeDto;
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'ຄ່າຄຳອ່ອນຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], UpdateSoftGoldFeeDto.prototype, "value", void 0);
/** ຫັກອອກ (%) / ລາຄາລົບອອກ — TOR §3.2 */
class UpdateDeductionDto {
    tierCode;
    kind;
    value;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { tierCode: { required: true, type: () => String }, kind: { required: true, enum: ["PERCENT", "AMOUNT"], enum: ['PERCENT', 'AMOUNT'] }, value: { required: true, type: () => String }, note: { required: false, type: () => String } };
    }
}
exports.UpdateDeductionDto = UpdateDeductionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateDeductionDto.prototype, "tierCode", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['PERCENT', 'AMOUNT']),
    __metadata("design:type", String)
], UpdateDeductionDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], UpdateDeductionDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateDeductionDto.prototype, "note", void 0);
//# sourceMappingURL=fee.dto.js.map