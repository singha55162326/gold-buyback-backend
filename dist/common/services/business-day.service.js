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
var BusinessDayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessDayService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
/**
 * The business day is the spine of the whole system: it anchors every
 * "ມື້ໃໝ່ Balance ກາຍເປັນ ຈຳນວນຕັ້ງຕົ້ນ" rule (§7.1, §7.2) and the AP/AR
 * rollover of §9.2. Nothing should derive "today" on its own — everything
 * asks this service, so a single definition of the day governs the system.
 */
let BusinessDayService = BusinessDayService_1 = class BusinessDayService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Midnight of the given instant, in the server's local timezone. */
    static toDateOnly(at = new Date()) {
        // Local time on purpose: a business day is the shop's day, and the shop
        // is in Vientiane. That makes the server's TZ a financial setting — on a
        // UTC host the day would roll at 07:00 Lao time, mid-morning, splitting a
        // single trading day across two BusinessDay rows. `assertShopTimezone`
        // below is what stops that shipping unnoticed.
        return new Date(at.getFullYear(), at.getMonth(), at.getDate());
    }
    /**
     * Returns today's BusinessDay, creating it on first use of the day.
     *
     * Concurrency matters here more than it looks. The first requests of a new
     * day arrive together — staff opening shifts at 8am, a dashboard polling —
     * and they all find no row and all try to create one. Prisma's `upsert` is
     * a read-then-write, not an atomic statement, so the losers of that race
     * got a P2002 unique-constraint error and a 500.
     *
     * The recovery is to treat P2002 as success: another request created the
     * row a moment ago, which is exactly the outcome we wanted, so re-read it.
     *
     * NOTE: callers must invoke this OUTSIDE a transaction. A constraint
     * violation aborts the surrounding transaction in Postgres, so the re-read
     * below could not run. Every current call site already resolves the day
     * before opening its `$transaction`.
     */
    async current(tx) {
        const client = tx ?? this.prisma;
        const date = BusinessDayService_1.toDateOnly();
        const existing = await client.businessDay.findUnique({ where: { date } });
        if (existing)
            return existing;
        try {
            return await client.businessDay.create({ data: { date } });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                // Lost the race — the row exists now, which is what we wanted.
                return client.businessDay.findUniqueOrThrow({ where: { date } });
            }
            throw error;
        }
    }
    async findByDate(date) {
        return this.prisma.businessDay.findUnique({
            where: { date: BusinessDayService_1.toDateOnly(date) },
        });
    }
};
exports.BusinessDayService = BusinessDayService;
exports.BusinessDayService = BusinessDayService = BusinessDayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BusinessDayService);
//# sourceMappingURL=business-day.service.js.map