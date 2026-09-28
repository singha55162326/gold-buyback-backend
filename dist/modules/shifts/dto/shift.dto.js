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
exports.ReviewShiftDto = exports.CloseShiftDto = exports.ShiftBalanceLineDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class ShiftBalanceLineDto {
    currency;
    amount;
    static _OPENAPI_METADATA_FACTORY() {
        return { currency: { required: true, enum: ["LAK", "THB", "USD"], enum: ['LAK', 'THB', 'USD'] }, amount: { required: true, type: () => String } };
    }
}
exports.ShiftBalanceLineDto = ShiftBalanceLineDto;
__decorate([
    (0, class_validator_1.IsIn)(['LAK', 'THB', 'USD']),
    __metadata("design:type", String)
], ShiftBalanceLineDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], ShiftBalanceLineDto.prototype, "amount", void 0);
/** ປິດກະ — the closing LAK/THB/USD go to Module Cash pending FC approval. */
class CloseShiftDto {
    balances;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { balances: { required: true, type: () => [require("./shift.dto").ShiftBalanceLineDto] }, note: { required: false, type: () => String } };
    }
}
exports.CloseShiftDto = CloseShiftDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ShiftBalanceLineDto),
    __metadata("design:type", Array)
], CloseShiftDto.prototype, "balances", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CloseShiftDto.prototype, "note", void 0);
class ReviewShiftDto {
    decision;
    reason;
    static _OPENAPI_METADATA_FACTORY() {
        return { decision: { required: true, enum: ["APPROVED", "REJECTED"], enum: ['APPROVED', 'REJECTED'] }, reason: { required: false, type: () => String } };
    }
}
exports.ReviewShiftDto = ReviewShiftDto;
__decorate([
    (0, class_validator_1.IsIn)(['APPROVED', 'REJECTED']),
    __metadata("design:type", String)
], ReviewShiftDto.prototype, "decision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReviewShiftDto.prototype, "reason", void 0);
//# sourceMappingURL=shift.dto.js.map