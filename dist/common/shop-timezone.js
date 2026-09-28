"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOP_TIMEZONE = void 0;
exports.assertShopTimezone = assertShopTimezone;
const common_1 = require("@nestjs/common");
/** The shop trades in Vientiane, so its day boundary is UTC+07:00. */
exports.SHOP_TIMEZONE = 'Asia/Vientiane';
const SHOP_OFFSET_MINUTES = 7 * 60;
/**
 * Refuse to start on a host whose clock would cut the business day in the
 * wrong place.
 *
 * `BusinessDayService.toDateOnly` takes the date from LOCAL time, which is
 * correct only when local time is the shop's. A VPS defaults to UTC, where
 * the day would roll at 07:00 Vientiane — an hour into trading — so a single
 * morning would be split across two BusinessDay rows and the overnight
 * rollover of Stock, AP and AR would fire while the counter was open.
 *
 * Nothing in the data would look wrong; the totals would just be cut in the
 * wrong place. So this fails the boot instead of warning: a server that
 * cannot date a transaction correctly has no business taking one.
 */
function assertShopTimezone() {
    const log = new common_1.Logger('Timezone');
    // getTimezoneOffset returns minutes BEHIND UTC, so UTC+7 is -420.
    const offset = -new Date().getTimezoneOffset();
    if (offset === SHOP_OFFSET_MINUTES) {
        log.log(`${process.env.TZ ?? '(host default)'} — UTC+07:00, business day starts at midnight Vientiane`);
        return;
    }
    const sign = offset < 0 ? '-' : '+';
    const abs = Math.abs(offset);
    const actual = `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
    throw new Error([
        `ເຂດເວລາຂອງເຄື່ອງແມ່ຂ່າຍບໍ່ຖືກຕ້ອງ — ພົບ ${actual}, ຕ້ອງເປັນ UTC+07:00 (${exports.SHOP_TIMEZONE}).`,
        '',
        `Server timezone is ${actual}; the shop's business day needs UTC+07:00.`,
        `Start the API with TZ=${exports.SHOP_TIMEZONE} (or set the host clock to it).`,
        '',
        `  TZ=${exports.SHOP_TIMEZONE} node dist/main.js`,
        `  # or in the unit file / compose env:  TZ=${exports.SHOP_TIMEZONE}`,
    ].join('\n'));
}
//# sourceMappingURL=shop-timezone.js.map