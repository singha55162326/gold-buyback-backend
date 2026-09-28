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
exports.ExchangeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
const approval_service_1 = require("../../common/services/approval.service");
const business_day_service_1 = require("../../common/services/business-day.service");
const stock_ledger_service_1 = require("../../common/services/stock-ledger.service");
const notifications_service_1 = require("../notifications/notifications.service");
const pricing_context_service_1 = require("../pricing/pricing-context.service");
const D = (value) => new client_1.Prisma.Decimal(value.toFixed());
const KIND_BY_CODE = {
    GOOD: 'GOOD',
    HUMP: 'HUMP',
    BAR: 'BAR',
    BOILED: 'BOILED',
};
/**
 * TOR §5.2 — ລາຍການປ່ຽນເປັນເງິນ (Gold Exchange & Trade-in).
 *
 * The rule that governs this module is the zero-balance check: every gram the
 * customer brings in must leave as either new gold or remaining old gold.
 * It is evaluated in the domain layer and enforced HERE as well as in the
 * browser, so a bypassed UI still cannot let gold leak out of the shop.
 */
let ExchangeService = class ExchangeService {
    prisma;
    audit;
    approval;
    businessDay;
    stockLedger;
    notifications;
    pricingContext;
    constructor(prisma, audit, approval, businessDay, stockLedger, notifications, pricingContext) {
        this.prisma = prisma;
        this.audit = audit;
        this.approval = approval;
        this.businessDay = businessDay;
        this.stockLedger = stockLedger;
        this.notifications = notifications;
        this.pricingContext = pricingContext;
    }
    /**
     * Price each old line at ລາຄາຊື້ຄືນໜ້າຮ້ານ and assemble the domain input.
     * Fees come from the ຄ່າປ່ຽນ tables, not from the client, so a tampered
     * request cannot invent a discount.
     */
    async buildInput(dto, context) {
        const goldTypeIds = [...new Set(dto.oldLines.map((l) => l.goldTypeId))];
        const goldTypes = await this.prisma.goldType.findMany({
            where: { id: { in: goldTypeIds }, deletedAt: null },
        });
        const typeById = new Map(goldTypes.map((t) => [t.id, t]));
        const priceOldLine = (line) => {
            const goldType = typeById.get(line.goldTypeId);
            if (!goldType)
                throw new common_1.NotFoundException('ບໍ່ພົບປະເພດຄຳ');
            const kind = KIND_BY_CODE[goldType.code];
            if (!kind || kind === 'BOILED') {
                // ຄຳຕົ້ມ has no standard weight to exchange against.
                throw new common_1.BadRequestException(`ປະເພດຄຳ "${goldType.nameLo}" ບໍ່ຮອງຮັບການປ່ຽນເປັນເງິນ`);
            }
            const { price } = (0, domain_1.shopBuybackPriceKpv)(kind, line.weightG, context.source, context.table);
            return price.mul((0, domain_1.dec)(line.quantity));
        };
        // ຄ່າຫຍຸບ / ຄ່າປ່ຽນຄຳແທ່ງ are looked up by the new piece's weight.
        const skuIds = [...new Set(dto.newLines.map((l) => l.goldSkuId))];
        const skus = await this.prisma.goldSku.findMany({
            where: { id: { in: skuIds }, deletedAt: null },
        });
        const skuById = new Map(skus.map((s) => [s.id, s]));
        const [jewelryFees, barFees] = await Promise.all([
            this.prisma.jewelryConversionFee.findMany({
                orderBy: { effectiveAt: 'desc' },
                include: { tier: true },
            }),
            this.prisma.barConversionFee.findMany({ orderBy: { effectiveAt: 'desc' } }),
        ]);
        const feeByWeight = new Map();
        for (const fee of jewelryFees) {
            const key = fee.weightG.toFixed();
            if (feeByWeight.has(key))
                continue; // newest wins
            feeByWeight.set(key, {
                good: (0, domain_1.dec)(fee.feeGoodShape.toFixed()),
                damaged: (0, domain_1.dec)(fee.feeDamagedShape.toFixed()),
            });
        }
        const barFeeByWeight = new Map();
        for (const fee of barFees) {
            const key = fee.weightG.toFixed();
            if (barFeeByWeight.has(key))
                continue;
            barFeeByWeight.set(key, (0, domain_1.dec)(fee.barToJewelry.toFixed()));
        }
        return {
            txnType: dto.txnType,
            shapeCondition: dto.shapeCondition,
            softGoldFeePerGram: context.softGoldFeePerGram,
            oldLines: dto.oldLines.map((line) => ({
                weightG: line.weightG,
                quantity: line.quantity,
                standardWeightG: line.standardWeightG,
                shopBuybackPrice: priceOldLine(line),
            })),
            newLines: dto.newLines.map((line) => {
                const sku = skuById.get(line.goldSkuId);
                if (!sku)
                    throw new common_1.NotFoundException('ບໍ່ພົບ SKU ຂອງຄຳໃໝ່');
                const key = (0, domain_1.dec)(line.weightG).toFixed();
                const fee = feeByWeight.get(key);
                return {
                    weightG: line.weightG,
                    quantity: line.quantity,
                    humpFee: fee
                        ? (dto.shapeCondition === 'GOOD' ? fee.good : fee.damaged)
                        : (0, domain_1.dec)(0),
                    barConvertFee: barFeeByWeight.get(key) ?? (0, domain_1.dec)(0),
                    patternFee: line.patternFee ?? 0,
                };
            }),
            remainingLines: dto.remainingLines.map((line) => ({
                weightG: line.weightG,
                quantity: line.quantity,
                shopBuybackPrice: (0, domain_1.dec)(0),
            })),
        };
    }
    /** Calculate without writing — backs the live form and the Save gate. */
    async preview(dto) {
        const context = await this.pricingContext.load();
        const input = await this.buildInput(dto, context);
        const totals = (0, domain_1.calculateExchange)(input);
        const validation = (0, domain_1.validateExchangeBalance)(totals);
        return {
            standardOldWeightG: totals.standardOldWeightG.toFixed(),
            actualOldWeightG: totals.actualOldWeightG.toFixed(),
            totalNewWeightG: totals.totalNewWeightG.toFixed(),
            totalRemainingWeightG: totals.totalRemainingWeightG.toFixed(),
            softGoldFee: totals.softGoldFee.toFixed(),
            humpFee: totals.humpFee.toFixed(),
            barConvertFee: totals.barConvertFee.toFixed(),
            patternFee: totals.patternFee.toFixed(),
            shopBuybackPrice: totals.shopBuybackPrice.toFixed(),
            totalPayable: totals.totalPayable.toFixed(),
            isBalanced: validation.isBalanced,
            difference: validation.difference.toFixed(),
            messageLo: validation.messageLo,
        };
    }
    async create(dto, user, shiftId) {
        const context = await this.pricingContext.load();
        const input = await this.buildInput(dto, context);
        const totals = (0, domain_1.calculateExchange)(input);
        const validation = (0, domain_1.validateExchangeBalance)(totals);
        // ⚠ TOR §5.2 CRITICAL rule — the save gate.
        if (!validation.isBalanced) {
            throw new common_1.BadRequestException(validation.messageLo ?? 'ນ້ຳໜັກບໍ່ສົມດຸນ');
        }
        // §5.2 now has the same Cash/Bank payment step as §5.1.
        const paymentLines = (dto.payments ?? []).map((line) => this.resolvePayment(line, totals.totalPayable, context.rates));
        const paidLak = paymentLines.reduce((sum, line) => sum.plus(line.amountLak), (0, domain_1.dec)(0));
        const changeLak = paymentLines.reduce((sum, line) => sum.plus(line.changeLak), (0, domain_1.dec)(0));
        const paid = paidLak.minus(changeLak);
        const customer = await this.prisma.customer.upsert({
            where: { phone: dto.phone },
            update: {},
            create: { phone: dto.phone },
        });
        return this.prisma.$transaction(async (tx) => {
            const exchange = await tx.goldExchange.create({
                data: {
                    code: await this.nextCode(tx),
                    shiftId,
                    customerId: customer.id,
                    snapshotId: context.snapshot.id,
                    txnType: dto.txnType,
                    shapeCondition: dto.shapeCondition,
                    softGoldFee: D(totals.softGoldFee),
                    totalPayable: D(totals.totalPayable),
                    paidAmount: D(paid),
                    outstandingAmount: D(totals.totalPayable.minus(paid)),
                    status: 'PENDING',
                    createdById: user.id,
                    payments: {
                        create: paymentLines.map((line) => ({
                            method: line.method,
                            bankAccountId: line.bankAccountId ?? null,
                            currency: line.currency,
                            rate: D(line.rate),
                            amount: D(line.amount),
                            amountLak: D(line.amountLak),
                            changeLak: D(line.changeLak),
                            createdById: user.id,
                        })),
                    },
                    oldLines: {
                        create: dto.oldLines.map((line, index) => ({
                            goldTypeId: line.goldTypeId,
                            goldItemId: line.goldItemId ?? null,
                            weightG: D((0, domain_1.dec)(line.weightG)),
                            quantity: line.quantity,
                            standardWeightG: D((0, domain_1.dec)(line.standardWeightG)),
                            shopBuybackPrice: D((0, domain_1.dec)(input.oldLines[index].shopBuybackPrice)),
                        })),
                    },
                    newLines: {
                        create: dto.newLines.map((line, index) => ({
                            goldSkuId: line.goldSkuId,
                            cabinetId: line.cabinetId ?? null,
                            weightG: D((0, domain_1.dec)(line.weightG)),
                            quantity: line.quantity,
                            humpFee: D((0, domain_1.dec)(input.newLines[index].humpFee)),
                            barConvertFee: D((0, domain_1.dec)(input.newLines[index].barConvertFee)),
                            patternFee: D((0, domain_1.dec)(input.newLines[index].patternFee)),
                        })),
                    },
                    remainingLines: {
                        create: dto.remainingLines.map((line) => ({
                            weightG: D((0, domain_1.dec)(line.weightG)),
                            quantity: line.quantity,
                            shopBuybackPrice: D((0, domain_1.dec)(0)),
                        })),
                    },
                },
                include: { oldLines: true, newLines: true, remainingLines: true, payments: true },
            });
            await this.audit.record({
                actorId: user.id,
                action: 'CREATE',
                entity: 'GoldExchange',
                entityId: exchange.id,
                after: {
                    code: exchange.code,
                    totalPayable: exchange.totalPayable.toFixed(),
                    standardOldWeightG: totals.standardOldWeightG.toFixed(),
                },
                summary: `ສ້າງລາຍການປ່ຽນເປັນເງິນ ${exchange.code}`,
            }, tx);
            await this.notifications.notify({
                kind: 'EXCHANGE_CREATED',
                recipientRole: 'PAYMENT',
                title: 'ມີລາຍການປ່ຽນເປັນເງິນລໍຖ້າອະນຸມັດ',
                body: `${exchange.code} — ${totals.totalPayable.toFixed(0)} LAK`,
                refType: 'GoldExchange',
                refId: exchange.id,
            }, tx);
            return exchange;
        });
    }
    /** payment ກົດ Approve / Reject. */
    async review(id, dto, user) {
        const exchange = await this.prisma.goldExchange.findFirst({
            where: { id, deletedAt: null },
            include: { oldLines: true, newLines: true, payments: true },
        });
        if (!exchange)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການ');
        const next = dto.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        this.approval.assertTransition(exchange.status, next);
        const day = await this.businessDay.current();
        return this.prisma.$transaction(async (tx) => {
            if (dto.decision === 'APPROVED') {
                // Money leaves the shop on the recorded legs.
                for (const payment of exchange.payments) {
                    if (payment.method === 'CASH') {
                        await tx.cashTransaction.create({
                            data: {
                                businessDayId: day.id,
                                shiftId: exchange.shiftId,
                                type: 'OUT',
                                currency: payment.currency,
                                amount: payment.amount,
                                refType: 'GoldExchange',
                                refId: exchange.id,
                                note: `ຈ່າຍປ່ຽນເປັນເງິນ ${exchange.code}`,
                                createdById: user.id,
                            },
                        });
                    }
                    else if (payment.bankAccountId) {
                        await tx.bankTransaction.create({
                            data: {
                                businessDayId: day.id,
                                bankAccountId: payment.bankAccountId,
                                type: 'WITHDRAW',
                                currency: payment.currency,
                                amount: payment.amount,
                                refType: 'GoldExchange',
                                refId: exchange.id,
                                note: `ຈ່າຍປ່ຽນເປັນເງິນ ${exchange.code}`,
                                createdById: user.id,
                            },
                        });
                    }
                }
                // Old gold enters Stock (OLD) at what the shop allowed for it; the
                // new pieces leave Stock (NEW) at WAC.
                for (const line of exchange.oldLines) {
                    await this.stockLedger.postOld(tx, {
                        goldTypeId: line.goldTypeId,
                        businessDayId: day.id,
                        goldInG: (0, domain_1.dec)(line.weightG.toFixed()).mul(line.quantity),
                        priceIn: (0, domain_1.dec)(line.shopBuybackPrice.toFixed()),
                        partnerLabel: 'Cashier',
                        typeLabel: `Exchange ${exchange.code}`,
                        createdById: user.id,
                    });
                }
                const wac = await this.stockLedger.currentWac(tx);
                for (const line of exchange.newLines) {
                    const goldG = (0, domain_1.dec)(line.weightG.toFixed()).mul(line.quantity);
                    await this.stockLedger.postNew(tx, {
                        businessDayId: day.id,
                        goldOutG: goldG,
                        priceOut: goldG.mul(wac.pricePerG),
                        partnerLabel: 'Cashier',
                        typeLabel: `Exchange ${exchange.code}`,
                        createdById: user.id,
                    });
                }
            }
            const updated = await tx.goldExchange.update({
                where: { id },
                data: {
                    status: next,
                    approvedById: user.id,
                    approvedAt: new Date(),
                    rejectReason: dto.decision === 'REJECTED' ? (dto.reason ?? null) : null,
                },
            });
            await this.audit.record({
                actorId: user.id,
                action: dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
                entity: 'GoldExchange',
                entityId: id,
                before: { status: exchange.status },
                after: { status: next },
            }, tx);
            await this.notifications.notify({
                kind: 'APPROVAL_RESULT',
                recipientUserId: exchange.createdById,
                title: dto.decision === 'APPROVED'
                    ? `ລາຍການປ່ຽນເປັນເງິນ ${exchange.code} ຖືກອະນຸມັດ`
                    : `ລາຍການປ່ຽນເປັນເງິນ ${exchange.code} ຖືກປະຕິເສດ`,
                body: dto.reason ?? undefined,
                refType: 'GoldExchange',
                refId: id,
            }, tx);
            return updated;
        });
    }
    async list(status) {
        const rows = await this.prisma.goldExchange.findMany({
            where: { deletedAt: null, ...(status ? { status } : {}) },
            include: {
                customer: true,
                oldLines: { include: { goldType: true } },
                newLines: { include: { goldSku: true } },
                remainingLines: true,
                payments: { include: { bankAccount: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        // TOR History tables carry UPDATED BY.
        return this.audit.withActorNames(rows);
    }
    /**
     * One payment leg, converted to LAK at the BUYBACK rate (the shop is paying
     * out) with the §5.2 rules:
     *   CHANGE (LAK ONLY) = (Amount × Rate) − ລວມເງິນທີ່ຕ້ອງຈ່າຍ (LAK)
     *   Amount LAK ຕ້ອງ ≤ TOTAL(LAK)
     */
    resolvePayment(line, totalPayable, rates) {
        if (line.method === 'BANK' && !line.bankAccountId) {
            throw new common_1.BadRequestException('ກະລຸນາເລືອກທະນາຄານ');
        }
        const amount = (0, domain_1.dec)(line.amount);
        if (!amount.isFinite() || amount.lte(0)) {
            throw new common_1.BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
        }
        if (line.currency === 'LAK' && amount.gt(totalPayable)) {
            throw new common_1.BadRequestException(`ຈຳນວນເງິນ LAK (${amount.toFixed(0)}) ຕ້ອງບໍ່ເກີນລວມເງິນທີ່ຕ້ອງຈ່າຍ (${totalPayable.toFixed(0)})`);
        }
        const rate = pricing_context_service_1.PricingContextService.rateFor(rates, line.currency, 'buyback');
        const amountLak = amount.mul(rate);
        const changeLak = amountLak.gt(totalPayable) ? amountLak.minus(totalPayable) : (0, domain_1.dec)(0);
        return { ...line, rate, amount, amountLak, changeLak };
    }
    async nextCode(tx) {
        const now = new Date();
        const prefix = `EX-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const count = await tx.goldExchange.count({ where: { code: { startsWith: prefix } } });
        return `${prefix}-${String(count + 1).padStart(3, '0')}`;
    }
};
exports.ExchangeService = ExchangeService;
exports.ExchangeService = ExchangeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        approval_service_1.ApprovalService,
        business_day_service_1.BusinessDayService,
        stock_ledger_service_1.StockLedgerService,
        notifications_service_1.NotificationsService,
        pricing_context_service_1.PricingContextService])
], ExchangeService);
//# sourceMappingURL=exchange.service.js.map