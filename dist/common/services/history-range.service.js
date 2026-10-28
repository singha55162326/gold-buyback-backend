"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryRangeService = exports.MAX_EXPORT_ROWS = exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = void 0;
const common_1 = require("@nestjs/common");
const business_day_service_1 = require("./business-day.service");
/** Roles that may only ever see the current business day. */
const SAME_DAY_ONLY = new Set(['VALUER']);
exports.DEFAULT_PAGE_SIZE = 50;
exports.MAX_PAGE_SIZE = 200;
/** Ceiling for `all=true`, so an export cannot pull an unbounded ledger. */
exports.MAX_EXPORT_ROWS = 5000;
/**
 * Resolves the shared `from_date` / `to_date` / `page` contract.
 *
 * Two things are enforced here rather than in each controller, because a
 * rule repeated twenty-five times is a rule that will be wrong in at least
 * one of them:
 *
 *  1. The default range is TODAY. A history screen that opens on the whole
 *     table gets slower every week it runs and is useless on a counter PC.
 *  2. A Valuer is pinned to today regardless of what they send. The frontend
 *     hides the date picker for them, but hiding a control is not a
 *     permission — the API is where it has to hold.
 */
let HistoryRangeService = class HistoryRangeService {
    /** Parse YYYY-MM-DD as a shop-local midnight, never as UTC. */
    parse(value, label) {
        const [y, m, d] = value.split('-').map(Number);
        // `new Date('2026-10-19')` is parsed as UTC and lands on the 18th in
        // Vientiane. Building from parts keeps it local, which is what a
        // business day means here.
        const date = new Date(y, m - 1, d);
        if (Number.isNaN(date.getTime())) {
            throw new common_1.BadRequestException(`${label} ບໍ່ຖືກຕ້ອງ`);
        }
        return date;
    }
    format(date) {
        const p = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
    }
    resolve(query, user) {
        // ຂອບຂອງຊ່ວງເປັນທ່ຽງຄືນທ້ອງຖິ່ນ (ຄືກັນກັບ `parse` ຂ້າງເທິງ); ຖັນວັນທີ
        // ລ້ວນຖືກປະກອບຄືນເປັນ UTC ຢູ່ `dayWindow`.
        const today = business_day_service_1.BusinessDayService.localMidnight();
        const rawFrom = query.from_date ?? query.fromDate;
        const rawTo = query.to_date ?? query.toDate;
        let from = rawFrom ? this.parse(rawFrom, 'from_date') : today;
        let to = rawTo ? this.parse(rawTo, 'to_date') : today;
        if (from.getTime() > to.getTime()) {
            throw new common_1.BadRequestException('from_date ຕ້ອງບໍ່ຫຼັງ to_date');
        }
        // Not negotiable from the client side.
        if (user && SAME_DAY_ONLY.has(user.role)) {
            from = today;
            to = today;
        }
        const until = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
        const all = query.all === 'true' || query.all === '1';
        const pageSize = Math.min(query.page_size ?? query.pageSize ?? exports.DEFAULT_PAGE_SIZE, exports.MAX_PAGE_SIZE);
        const page = query.page ?? 1;
        return {
            from,
            to,
            until,
            skip: all ? 0 : (page - 1) * pageSize,
            take: all ? exports.MAX_EXPORT_ROWS : pageSize,
            page: all ? 1 : page,
            pageSize: all ? exports.MAX_EXPORT_ROWS : pageSize,
            fromDate: this.format(from),
            toDate: this.format(to),
            all,
        };
    }
    /** A Prisma filter for a timestamp column. */
    static window(range) {
        return { gte: range.from, lt: range.until };
    }
    /**
     * A Prisma filter for a DATE-only column such as `businessDate`.
     *
     * Those columns come back as UTC midnight (2026-09-16T00:00:00Z), while
     * `from`/`to` are shop-LOCAL midnights — seven hours earlier as instants.
     * Comparing the two directly shifts every range by a day: asking for the
     * 16th matched nothing, and asking for the 16th–21st matched the 16th.
     *
     * So the bounds are rebuilt in UTC from the same calendar date. Both ends
     * stay inclusive, which is what a date column with no time can mean.
     */
    static dayWindow(range) {
        const utc = (d) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        return { gte: utc(range.from), lte: utc(range.to) };
    }
    page(rows, total, range) {
        return {
            rows,
            page: range.page,
            pageSize: range.pageSize,
            total,
            pageCount: Math.max(1, Math.ceil(total / range.pageSize)),
            fromDate: range.fromDate,
            toDate: range.toDate,
        };
    }
};
exports.HistoryRangeService = HistoryRangeService;
exports.HistoryRangeService = HistoryRangeService = __decorate([
    (0, common_1.Injectable)()
], HistoryRangeService);
//# sourceMappingURL=history-range.service.js.map