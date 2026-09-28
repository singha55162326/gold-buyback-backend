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
exports.UpdateOrderStatusDto = exports.CreateOrderDto = exports.OrderReceiptDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class OrderReceiptDto {
    method;
    bankAccountId;
    currency;
    amount;
    static _OPENAPI_METADATA_FACTORY() {
        return { method: { required: true, enum: ["CASH", "BANK"], enum: ['CASH', 'BANK'] }, bankAccountId: { required: false, type: () => String }, currency: { required: true, enum: ["LAK", "THB", "USD"], enum: ['LAK', 'THB', 'USD'] }, amount: { required: true, type: () => String } };
    }
}
exports.OrderReceiptDto = OrderReceiptDto;
__decorate([
    (0, class_validator_1.IsIn)(['CASH', 'BANK']),
    __metadata("design:type", String)
], OrderReceiptDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrderReceiptDto.prototype, "bankAccountId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['LAK', 'THB', 'USD']),
    __metadata("design:type", String)
], OrderReceiptDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], OrderReceiptDto.prototype, "amount", void 0);
class CreateOrderDto {
    phone;
    /** ເລກບິນ 4 ຕົວຫຼັກ (TOR §7). */
    billNo;
    productType;
    /** ຊື່ພະນັກງານ ທີ່ຮັບ Order. */
    staffName;
    goldItemId;
    weightG;
    quantity;
    totalAmount;
    note;
    receipt;
    static _OPENAPI_METADATA_FACTORY() {
        return { phone: { required: true, type: () => String, pattern: "^\\d{8}$" }, billNo: { required: true, type: () => String, description: "\u0EC0\u0EA5\u0E81\u0E9A\u0EB4\u0E99 4 \u0E95\u0EBB\u0EA7\u0EAB\u0EBC\u0EB1\u0E81 (TOR \u00A77).", pattern: "^\\d{4}$" }, productType: { required: true, enum: ["IT", "ITP"], enum: ['IT', 'ITP'] }, staffName: { required: true, type: () => String, description: "\u0E8A\u0EB7\u0EC8\u0E9E\u0EB0\u0E99\u0EB1\u0E81\u0E87\u0EB2\u0E99 \u0E97\u0EB5\u0EC8\u0EAE\u0EB1\u0E9A Order." }, goldItemId: { required: true, type: () => String }, weightG: { required: true, type: () => String }, quantity: { required: true, type: () => Number, minimum: 1 }, totalAmount: { required: true, type: () => String }, note: { required: false, type: () => String }, receipt: { required: true, type: () => require("./order.dto").OrderReceiptDto } };
    }
}
exports.CreateOrderDto = CreateOrderDto;
__decorate([
    (0, class_validator_1.Matches)(/^\d{8}$/, { message: 'ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ' }),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^\d{4}$/, { message: 'ເລກບິນຕ້ອງເປັນຕົວເລກ 4 ຕົວ' }),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "billNo", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['IT', 'ITP'], { message: 'ປະເພດສິນຄ້າຕ້ອງເປັນ IT ຫຼື ITP' }),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "productType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "staffName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "goldItemId", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "totalAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "note", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => OrderReceiptDto),
    __metadata("design:type", OrderReceiptDto)
], CreateOrderDto.prototype, "receipt", void 0);
class UpdateOrderStatusDto {
    status;
    /** Required for SENT_TO_SMITH — ເລືອກ Supplier (TOR §7). */
    supplierId;
    /** Required for RECEIVED_FROM_SMITH — ວັນທີຮັບເຄື່ອງ. */
    receivedFromSmithAt;
    /** Required for COMPLETED — ວັນທີລູກຄ້າມາຮັບເຄື່ອງ. */
    customerPickupAt;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { status: { required: true, enum: ["COMPLETED", "CANCELLED", "SENT_TO_SMITH", "RECEIVED_FROM_SMITH", "AWAITING_PICKUP"], enum: [
                    'SENT_TO_SMITH',
                    'RECEIVED_FROM_SMITH',
                    'AWAITING_PICKUP',
                    'COMPLETED',
                    'CANCELLED',
                ] }, supplierId: { required: false, type: () => String, description: "Required for SENT_TO_SMITH \u2014 \u0EC0\u0EA5\u0EB7\u0EAD\u0E81 Supplier (TOR \u00A77)." }, receivedFromSmithAt: { required: false, type: () => String, description: "Required for RECEIVED_FROM_SMITH \u2014 \u0EA7\u0EB1\u0E99\u0E97\u0EB5\u0EAE\u0EB1\u0E9A\u0EC0\u0E84\u0EB7\u0EC8\u0EAD\u0E87." }, customerPickupAt: { required: false, type: () => String, description: "Required for COMPLETED \u2014 \u0EA7\u0EB1\u0E99\u0E97\u0EB5\u0EA5\u0EB9\u0E81\u0E84\u0EC9\u0EB2\u0EA1\u0EB2\u0EAE\u0EB1\u0E9A\u0EC0\u0E84\u0EB7\u0EC8\u0EAD\u0E87." }, note: { required: false, type: () => String } };
    }
}
exports.UpdateOrderStatusDto = UpdateOrderStatusDto;
__decorate([
    (0, class_validator_1.IsIn)([
        'SENT_TO_SMITH',
        'RECEIVED_FROM_SMITH',
        'AWAITING_PICKUP',
        'COMPLETED',
        'CANCELLED',
    ]),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "supplierId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "receivedFromSmithAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "customerPickupAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "note", void 0);
//# sourceMappingURL=order.dto.js.map