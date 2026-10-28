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
exports.AdvanceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const business_day_service_1 = require("./business-day.service");
const audit_service_1 = require("./audit.service");
const history_range_service_1 = require("./history-range.service");
const D = (value) => new client_1.Prisma.Decimal(value.toFixed());
const toDec = (value) => (0, domain_1.dec)(value?.toFixed() ?? 0);
/**
 * Module Advace (TOR §7).
 *
 * ເງິນມັດຈໍາ Order ຮັບລ່ວງໜ້າ has its own ledger in the updated TOR, separate
 * from AP (Cash) — which §9.2 now scopes to ຄ່າແຮງຊ່າງຄ້າງຈ່າຍ alone.
 *
 *   Order ສຳເລັດ           -> +Advance
 *   ຢືນຢັນລູກຄ້າຮັບເຄື່ອງ  -> −Advance
 *
 * COH Cash subtracts the net, so money the shop is holding against an
 * undelivered order never reads as its own.
 */
let AdvanceService = class AdvanceService {
    prisma;
    range;
    audit;
    constructor(prisma, range, audit) {
        this.prisma = prisma;
        this.range = range;
        this.audit = audit;
    }
    async post(tx, input) {
        if (input.amount.lte(0) && !input.allowZero)
            return null;
        const businessDate = business_day_service_1.BusinessDayService.toDateOnly();
        const isIn = input.direction === 'IN';
        const previous = await tx.advanceLedger.findFirst({
            where: { currency: input.currency, deletedAt: null },
            orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
        });
        const lastToday = await tx.advanceLedger.findFirst({
            where: { currency: input.currency, businessDate },
            orderBy: { sequence: 'desc' },
        });
        const balance = isIn
            ? toDec(previous?.balance).plus(input.amount)
            : toDec(previous?.balance).minus(input.amount);
        return tx.advanceLedger.create({
            data: {
                orderId: input.orderId,
                businessDate,
                currency: input.currency,
                amountIn: D(isIn ? input.amount : (0, domain_1.dec)(0)),
                amountOut: D(isIn ? (0, domain_1.dec)(0) : input.amount),
                balance: D(balance),
                method: input.method ?? null,
                bankAccountId: input.bankAccountId ?? null,
                sequence: (lastToday?.sequence ?? 0) + 1,
                note: input.note ?? null,
                createdById: input.createdById,
            },
        });
    }
    /** ຍອດ Advance ສຸດທິ per currency — what COH subtracts. */
    async netByCurrency(client = this.prisma, asOf) {
        const rows = await client.advanceLedger.groupBy({
            by: ['currency'],
            where: { deletedAt: null, ...(asOf ? { businessDate: { lte: asOf } } : {}) },
            _sum: { amountIn: true, amountOut: true },
        });
        const result = { LAK: (0, domain_1.dec)(0), THB: (0, domain_1.dec)(0), USD: (0, domain_1.dec)(0) };
        for (const row of rows) {
            result[row.currency] = (0, domain_1.netAdvance)(toDec(row._sum.amountIn), toDec(row._sum.amountOut));
        }
        return result;
    }
    /** ໜ້າຕ່າງ Module Advace: ລວມຍອດເງິນ Advace, ລວມຈຳນວນບິນ (TOR §7). */
    async summary() {
        const [net, openOrders] = await Promise.all([
            this.netByCurrency(),
            this.prisma.order.count({
                where: { deletedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
            }),
        ]);
        return {
            totals: ['LAK', 'THB', 'USD'].map((currency) => ({
                currency,
                net: net[currency].toFixed(),
            })),
            billCount: openOrders,
        };
    }
    /**
     * History for the Advance module, keyed to the order it belongs to.
     *
     * ຄ່າເລີ່ມຕົ້ນ = ມື້ນີ້ ແລະ ກວ້າງອອກໄດ້ຕາມສິດ. ກອງຕາມ businessDate (ເປັນ
     * ຖັນວັນທີລ້ວນ) ບໍ່ແມ່ນ createdAt, ເພາະລາຍການຂອງມື້ການຄ້າໜຶ່ງອາດຖືກ
     * ບັນທຶກຫຼັງທ່ຽງຄືນ.
     */
    async history(query, user) {
        const range = this.range.resolve(query, user);
        const where = {
            deletedAt: null,
            businessDate: history_range_service_1.HistoryRangeService.dayWindow(range),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.advanceLedger.findMany({
                where,
                include: {
                    // The View detail in §7 needs the full order context.
                    order: { include: { customer: true, goldItem: true, supplier: true } },
                    bankAccount: true,
                },
                orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
                skip: range.skip,
                take: range.take,
            }),
            this.prisma.advanceLedger.count({ where }),
        ]);
        // ຜູ້ບັນທຶກ — ລູກຄ້າຂໍໃຫ້ເຫັນທຸກ Module ທີ່ມີການລົງລາຍການ.
        const withActors = await this.audit.withCreatorNames(rows);
        return this.range.page(withActors.map((row) => {
            /*
             * ຍອດເງິນສຸດທິ = ຍອດເງິນທີ່ໄດ້ຮັບ − ຍອດຄົງເຫຼືອຮັບ − ຍອດເງິນຕັດຊຳລະ
             * ຕາມທີ່ລູກຄ້າກຳນົດ. ຄຳນວນຢູ່ server ເພື່ອບໍ່ໃຫ້ສອງໜ້າຈໍຄຳນວນຄົນລະແບບ.
             */
            const received = toDec(row.amountIn);
            const outstanding = toDec(row.order.balanceAmount);
            const settled = toDec(row.amountOut);
            return {
                ...row,
                outstandingAmount: outstanding.toFixed(),
                netAmount: received.minus(outstanding).minus(settled).toFixed(),
            };
        }), total, range);
    }
};
exports.AdvanceService = AdvanceService;
exports.AdvanceService = AdvanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        history_range_service_1.HistoryRangeService,
        audit_service_1.AuditService])
], AdvanceService);
//# sourceMappingURL=advance.service.js.map