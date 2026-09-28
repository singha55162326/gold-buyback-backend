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
exports.SettleApArCashDto = exports.CreateApArCashEntryDto = exports.CreateApArCashCategoryDto = exports.CreateConsignmentDto = exports.ConsignmentLineDto = exports.CreateIncomeExpenseDto = exports.CreateIncomeExpenseCategoryDto = exports.CreateBankAccountDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
/** §3.7 — Module ລາຍການ Bank */
class CreateBankAccountDto {
    code;
    nameLo;
    static _OPENAPI_METADATA_FACTORY() {
        return { code: { required: true, type: () => String, minLength: 2, maxLength: 40 }, nameLo: { required: true, type: () => String, minLength: 1, maxLength: 80 } };
    }
}
exports.CreateBankAccountDto = CreateBankAccountDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateBankAccountDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateBankAccountDto.prototype, "nameLo", void 0);
/** §3.7 — Module ເພີ້ມລາຍການຮັບຈ່າຍ */
class CreateIncomeExpenseCategoryDto {
    code;
    nameLo;
    kind;
    static _OPENAPI_METADATA_FACTORY() {
        return { code: { required: true, type: () => String, minLength: 2, maxLength: 40 }, nameLo: { required: true, type: () => String, minLength: 1, maxLength: 80 }, kind: { required: true, enum: ["INCOME", "EXPENSE"], enum: ['INCOME', 'EXPENSE'] } };
    }
}
exports.CreateIncomeExpenseCategoryDto = CreateIncomeExpenseCategoryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateIncomeExpenseCategoryDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateIncomeExpenseCategoryDto.prototype, "nameLo", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['INCOME', 'EXPENSE']),
    __metadata("design:type", String)
], CreateIncomeExpenseCategoryDto.prototype, "kind", void 0);
/** §3.7 — Module ຈັດການລາຍຮັບລາຍຈ່າຍ */
class CreateIncomeExpenseDto {
    categoryId;
    method;
    bankAccountId;
    currency;
    amount;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { categoryId: { required: true, type: () => String }, method: { required: true, enum: ["CASH", "BANK"], enum: ['CASH', 'BANK'] }, bankAccountId: { required: false, type: () => String }, currency: { required: true, enum: ["LAK", "THB", "USD"], enum: ['LAK', 'THB', 'USD'] }, amount: { required: true, type: () => String }, note: { required: false, type: () => String } };
    }
}
exports.CreateIncomeExpenseDto = CreateIncomeExpenseDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateIncomeExpenseDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['CASH', 'BANK']),
    __metadata("design:type", String)
], CreateIncomeExpenseDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateIncomeExpenseDto.prototype, "bankAccountId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['LAK', 'THB', 'USD']),
    __metadata("design:type", String)
], CreateIncomeExpenseDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], CreateIncomeExpenseDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateIncomeExpenseDto.prototype, "note", void 0);
/** §3.7 — Module ຝາກສິນຄ້າ */
class ConsignmentLineDto {
    nameLo;
    weightG;
    quantity;
    static _OPENAPI_METADATA_FACTORY() {
        return { nameLo: { required: true, type: () => String, minLength: 1 }, weightG: { required: true, type: () => String }, quantity: { required: true, type: () => Number, minimum: 1 } };
    }
}
exports.ConsignmentLineDto = ConsignmentLineDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ConsignmentLineDto.prototype, "nameLo", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], ConsignmentLineDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ConsignmentLineDto.prototype, "quantity", void 0);
class CreateConsignmentDto {
    /** ປ້ອນລະຫັດ — the shop's own bill reference. */
    billId;
    phone;
    customerName;
    staffName;
    lines;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { billId: { required: true, type: () => String, description: "\u0E9B\u0EC9\u0EAD\u0E99\u0EA5\u0EB0\u0EAB\u0EB1\u0E94 \u2014 the shop's own bill reference.", minLength: 1, maxLength: 40 }, phone: { required: true, type: () => String, pattern: "^\\d{8}$" }, customerName: { required: true, type: () => String, minLength: 1 }, staffName: { required: true, type: () => String, minLength: 1 }, lines: { required: true, type: () => [require("./finance.dto").ConsignmentLineDto], minItems: 1 }, note: { required: false, type: () => String } };
    }
}
exports.CreateConsignmentDto = CreateConsignmentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateConsignmentDto.prototype, "billId", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' }),
    __metadata("design:type", String)
], CreateConsignmentDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateConsignmentDto.prototype, "customerName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateConsignmentDto.prototype, "staffName", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: 'ຕ້ອງມີລາຍການຝາກຢ່າງໜ້ອຍ 1 ລາຍການ' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ConsignmentLineDto),
    __metadata("design:type", Array)
], CreateConsignmentDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateConsignmentDto.prototype, "note", void 0);
/** §9.1 — Module ລາຍການ AP-AR (Cash) */
class CreateApArCashCategoryDto {
    code;
    nameLo;
    /** Omit to allow the category on both sides. */
    side;
    static _OPENAPI_METADATA_FACTORY() {
        return { code: { required: true, type: () => String, minLength: 2, maxLength: 40 }, nameLo: { required: true, type: () => String, minLength: 1, maxLength: 80 }, side: { required: false, description: "Omit to allow the category on both sides.", enum: ["AP", "AR"], enum: ['AP', 'AR'] } };
    }
}
exports.CreateApArCashCategoryDto = CreateApArCashCategoryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateApArCashCategoryDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateApArCashCategoryDto.prototype, "nameLo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['AP', 'AR']),
    __metadata("design:type", String)
], CreateApArCashCategoryDto.prototype, "side", void 0);
/** §9.3 / §9.4 — +Add AP Cash / +Add AR Cash */
class CreateApArCashEntryDto {
    partnerId;
    categoryId;
    currency;
    amount;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { partnerId: { required: true, type: () => String }, categoryId: { required: true, type: () => String }, currency: { required: true, enum: ["LAK", "THB", "USD"], enum: ['LAK', 'THB', 'USD'] }, amount: { required: true, type: () => String }, note: { required: false, type: () => String } };
    }
}
exports.CreateApArCashEntryDto = CreateApArCashEntryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateApArCashEntryDto.prototype, "partnerId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateApArCashEntryDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['LAK', 'THB', 'USD']),
    __metadata("design:type", String)
], CreateApArCashEntryDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], CreateApArCashEntryDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateApArCashEntryDto.prototype, "note", void 0);
/** §9.3 / §9.4 — ປຸ່ມ Payment */
class SettleApArCashDto {
    partnerId;
    method;
    bankAccountId;
    currency;
    amount;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { partnerId: { required: true, type: () => String }, method: { required: true, enum: ["CASH", "BANK"], enum: ['CASH', 'BANK'] }, bankAccountId: { required: false, type: () => String }, currency: { required: true, enum: ["LAK", "THB", "USD"], enum: ['LAK', 'THB', 'USD'] }, amount: { required: true, type: () => String }, note: { required: false, type: () => String } };
    }
}
exports.SettleApArCashDto = SettleApArCashDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SettleApArCashDto.prototype, "partnerId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['CASH', 'BANK']),
    __metadata("design:type", String)
], SettleApArCashDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SettleApArCashDto.prototype, "bankAccountId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['LAK', 'THB', 'USD']),
    __metadata("design:type", String)
], SettleApArCashDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], SettleApArCashDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SettleApArCashDto.prototype, "note", void 0);
//# sourceMappingURL=finance.dto.js.map