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
exports.CreateHandoverDto = exports.FactoryAssessmentDto = exports.ReviewStockDto = exports.CreateTransferDto = exports.CreateStockOutDto = exports.CreateStockInDto = exports.StockLineDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class StockLineDto {
    /** Stock (NEW) lines reference a SKU. */
    goldSkuId;
    /** Stock (OLD) lines reference a ປະເພດຄຳ. */
    goldTypeId;
    /** ໝວດ (ຮູບປະພັນ / ແທ່ງ) — Stock OLD IN ເທົ່ານັ້ນ. */
    oldCategory;
    weightG;
    quantity;
    static _OPENAPI_METADATA_FACTORY() {
        return { goldSkuId: { required: false, type: () => String, description: "Stock (NEW) lines reference a SKU." }, goldTypeId: { required: false, type: () => String, description: "Stock (OLD) lines reference a \u0E9B\u0EB0\u0EC0\u0E9E\u0E94\u0E84\u0EB3." }, oldCategory: { required: false, description: "\u0EDD\u0EA7\u0E94 (\u0EAE\u0EB9\u0E9A\u0E9B\u0EB0\u0E9E\u0EB1\u0E99 / \u0EC1\u0E97\u0EC8\u0E87) \u2014 Stock OLD IN \u0EC0\u0E97\u0EBB\u0EC8\u0EB2\u0E99\u0EB1\u0EC9\u0E99.", enum: ["JEWELRY", "BAR"], enum: ['JEWELRY', 'BAR'] }, weightG: { required: true, type: () => String }, quantity: { required: true, type: () => Number, minimum: 1 } };
    }
}
exports.StockLineDto = StockLineDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StockLineDto.prototype, "goldSkuId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StockLineDto.prototype, "goldTypeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['JEWELRY', 'BAR']),
    __metadata("design:type", String)
], StockLineDto.prototype, "oldCategory", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], StockLineDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], StockLineDto.prototype, "quantity", void 0);
class CreateStockInDto {
    scope;
    /** Stock (NEW) ເທົ່ານັ້ນ — ຄຳເກົ່າເຂົ້າສາງ ແມ່ນ Cashier ສະເໝີ. */
    partnerId;
    lines;
    /** ຕົ້ນທຶນຄໍາ for the whole movement. */
    totalCost;
    /**
     * ຄ່າແຮງ (THB) — becomes an AP (Cash) liability.
     * Stock (NEW) ເທົ່ານັ້ນ; ຄຳເກົ່າຮັບມາຈາກ Cashier ບໍ່ມີຄ່າແຮງ.
     */
    laborFeeThb;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { scope: { required: true, enum: ["NEW", "OLD"], enum: ['NEW', 'OLD'] }, partnerId: { required: false, type: () => String, description: "Stock (NEW) \u0EC0\u0E97\u0EBB\u0EC8\u0EB2\u0E99\u0EB1\u0EC9\u0E99 \u2014 \u0E84\u0EB3\u0EC0\u0E81\u0EBB\u0EC8\u0EB2\u0EC0\u0E82\u0EBB\u0EC9\u0EB2\u0EAA\u0EB2\u0E87 \u0EC1\u0EA1\u0EC8\u0E99 Cashier \u0EAA\u0EB0\u0EC0\u0EDD\u0EB5." }, lines: { required: true, type: () => [require("./stock.dto").StockLineDto], minItems: 1 }, totalCost: { required: true, type: () => String, description: "\u0E95\u0EBB\u0EC9\u0E99\u0E97\u0EB6\u0E99\u0E84\u0ECD\u0EB2 for the whole movement." }, laborFeeThb: { required: false, type: () => String, description: "\u0E84\u0EC8\u0EB2\u0EC1\u0EAE\u0E87 (THB) \u2014 becomes an AP (Cash) liability.\nStock (NEW) \u0EC0\u0E97\u0EBB\u0EC8\u0EB2\u0E99\u0EB1\u0EC9\u0E99; \u0E84\u0EB3\u0EC0\u0E81\u0EBB\u0EC8\u0EB2\u0EAE\u0EB1\u0E9A\u0EA1\u0EB2\u0E88\u0EB2\u0E81 Cashier \u0E9A\u0ECD\u0EC8\u0EA1\u0EB5\u0E84\u0EC8\u0EB2\u0EC1\u0EAE\u0E87." }, note: { required: false, type: () => String } };
    }
}
exports.CreateStockInDto = CreateStockInDto;
__decorate([
    (0, class_validator_1.IsIn)(['NEW', 'OLD']),
    __metadata("design:type", String)
], CreateStockInDto.prototype, "scope", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStockInDto.prototype, "partnerId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: 'ຕ້ອງມີລາຍການຢ່າງໜ້ອຍ 1 ລາຍການ' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => StockLineDto),
    __metadata("design:type", Array)
], CreateStockInDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateStockInDto.prototype, "totalCost", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateStockInDto.prototype, "laborFeeThb", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStockInDto.prototype, "note", void 0);
class CreateStockOutDto {
    scope;
    partnerId;
    cabinetId;
    /** ແປງສະພາບ — ຍ້ອມ / ກັດ / ຫຼອມ. */
    transformType;
    /** %ຄຳ — for OUT to ຊ່າງນອກ / ອື່ນໆ. */
    goldPercent;
    lines;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { scope: { required: true, enum: ["NEW", "OLD"], enum: ['NEW', 'OLD'] }, partnerId: { required: true, type: () => String }, cabinetId: { required: false, type: () => String }, transformType: { required: false, description: "\u0EC1\u0E9B\u0E87\u0EAA\u0EB0\u0E9E\u0EB2\u0E9A \u2014 \u0E8D\u0EC9\u0EAD\u0EA1 / \u0E81\u0EB1\u0E94 / \u0EAB\u0EBC\u0EAD\u0EA1.", enum: ["DYE", "ETCH", "MELT"], enum: ['DYE', 'ETCH', 'MELT'] }, goldPercent: { required: false, type: () => String, description: "%\u0E84\u0EB3 \u2014 for OUT to \u0E8A\u0EC8\u0EB2\u0E87\u0E99\u0EAD\u0E81 / \u0EAD\u0EB7\u0EC8\u0E99\u0EC6." }, lines: { required: true, type: () => [require("./stock.dto").StockLineDto], minItems: 1 }, note: { required: false, type: () => String } };
    }
}
exports.CreateStockOutDto = CreateStockOutDto;
__decorate([
    (0, class_validator_1.IsIn)(['NEW', 'OLD']),
    __metadata("design:type", String)
], CreateStockOutDto.prototype, "scope", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStockOutDto.prototype, "partnerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStockOutDto.prototype, "cabinetId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['DYE', 'ETCH', 'MELT']),
    __metadata("design:type", String)
], CreateStockOutDto.prototype, "transformType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateStockOutDto.prototype, "goldPercent", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => StockLineDto),
    __metadata("design:type", Array)
], CreateStockOutDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStockOutDto.prototype, "note", void 0);
class CreateTransferDto {
    direction;
    /** The ປະເພດຄຳ bucket on the OLD side of the transfer. */
    goldTypeId;
    lines;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { direction: { required: true, enum: ["NEW_TO_OLD", "OLD_TO_NEW"], enum: ['NEW_TO_OLD', 'OLD_TO_NEW'] }, goldTypeId: { required: true, type: () => String, description: "The \u0E9B\u0EB0\u0EC0\u0E9E\u0E94\u0E84\u0EB3 bucket on the OLD side of the transfer." }, lines: { required: true, type: () => [require("./stock.dto").StockLineDto], minItems: 1 }, note: { required: false, type: () => String } };
    }
}
exports.CreateTransferDto = CreateTransferDto;
__decorate([
    (0, class_validator_1.IsIn)(['NEW_TO_OLD', 'OLD_TO_NEW']),
    __metadata("design:type", String)
], CreateTransferDto.prototype, "direction", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTransferDto.prototype, "goldTypeId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => StockLineDto),
    __metadata("design:type", Array)
], CreateTransferDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTransferDto.prototype, "note", void 0);
class ReviewStockDto {
    decision;
    reason;
    static _OPENAPI_METADATA_FACTORY() {
        return { decision: { required: true, enum: ["APPROVED", "REJECTED"], enum: ['APPROVED', 'REJECTED'] }, reason: { required: false, type: () => String } };
    }
}
exports.ReviewStockDto = ReviewStockDto;
__decorate([
    (0, class_validator_1.IsIn)(['APPROVED', 'REJECTED']),
    __metadata("design:type", String)
], ReviewStockDto.prototype, "decision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReviewStockDto.prototype, "reason", void 0);
class FactoryAssessmentDto {
    factoryAssessedG;
    static _OPENAPI_METADATA_FACTORY() {
        return { factoryAssessedG: { required: true, type: () => String } };
    }
}
exports.FactoryAssessmentDto = FactoryAssessmentDto;
__decorate([
    (0, class_validator_1.IsNumberString)({}, { message: 'ນ້ຳໜັກຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], FactoryAssessmentDto.prototype, "factoryAssessedG", void 0);
/**
 * ມອບຄຳລະຫວ່າງມື້ (TOR §4.2).
 *
 * ສອງຮູບແບບໃນ DTO ດຽວ ເພາະເປັນທຸລະກຳອັນດຽວກັນໃນສາຍຕາລູກຄ້າ:
 *  - ຄຳດີ / ຄຳຫຍຸບ / ແທ່ງ → ປ້ອນ ນ້ຳໜັກອອກ + ເນື້ອລ້ວນ + ມີແກ້ວ, ໄລ່ເປັນຮອບ.
 *  - ຄຳຕົ້ມ → ເລືອກລາຍການ Buyback ທີ່ຍັງບໍ່ໄດ້ມອບ, ບໍ່ໄລ່ເປັນຮອບ.
 * ຝ່າຍ server ເປັນຜູ້ຕັດສິນວ່າເປັນຮູບແບບໃດ ຈາກ ປະເພດຄຳ — ບໍ່ເຊື່ອ flag ຈາກ client.
 */
class CreateHandoverDto {
    goldTypeId;
    /** ນ້ຳໜັກອອກ — ບັງຄັບສຳລັບ ຄຳດີ/ຄຳຫຍຸບ/ແທ່ງ. */
    grossWeightG;
    /** ເນື້ອລ້ວນ. */
    pureWeightG;
    /** ມີແກ້ວ. */
    glassWeightG;
    /** ລາຍການ Buyback ຄຳຕົ້ມ ທີ່ມອບໃນຮອບນີ້. */
    buybackIds;
    /**
     * ຮູບແບບເກົ່າ: ນ້ຳໜັກກ້ອນດຽວ. ຍັງຮັບໄວ້ເພື່ອບໍ່ໃຫ້ client ເກົ່າພັງ,
     * ແຕ່ຟອມໃໝ່ສົ່ງ grossWeightG ມາແທນ.
     */
    weightG;
    note;
    static _OPENAPI_METADATA_FACTORY() {
        return { goldTypeId: { required: true, type: () => String }, grossWeightG: { required: false, type: () => String, description: "\u0E99\u0EC9\u0EB3\u0EDC\u0EB1\u0E81\u0EAD\u0EAD\u0E81 \u2014 \u0E9A\u0EB1\u0E87\u0E84\u0EB1\u0E9A\u0EAA\u0EB3\u0EA5\u0EB1\u0E9A \u0E84\u0EB3\u0E94\u0EB5/\u0E84\u0EB3\u0EAB\u0E8D\u0EB8\u0E9A/\u0EC1\u0E97\u0EC8\u0E87." }, pureWeightG: { required: false, type: () => String, description: "\u0EC0\u0E99\u0EB7\u0EC9\u0EAD\u0EA5\u0EC9\u0EA7\u0E99." }, glassWeightG: { required: false, type: () => String, description: "\u0EA1\u0EB5\u0EC1\u0E81\u0EC9\u0EA7." }, buybackIds: { required: false, type: () => [String], description: "\u0EA5\u0EB2\u0E8D\u0E81\u0EB2\u0E99 Buyback \u0E84\u0EB3\u0E95\u0EBB\u0EC9\u0EA1 \u0E97\u0EB5\u0EC8\u0EA1\u0EAD\u0E9A\u0EC3\u0E99\u0EAE\u0EAD\u0E9A\u0E99\u0EB5\u0EC9.", minItems: 1 }, weightG: { required: false, type: () => String, description: "\u0EAE\u0EB9\u0E9A\u0EC1\u0E9A\u0E9A\u0EC0\u0E81\u0EBB\u0EC8\u0EB2: \u0E99\u0EC9\u0EB3\u0EDC\u0EB1\u0E81\u0E81\u0EC9\u0EAD\u0E99\u0E94\u0EBD\u0EA7. \u0E8D\u0EB1\u0E87\u0EAE\u0EB1\u0E9A\u0EC4\u0EA7\u0EC9\u0EC0\u0E9E\u0EB7\u0EC8\u0EAD\u0E9A\u0ECD\u0EC8\u0EC3\u0EAB\u0EC9 client \u0EC0\u0E81\u0EBB\u0EC8\u0EB2\u0E9E\u0EB1\u0E87,\n\u0EC1\u0E95\u0EC8\u0E9F\u0EAD\u0EA1\u0EC3\u0EDD\u0EC8\u0EAA\u0EBB\u0EC8\u0E87 grossWeightG \u0EA1\u0EB2\u0EC1\u0E97\u0E99." }, note: { required: false, type: () => String } };
    }
}
exports.CreateHandoverDto = CreateHandoverDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHandoverDto.prototype, "goldTypeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)({}, { message: 'ນ້ຳໜັກອອກຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], CreateHandoverDto.prototype, "grossWeightG", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)({}, { message: 'ເນື້ອລ້ວນຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], CreateHandoverDto.prototype, "pureWeightG", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)({}, { message: 'ນ້ຳໜັກມີແກ້ວຕ້ອງເປັນຕົວເລກ' }),
    __metadata("design:type", String)
], CreateHandoverDto.prototype, "glassWeightG", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: 'ຕ້ອງເລືອກລາຍການຄຳເກົ່າຢ່າງໜ້ອຍ 1 ລາຍການ' }),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateHandoverDto.prototype, "buybackIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateHandoverDto.prototype, "weightG", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHandoverDto.prototype, "note", void 0);
//# sourceMappingURL=stock.dto.js.map