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
        const businessDate = input.businessDate ?? business_day_service_1.BusinessDayService.toDateOnly();
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
    /**
     * ລົບລ້າງຍອດ Advance ຄົງເຫຼືອຂອງ Order ແຍກຕາມສະກຸນເງິນທີ່ຮັບຈິງ.
     *
     * ໃຊ້ເມື່ອ Order ສຳເລັດ (COMPLETED) ຫຼື ຍົກເລີກ (CANCELLED) ເພື່ອບໍ່ໃຫ້ຍອດ
     * THB / USD ຄ້າງບວກ ຫຼື LAK ຕິດລົບຈາກການຕັດຂ້າມສະກຸນເງິນ.
     */
    async settleOrderAdvance(tx, order, createdById, note, businessDate) {
        const groups = await tx.advanceLedger.groupBy({
            by: ['currency'],
            where: { orderId: order.id, deletedAt: null },
            _sum: { amountIn: true, amountOut: true },
        });
        const settledEntries = [];
        for (const g of groups) {
            const net = toDec(g._sum.amountIn).minus(toDec(g._sum.amountOut));
            if (net.gt(0)) {
                const entry = await this.post(tx, {
                    orderId: order.id,
                    currency: g.currency,
                    amount: net,
                    direction: 'OUT',
                    businessDate,
                    note: note ?? `ຢືນຢັນລູກຄ້າຮັບເຄື່ອງ ${order.code} — ລົບລ້າງພັນທະມັດຈໍາ`,
                    createdById,
                });
                if (entry)
                    settledEntries.push(entry);
            }
        }
        return settledEntries;
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
     *
     * ລວມທັງ Order ທີ່ຍັງບໍ່ທັນປິດ ຫຼື ຍັງມີຍອດ Advance ຄ້າງຢູ່ ເພື່ອບໍ່ໃຫ້ບິນຄ້າງ
     * ຂ້າມມື້ຫາຍໄປຈາກໜ້າຈໍ ແລະ ດຶງທຸກຂາການເຄື່ອນໄຫວຂອງ Order ທີ່ເຂົ້າເງື່ອນໄຂ
     * ເພື່ອໃຫ້ການລວມຍອດຕາມ Order ຄົບຖ້ວນ.
     */
    async history(query, user) {
        const range = this.range.resolve(query, user);
        const dayWin = history_range_service_1.HistoryRangeService.dayWindow(range);
        const [advGroups, rangeOrders] = await Promise.all([
            this.prisma.advanceLedger.groupBy({
                by: ['orderId', 'currency'],
                where: { deletedAt: null },
                _sum: { amountIn: true, amountOut: true },
            }),
            this.prisma.advanceLedger.findMany({
                where: { deletedAt: null, businessDate: dayWin },
                select: { orderId: true },
                distinct: ['orderId'],
            }),
        ]);
        const unsettledOrderIds = advGroups
            .filter((g) => toDec(g._sum.amountIn).gt(toDec(g._sum.amountOut)))
            .map((g) => g.orderId);
        const activeOrderIds = Array.from(new Set([...rangeOrders.map((r) => r.orderId), ...unsettledOrderIds]));
        const where = {
            deletedAt: null,
            order: { deletedAt: null },
            OR: [
                { businessDate: dayWin },
                { order: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } },
                ...(activeOrderIds.length > 0 ? [{ orderId: { in: activeOrderIds } }] : []),
            ],
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.advanceLedger.findMany({
                where,
                include: {
                    // The View detail in §7 needs the full order context.
                    order: {
                        include: {
                            customer: true,
                            goldItem: true,
                            supplier: true,
                            receipts: true,
                            lines: { include: { goldItem: true }, orderBy: { sortOrder: 'asc' } },
                        },
                    },
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
            const received = toDec(row.amountIn);
            const outstanding = toDec(row.order.balanceAmount);
            const settled = toDec(row.amountOut);
            // คำนวณ Order Currency และ Balance บน Server เพื่อความแม่นยำทางบัญชี
            let cur = row.order.currency || 'LAK';
            let totalInCur = row.order.originalTotalAmount ? toDec(row.order.originalTotalAmount) : null;
            const noteText = row.order.note ?? row.note ?? '';
            const match = noteText.match(/\[TOTAL:\s*([\d,.]+)\s*(THB|USD|LAK)\]/);
            if (cur === 'LAK' && match) {
                cur = match[2];
                totalInCur = (0, domain_1.dec)(match[1].replace(/,/g, ''));
            }
            if (!totalInCur || cur === 'LAK') {
                totalInCur = toDec(row.order.totalAmount);
            }
            let balanceInCur = (0, domain_1.dec)(0);
            if (outstanding.gt(0)) {
                if (cur === 'LAK') {
                    balanceInCur = outstanding;
                }
                else {
                    const nonRefundReceipts = (row.order.receipts ?? []).filter((r) => !r.isRefund);
                    const allSameCur = nonRefundReceipts.length > 0 && nonRefundReceipts.every((r) => r.currency === cur);
                    if (allSameCur) {
                        const rcvdInCur = nonRefundReceipts.reduce((s, r) => s.plus(toDec(r.amount)), (0, domain_1.dec)(0));
                        const diff = totalInCur.minus(rcvdInCur);
                        balanceInCur = diff.gt(0) ? diff : (0, domain_1.dec)(0);
                    }
                    else {
                        const exRate = toDec(row.order.exchangeRate);
                        if (exRate.gt(0)) {
                            balanceInCur = outstanding.div(exRate).toDecimalPlaces(2);
                        }
                        else {
                            const rcvdInCur = nonRefundReceipts
                                .filter((r) => r.currency === cur)
                                .reduce((s, r) => s.plus(toDec(r.amount)), (0, domain_1.dec)(0));
                            const effectiveRcvd = rcvdInCur.gt(0)
                                ? rcvdInCur
                                : (row.currency === cur ? received : (0, domain_1.dec)(0));
                            const diff = totalInCur.minus(effectiveRcvd);
                            balanceInCur = diff.gt(0) ? diff : (0, domain_1.dec)(0);
                        }
                    }
                }
            }
            const cleanNote = noteText
                .replace(/\[TOTAL:\s*[\d,.]+\s*(THB|USD|LAK)\]\s*/g, '')
                .trim();
            return {
                ...row,
                outstandingAmount: (cur === row.currency ? balanceInCur : outstanding).toFixed(),
                netAmount: received.minus(settled).toFixed(),
                orderSummary: {
                    currency: cur,
                    totalAmount: totalInCur.toFixed(),
                    balanceAmount: balanceInCur.toFixed(),
                    isBalanceZero: outstanding.lte(0),
                    cleanNote,
                },
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