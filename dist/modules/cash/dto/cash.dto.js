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
exports.SetBankNetBalanceDto = exports.CreateBankTransactionDto = exports.CreateCashTransactionDto = exports.ReviewCashRequestDto = exports.CreateCashRequestDto = exports.CashAmountLineDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CashAmountLineDto {
    currency;
    amount;
    static _OPENAPI_METADATA_FACTORY() {
        return { currency: { required: true, enum: ["LAK", "THB", "USD"], enum: ['LAK', 'THB', 'USD'] }, amount: { required: true, type: () => String } };
    }
}
exports.CashAmountLineDto = CashAmountLineDto;
__decorate([
    (0, class_validator_1.IsIn)(['LAK', 'THB', 'USD']),
    __metadata("design:type", String)
], CashAmountLineDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], CashAmountLineDto.prototype, "amount", void 0);
/** ເບີກເງິນ (+) / ມອບເງິນ (-) — TOR §4.1. */
class CreateCashRequestDto {
    direction;
    lines;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { direction: { required: true, enum: ["WITHDRAW", "HANDOVER"], enum: ['WITHDRAW', 'HANDOVER'] }, lines: { required: true, type: () => [require("./cash.dto").CashAmountLineDto], minItems: 1 }, note: { required: false, type: () => String } };
    }
}
exports.CreateCashRequestDto = CreateCashRequestDto;
__decorate([
    (0, class_validator_1.IsIn)(['WITHDRAW', 'HANDOVER']),
    __metadata("design:type", String)
], CreateCashRequestDto.prototype, "direction", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: 'ຕ້ອງປ້ອນຈຳນວນເງິນຢ່າງໜ້ອຍ 1 ສະກຸນ' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CashAmountLineDto),
    __metadata("design:type", Array)
], CreateCashRequestDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCashRequestDto.prototype, "note", void 0);
class ReviewCashRequestDto {
    decision;
    reason;
    static _OPENAPI_METADATA_FACTORY() {
        return { decision: { required: true, enum: ["APPROVED", "REJECTED"], enum: ['APPROVED', 'REJECTED'] }, reason: { required: false, type: () => String } };
    }
}
exports.ReviewCashRequestDto = ReviewCashRequestDto;
__decorate([
    (0, class_validator_1.IsIn)(['APPROVED', 'REJECTED']),
    __metadata("design:type", String)
], ReviewCashRequestDto.prototype, "decision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReviewCashRequestDto.prototype, "reason", void 0);
/** Direct Cash In/Out/Other Income/Expense — TOR §3.7. */
class CreateCashTransactionDto {
    type;
    currency;
    amount;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { type: { required: true, enum: ["IN", "OUT", "OTHER_INCOME", "OTHER_EXPENSE"], enum: ['IN', 'OUT', 'OTHER_INCOME', 'OTHER_EXPENSE'] }, currency: { required: true, enum: ["LAK", "THB", "USD"], enum: ['LAK', 'THB', 'USD'] }, amount: { required: true, type: () => String }, note: { required: false, type: () => String } };
    }
}
exports.CreateCashTransactionDto = CreateCashTransactionDto;
__decorate([
    (0, class_validator_1.IsIn)(['IN', 'OUT', 'OTHER_INCOME', 'OTHER_EXPENSE']),
    __metadata("design:type", String)
], CreateCashTransactionDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['LAK', 'THB', 'USD']),
    __metadata("design:type", String)
], CreateCashTransactionDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateCashTransactionDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCashTransactionDto.prototype, "note", void 0);
/** Bank Deposit/Withdraw/Income/Expense — TOR §3.7. */
class CreateBankTransactionDto {
    bankAccountId;
    type;
    currency;
    amount;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { bankAccountId: { required: true, type: () => String }, type: { required: true, enum: ["DEPOSIT", "WITHDRAW", "INCOME", "EXPENSE"], enum: ['DEPOSIT', 'WITHDRAW', 'INCOME', 'EXPENSE'] }, currency: { required: true, enum: ["LAK", "THB", "USD"], enum: ['LAK', 'THB', 'USD'] }, amount: { required: true, type: () => String }, note: { required: false, type: () => String } };
    }
}
exports.CreateBankTransactionDto = CreateBankTransactionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBankTransactionDto.prototype, "bankAccountId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['DEPOSIT', 'WITHDRAW', 'INCOME', 'EXPENSE']),
    __metadata("design:type", String)
], CreateBankTransactionDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['LAK', 'THB', 'USD']),
    __metadata("design:type", String)
], CreateBankTransactionDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateBankTransactionDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBankTransactionDto.prototype, "note", void 0);
/** ເງິນ Bank ສຸດທິ — ADMIN/MANAGER only (TOR §3.7). */
class SetBankNetBalanceDto {
    bankAccountId;
    currency;
    netAmount;
    static _OPENAPI_METADATA_FACTORY() {
        return { bankAccountId: { required: true, type: () => String }, currency: { required: true, enum: ["LAK", "THB", "USD"], enum: ['LAK', 'THB', 'USD'] }, netAmount: { required: true, type: () => String } };
    }
}
exports.SetBankNetBalanceDto = SetBankNetBalanceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SetBankNetBalanceDto.prototype, "bankAccountId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['LAK', 'THB', 'USD']),
    __metadata("design:type", String)
], SetBankNetBalanceDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], SetBankNetBalanceDto.prototype, "netAmount", void 0);
//# sourceMappingURL=cash.dto.js.map