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
exports.HistoryRangeDto = void 0;
const openapi = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
/**
 * ຊ່ອງວ່າງ = ບໍ່ໄດ້ສົ່ງມາ.
 *
 * `@IsOptional()` ຂອງ class-validator ຖືວ່າມີແຕ່ `undefined`/`null` ເທົ່ານັ້ນ
 * ທີ່ "ບໍ່ມີ" — ສະຕຣິງວ່າງຍັງຖືວ່າມີ ແລ້ວຕົກ `@Matches` ເປັນ 400. ແຕ່
 * `<input type="date">` ທີ່ຜູ້ໃຊ້ລ້າງອອກ ສົ່ງມາເປັນ `from_date=` ແທ້ໆ, ແລະ
 * `?from_date=` ຄວນໝາຍຄວາມວ່າ "ບໍ່ໄດ້ກອງ" ບໍ່ແມ່ນ "ຮູບແບບວັນທີຜິດ".
 */
const BlankIsAbsent = () => (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value));
/** ຄືກັນ ແຕ່ແປງເປັນຕົວເລກ — ແທນ `@Type(() => Number)` ເພາະ `Number('')` = 0. */
const BlankIsAbsentNumber = () => (0, class_transformer_1.Transform)(({ value }) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
    ? undefined
    : Number(value));
/**
 * The query contract every history endpoint accepts.
 *
 * `from_date` / `to_date` are snake_case because that is what the client
 * specification fixed; the rest of the API is camelCase, so the camelCase
 * spellings are accepted too rather than leaving a trap for whoever writes
 * the next caller.
 *
 * Both bounds are inclusive whole days in the SHOP's timezone — a range of
 * 2026-10-19 → 2026-10-19 returns that day's entries, not an empty set.
 * Omitting them means today, so a history screen never opens by dumping
 * every row the shop has ever recorded.
 */
class HistoryRangeDto {
    from_date;
    to_date;
    /** camelCase alias for from_date. */
    fromDate;
    /** camelCase alias for to_date. */
    toDate;
    page;
    page_size;
    /** camelCase alias for page_size. */
    pageSize;
    /**
     * Return every row in the range instead of one page. For the few screens
     * that genuinely need the whole range at once — a CSV export, a chart —
     * and never the default, because a ledger grows without bound.
     */
    all;
    static _OPENAPI_METADATA_FACTORY() {
        return { from_date: { required: false, type: () => String, pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, to_date: { required: false, type: () => String, pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, fromDate: { required: false, type: () => String, description: "camelCase alias for from_date.", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, toDate: { required: false, type: () => String, description: "camelCase alias for to_date.", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, page: { required: false, type: () => Number, minimum: 1 }, page_size: { required: false, type: () => Number, minimum: 1, maximum: 200 }, pageSize: { required: false, type: () => Number, description: "camelCase alias for page_size.", minimum: 1, maximum: 200 }, all: { required: false, type: () => String, description: "Return every row in the range instead of one page. For the few screens\nthat genuinely need the whole range at once \u2014 a CSV export, a chart \u2014\nand never the default, because a ledger grows without bound." } };
    }
}
exports.HistoryRangeDto = HistoryRangeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-10-19', description: 'ຈາກວັນທີ (ຄ່າເລີ່ມຕົ້ນ = ມື້ນີ້)' }),
    (0, class_validator_1.IsOptional)(),
    BlankIsAbsent(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'from_date ຕ້ອງເປັນຮູບແບບ YYYY-MM-DD' }),
    __metadata("design:type", String)
], HistoryRangeDto.prototype, "from_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-10-19', description: 'ຫາວັນທີ (ຄ່າເລີ່ມຕົ້ນ = ມື້ນີ້)' }),
    (0, class_validator_1.IsOptional)(),
    BlankIsAbsent(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'to_date ຕ້ອງເປັນຮູບແບບ YYYY-MM-DD' }),
    __metadata("design:type", String)
], HistoryRangeDto.prototype, "to_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ deprecated: true }),
    (0, class_validator_1.IsOptional)(),
    BlankIsAbsent(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], HistoryRangeDto.prototype, "fromDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ deprecated: true }),
    (0, class_validator_1.IsOptional)(),
    BlankIsAbsent(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], HistoryRangeDto.prototype, "toDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, class_validator_1.IsOptional)(),
    BlankIsAbsentNumber(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], HistoryRangeDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 200, default: 50 }),
    (0, class_validator_1.IsOptional)(),
    BlankIsAbsentNumber(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], HistoryRangeDto.prototype, "page_size", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ deprecated: true }),
    (0, class_validator_1.IsOptional)(),
    BlankIsAbsentNumber(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], HistoryRangeDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'ເອົາທຸກແຖວໃນຊ່ວງ (ສຳລັບ export)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], HistoryRangeDto.prototype, "all", void 0);
//# sourceMappingURL=history-range.dto.js.map