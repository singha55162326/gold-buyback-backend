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
exports.ReviewBuybackDto = exports.PreviewBuybackDto = exports.CreateBuybackDto = exports.BuybackPaymentLineDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class BuybackPaymentLineDto {
    method;
    /** Required when method is BANK. */
    bankAccountId;
    currency;
    amount;
    static _OPENAPI_METADATA_FACTORY() {
        return { method: { required: true, enum: ["CASH", "BANK"], enum: ['CASH', 'BANK'] }, bankAccountId: { required: false, type: () => String, description: "Required when method is BANK." }, currency: { required: true, enum: ["LAK", "THB", "USD"], enum: ['LAK', 'THB', 'USD'] }, amount: { required: true, type: () => String } };
    }
}
exports.BuybackPaymentLineDto = BuybackPaymentLineDto;
__decorate([
    (0, class_validator_1.IsIn)(['CASH', 'BANK']),
    __metadata("design:type", String)
], BuybackPaymentLineDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BuybackPaymentLineDto.prototype, "bankAccountId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['LAK', 'THB', 'USD']),
    __metadata("design:type", String)
], BuybackPaymentLineDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], BuybackPaymentLineDto.prototype, "amount", void 0);
class CreateBuybackDto {
    /** ເບີໂທ 8 ໂຕ (TOR §5.1). */
    phone;
    source;
    goldTypeId;
    goldItemId;
    weightG;
    quantity;
    /** %ຄຳ — required for ຄຳຕົ້ມ (OTHER_SHOP). */
    goldPercent;
    /** ຄ່າອ່ອນ / ຄ່າຫັກ per piece. */
    deduction;
    payments;
    static _OPENAPI_METADATA_FACTORY() {
        return { phone: { required: true, type: () => String, description: "\u0EC0\u0E9A\u0EB5\u0EC2\u0E97 8 \u0EC2\u0E95 (TOR \u00A75.1).", pattern: "^\\d{8}$" }, source: { required: true, enum: ["KPV", "OTHER_SHOP"], enum: ['KPV', 'OTHER_SHOP'] }, goldTypeId: { required: true, type: () => String }, goldItemId: { required: false, type: () => String }, weightG: { required: true, type: () => String }, quantity: { required: true, type: () => Number, minimum: 1 }, goldPercent: { required: false, type: () => String, description: "%\u0E84\u0EB3 \u2014 required for \u0E84\u0EB3\u0E95\u0EBB\u0EC9\u0EA1 (OTHER_SHOP)." }, deduction: { required: false, type: () => String, description: "\u0E84\u0EC8\u0EB2\u0EAD\u0EC8\u0EAD\u0E99 / \u0E84\u0EC8\u0EB2\u0EAB\u0EB1\u0E81 per piece." }, payments: { required: true, type: () => [require("./buyback.dto").BuybackPaymentLineDto], minItems: 1 } };
    }
}
exports.CreateBuybackDto = CreateBuybackDto;
__decorate([
    (0, class_validator_1.Matches)(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' }),
    __metadata("design:type", String)
], CreateBuybackDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['KPV', 'OTHER_SHOP']),
    __metadata("design:type", String)
], CreateBuybackDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuybackDto.prototype, "goldTypeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuybackDto.prototype, "goldItemId", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'ນ້ຳໜັກຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], CreateBuybackDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1, { message: 'ຈຳນວນຕ້ອງຢ່າງໜ້ອຍ 1' }),
    __metadata("design:type", Number)
], CreateBuybackDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateBuybackDto.prototype, "goldPercent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateBuybackDto.prototype, "deduction", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: 'ຕ້ອງມີລາຍການຈ່າຍເງິນຢ່າງໜ້ອຍ 1 ລາຍການ' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BuybackPaymentLineDto),
    __metadata("design:type", Array)
], CreateBuybackDto.prototype, "payments", void 0);
/** Preview the §5.1 calculation without creating anything. */
class PreviewBuybackDto {
    source;
    goldTypeId;
    weightG;
    quantity;
    goldPercent;
    deduction;
    static _OPENAPI_METADATA_FACTORY() {
        return { source: { required: true, enum: ["KPV", "OTHER_SHOP"], enum: ['KPV', 'OTHER_SHOP'] }, goldTypeId: { required: true, type: () => String }, weightG: { required: true, type: () => String }, quantity: { required: true, type: () => Number, minimum: 1 }, goldPercent: { required: false, type: () => String }, deduction: { required: false, type: () => String } };
    }
}
exports.PreviewBuybackDto = PreviewBuybackDto;
__decorate([
    (0, class_validator_1.IsIn)(['KPV', 'OTHER_SHOP']),
    __metadata("design:type", String)
], PreviewBuybackDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PreviewBuybackDto.prototype, "goldTypeId", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], PreviewBuybackDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PreviewBuybackDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], PreviewBuybackDto.prototype, "goldPercent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], PreviewBuybackDto.prototype, "deduction", void 0);
class ReviewBuybackDto {
    decision;
    reason;
    static _OPENAPI_METADATA_FACTORY() {
        return { decision: { required: true, enum: ["APPROVED", "REJECTED"], enum: ['APPROVED', 'REJECTED'] }, reason: { required: false, type: () => String } };
    }
}
exports.ReviewBuybackDto = ReviewBuybackDto;
__decorate([
    (0, class_validator_1.IsIn)(['APPROVED', 'REJECTED']),
    __metadata("design:type", String)
], ReviewBuybackDto.prototype, "decision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReviewBuybackDto.prototype, "reason", void 0);
//# sourceMappingURL=buyback.dto.js.map