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
exports.FinanceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
const history_range_service_1 = require("../../common/services/history-range.service");
const code_generator_service_1 = require("../../common/services/code-generator.service");
const business_day_service_1 = require("../../common/services/business-day.service");
const apar_posting_service_1 = require("../../common/services/apar-posting.service");
const cash_service_1 = require("../cash/cash.service");
const D = (value) => new client_1.Prisma.Decimal(value.toFixed());
const toDec = (value) => (0, domain_1.dec)(value?.toFixed() ?? 0);
const CURRENCIES = ['LAK', 'THB', 'USD'];
/**
 * ບັນຊີທີ່ລາຍງານ COH / ຄວາມຮັ່ງມີ ຊອກດ້ວຍ code (`ledger.service.ts`) —
 * ຊື່ແກ້ໄດ້ ແຕ່ລຶບ ຫຼື ປິດບໍ່ໄດ້, ບໍ່ດັ່ງນັ້ນເງິນຝາກຂອງບັນຊີນັ້ນຫຼຸດອອກຈາກ
 * ລາຍງານໄປເລີຍ ໂດຍຍອດຍັງຢູ່ໃນຖານຂໍ້ມູນ.
 */
const SYSTEM_BANK_CODES = ['BCEL', 'LDB', 'OTHER_BANK'];
/**
 * The modules the updated TOR added to §3.7 and §9:
 *
 *   ລາຍການ Bank            — banks the shop maintains itself
 *   ເພີ້ມລາຍການຮັບຈ່າຍ      — income/expense categories
 *   ຈັດການລາຍຮັບລາຍຈ່າຍ    — the postings themselves
 *   ຝາກສິນຄ້າ              — customer gold held for safekeeping
 *   ລາຍການ AP-AR (Cash)    — AP/AR categories
 *   AP (Cash) / AR (Cash)  — manual entries with a Supplier, and settlement
 */
let FinanceService = class FinanceService {
    prisma;
    audit;
    businessDay;
    apar;
    range;
    codes;
    cash;
    constructor(prisma, audit, businessDay, apar, range, codes, cash) {
        this.prisma = prisma;
        this.audit = audit;
        this.businessDay = businessDay;
        this.apar = apar;
        this.range = range;
        this.codes = codes;
        this.cash = cash;
    }
    /* ---------------------------------------------------------------- *
     * §3.7 — Module ລາຍການ Bank
     * ---------------------------------------------------------------- */
    /**
     * ຊື່ຊ້ຳໃນລາຍການເລືອກ = ເລືອກຜິດແຖວ ແລ້ວຍອດໄປຜິດບ່ອນ.
     *
     * `scope` ຕ່າງກັນຕາມຕາຕະລາງ: ສ່ວນໃຫຍ່ລຶບແບບ soft (`deletedAt`) ແຕ່ບັນຊີ
     * ທະນາຄານບໍ່ມີຖັນນັ້ນ ຈຶ່ງກວດທຸກແຖວ.
     */
    async assertNameFree(model, nameLo, labelLo, scope = { deletedAt: null }) {
        const existing = await model.findFirst({
            where: { nameLo: { equals: nameLo.trim(), mode: 'insensitive' }, ...scope },
            select: { id: true },
        });
        if (existing)
            throw new common_1.ConflictException(`${labelLo} "${nameLo.trim()}" ມີຢູ່ແລ້ວ`);
    }
    async createBankAccount(dto, user) {
        await this.assertNameFree(this.prisma.bankAccount, dto.nameLo, 'ບັນຊີທະນາຄານ', {});
        const max = await this.prisma.bankAccount.aggregate({ _max: { sortOrder: true } });
        const code = await this.codes.nextFor('BANK', this.prisma.bankAccount);
        const created = await this.prisma.bankAccount.create({
            data: {
                code,
                nameLo: dto.nameLo.trim(),
                sortOrder: (max._max.sortOrder ?? 0) + 1,
            },
        });
        await this.audit.record({
            actorId: user.id, action: 'CREATE', entity: 'BankAccount', entityId: created.id,
            after: created, summary: `ເພີ່ມທະນາຄານ ${created.nameLo}`,
        });
        return created;
    }
    /* ---------------------------------------------------------------- *
     * §3.7 — ເພີ້ມລາຍການຮັບຈ່າຍ / ຈັດການລາຍຮັບລາຍຈ່າຍ
     * ---------------------------------------------------------------- */
    async listIncomeExpenseCategories(kind, withActor = false) {
        const rows = await this.prisma.incomeExpenseCategory.findMany({
            where: { deletedAt: null, isActive: true, ...(kind ? { kind } : {}) },
            orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
        });
        return withActor
            ? this.audit.withCreatorsFromAudit('IncomeExpenseCategory', rows)
            : rows;
    }
    async createIncomeExpenseCategory(dto, user) {
        const max = await this.prisma.incomeExpenseCategory.aggregate({ _max: { sortOrder: true } });
        await this.assertNameFree(this.prisma.incomeExpenseCategory, dto.nameLo, 'ໝວດຮັບຈ່າຍ');
        const code = await this.codes.nextFor('INCOME_EXPENSE_CATEGORY', this.prisma.incomeExpenseCategory);
        const created = await this.prisma.incomeExpenseCategory.create({
            data: {
                code,
                nameLo: dto.nameLo.trim(),
                kind: dto.kind,
                sortOrder: (max._max.sortOrder ?? 0) + 1,
            },
        });
        await this.audit.record({
            actorId: user.id, action: 'CREATE', entity: 'IncomeExpenseCategory', entityId: created.id,
            after: created, summary: `ເພີ່ມລາຍການ${dto.kind === 'INCOME' ? 'ຮັບ' : 'ຈ່າຍ'} ${created.nameLo}`,
        });
        return created;
    }
    /**
     * Post a ລາຍຮັບ / ລາຍຈ່າຍ.
     *
     * It writes through to CashTransaction or BankTransaction rather than
     * keeping its own balance, so Module Cash and Module Bank remain the single
     * source of truth and this table stays a pure classification layer.
     */
    async createIncomeExpense(dto, user) {
        // A single expense may be settled part in cash and part by transfer, in
        // more than one currency; each leg is its own row so Module Cash and
        // Module Bank each show what actually moved through them.
        const legs = dto.payments?.length
            ? dto.payments
            : dto.method && dto.currency && dto.amount
                ? [{ method: dto.method, bankAccountId: dto.bankAccountId, currency: dto.currency, amount: dto.amount }]
                : [];
        if (legs.length === 0) {
            throw new common_1.BadRequestException('ຕ້ອງມີລາຍການຈ່າຍ/ຮັບຢ່າງໜ້ອຍ 1 ລາຍການ');
        }
        const resolved = legs.map((leg) => {
            const amount = (0, domain_1.dec)(leg.amount);
            if (!amount.isFinite() || amount.lte(0)) {
                throw new common_1.BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
            }
            if (leg.method === 'BANK' && !leg.bankAccountId) {
                throw new common_1.BadRequestException('ກະລຸນາເລືອກທະນາຄານ');
            }
            return { ...leg, amount };
        });
        const category = await this.prisma.incomeExpenseCategory.findFirst({
            where: { id: dto.categoryId, deletedAt: null },
        });
        if (!category)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການຮັບຈ່າຍ');
        const day = await this.businessDay.current();
        const isIncome = category.kind === 'INCOME';
        if (category.kind === 'EXPENSE') {
            const [cashBalances, bankBalances] = await Promise.all([
                this.cash.cashBalances(),
                this.cash.bankBalances(),
            ]);
            const cashRequested = new Map();
            const bankRequested = new Map();
            for (const leg of resolved) {
                if (leg.method === 'CASH') {
                    const prev = cashRequested.get(leg.currency) ?? (0, domain_1.dec)(0);
                    cashRequested.set(leg.currency, prev.plus(leg.amount));
                }
                else if (leg.method === 'BANK' && leg.bankAccountId) {
                    const key = `${leg.bankAccountId}:${leg.currency}`;
                    const prev = bankRequested.get(key) ?? (0, domain_1.dec)(0);
                    bankRequested.set(key, prev.plus(leg.amount));
                }
            }
            for (const [currency, reqAmount] of cashRequested) {
                const bal = cashBalances.find((b) => b.currency === currency);
                const currentBal = (0, domain_1.dec)(bal?.balance ?? '0');
                if (reqAmount.gt(currentBal)) {
                    throw new common_1.BadRequestException(`ເງິນສົດ ${currency} ໃນຮ້ານ (Module Cash) ບໍ່ພໍສຳລັບລາຍຈ່າຍ (ມີ ${currentBal.toFixed()} ${currency}, ຕ້ອງການຈ່າຍ ${reqAmount.toFixed()} ${currency})`);
                }
            }
            for (const [key, reqAmount] of bankRequested) {
                const [bankAccountId, currency] = key.split(':');
                const bal = bankBalances.find((b) => b.bankAccountId === bankAccountId && b.currency === currency);
                const currentBal = (0, domain_1.dec)(bal?.actual ?? '0');
                const bankName = bal?.bankNameLo ?? 'ທະນາຄານ';
                if (reqAmount.gt(currentBal)) {
                    throw new common_1.BadRequestException(`ຍອດເງິນ ${currency} ໃນບັນຊີ ${bankName} (Module Bank) ບໍ່ພໍສຳລັບລາຍຈ່າຍ (ມີ ${currentBal.toFixed()} ${currency}, ຕ້ອງການຈ່າຍ ${reqAmount.toFixed()} ${currency})`);
                }
            }
        }
        return this.prisma.$transaction(async (tx) => {
            const rows = [];
            for (const leg of resolved) {
                const created = await tx.incomeExpenseTransaction.create({
                    data: {
                        code: await this.nextCode(tx, 'incomeExpenseTransaction', 'IE'),
                        businessDayId: day.id,
                        categoryId: dto.categoryId,
                        kind: category.kind,
                        method: leg.method,
                        bankAccountId: leg.bankAccountId ?? null,
                        currency: leg.currency,
                        amount: D(leg.amount),
                        note: dto.note ?? null,
                        createdById: user.id,
                    },
                    include: { category: true, bankAccount: true },
                });
                rows.push(created);
                if (leg.method === 'CASH') {
                    await tx.cashTransaction.create({
                        data: {
                            businessDayId: day.id,
                            type: isIncome ? 'OTHER_INCOME' : 'OTHER_EXPENSE',
                            currency: leg.currency,
                            amount: D(leg.amount),
                            refType: 'IncomeExpenseTransaction',
                            refId: created.id,
                            note: `${category.nameLo}${dto.note ? ` — ${dto.note}` : ''}`,
                            createdById: user.id,
                        },
                    });
                }
                else {
                    await tx.bankTransaction.create({
                        data: {
                            businessDayId: day.id,
                            bankAccountId: leg.bankAccountId,
                            type: isIncome ? 'INCOME' : 'EXPENSE',
                            currency: leg.currency,
                            amount: D(leg.amount),
                            refType: 'IncomeExpenseTransaction',
                            refId: created.id,
                            note: `${category.nameLo}${dto.note ? ` — ${dto.note}` : ''}`,
                            createdById: user.id,
                        },
                    });
                }
                await this.audit.record({
                    actorId: user.id, action: 'CREATE', entity: 'IncomeExpenseTransaction',
                    entityId: created.id,
                    after: { category: category.nameLo, currency: leg.currency, amount: leg.amount.toFixed() },
                    summary: `${isIncome ? 'ລາຍຮັບ' : 'ລາຍຈ່າຍ'} ${category.nameLo} ${leg.amount.toFixed(0)} ${leg.currency}`,
                }, tx);
            }
            // One leg still returns the row itself, so existing callers are unaffected.
            return rows.length === 1 ? rows[0] : rows;
        });
    }
    async incomeExpenseHistory(kind, query, user) {
        const range = this.range.resolve(query, user);
        const where = {
            deletedAt: null,
            createdAt: history_range_service_1.HistoryRangeService.window(range),
            ...(kind ? { kind } : {}),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.incomeExpenseTransaction.findMany({
                where,
                include: { category: true, bankAccount: true },
                orderBy: { createdAt: 'desc' },
                skip: range.skip,
                take: range.take,
            }),
            this.prisma.incomeExpenseTransaction.count({ where }),
        ]);
        // ຜູ້ບັນທຶກ — ລູກຄ້າຂໍໃຫ້ເຫັນທຸກ Module ທີ່ມີການລົງລາຍການ.
        return this.range.page(await this.audit.withCreatorNames(rows), total, range);
    }
    async incomeExpenseDailySummary(query, user) {
        if (query.date) {
            if (!query.from_date && !query.fromDate)
                query.from_date = query.date;
            if (!query.to_date && !query.toDate)
                query.to_date = query.date;
        }
        const range = this.range.resolve(query, user);
        const where = {
            deletedAt: null,
            createdAt: history_range_service_1.HistoryRangeService.window(range),
        };
        const [byKindAndCurrency, byMethodKindCurrency, totalTransactions] = await Promise.all([
            this.prisma.incomeExpenseTransaction.groupBy({
                by: ['kind', 'currency'],
                where,
                _sum: { amount: true },
                _count: { _all: true },
            }),
            this.prisma.incomeExpenseTransaction.groupBy({
                by: ['method', 'kind', 'currency'],
                where,
                _sum: { amount: true },
                _count: { _all: true },
            }),
            this.prisma.incomeExpenseTransaction.count({ where }),
        ]);
        let totalIncomeCount = 0;
        let totalExpenseCount = 0;
        const currencies = CURRENCIES.map((currency) => {
            const incRow = byKindAndCurrency.find((r) => r.currency === currency && r.kind === 'INCOME');
            const expRow = byKindAndCurrency.find((r) => r.currency === currency && r.kind === 'EXPENSE');
            const incomeDec = toDec(incRow?._sum.amount);
            const expenseDec = toDec(expRow?._sum.amount);
            const netDec = incomeDec.minus(expenseDec);
            const incomeCount = incRow?._count._all ?? 0;
            const expenseCount = expRow?._count._all ?? 0;
            totalIncomeCount += incomeCount;
            totalExpenseCount += expenseCount;
            return {
                currency,
                income: incomeDec.toFixed(),
                expense: expenseDec.toFixed(),
                net: netDec.toFixed(),
                incomeCount,
                expenseCount,
            };
        });
        const byMethod = ['CASH', 'BANK'].map((method) => {
            const methodCurrencies = CURRENCIES.map((currency) => {
                const incRow = byMethodKindCurrency.find((r) => r.method === method &&
                    r.currency === currency &&
                    r.kind === 'INCOME');
                const expRow = byMethodKindCurrency.find((r) => r.method === method &&
                    r.currency === currency &&
                    r.kind === 'EXPENSE');
                const incomeDec = toDec(incRow?._sum.amount);
                const expenseDec = toDec(expRow?._sum.amount);
                const netDec = incomeDec.minus(expenseDec);
                return {
                    currency,
                    income: incomeDec.toFixed(),
                    expense: expenseDec.toFixed(),
                    net: netDec.toFixed(),
                    incomeCount: incRow?._count._all ?? 0,
                    expenseCount: expRow?._count._all ?? 0,
                };
            });
            return {
                method,
                currencies: methodCurrencies,
            };
        });
        const byCurrency = Object.fromEntries(currencies.map((c) => [c.currency, c]));
        return {
            date: range.fromDate === range.toDate ? range.fromDate : undefined,
            fromDate: range.fromDate,
            toDate: range.toDate,
            totalTransactions,
            totalIncomeCount,
            totalExpenseCount,
            currencies,
            byCurrency,
            byMethod,
        };
    }
    async updateIncomeExpense(id, dto, user) {
        const before = await this.prisma.incomeExpenseTransaction.findFirst({
            where: { id, deletedAt: null },
            include: { category: true, bankAccount: true },
        });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການຮັບຈ່າຍ');
        let category = before.category;
        if (dto.categoryId && dto.categoryId !== before.categoryId) {
            const found = await this.prisma.incomeExpenseCategory.findFirst({
                where: { id: dto.categoryId, deletedAt: null },
            });
            if (!found)
                throw new common_1.NotFoundException('ບໍ່ພົບລາຍການຮັບຈ່າຍ');
            category = found;
        }
        const method = dto.method ?? before.method;
        const bankAccountId = method === 'BANK'
            ? dto.bankAccountId !== undefined
                ? dto.bankAccountId
                : before.bankAccountId
            : null;
        if (method === 'BANK' && !bankAccountId) {
            throw new common_1.BadRequestException('ກະລຸນາເລືອກທະນາຄານ');
        }
        if (bankAccountId) {
            const bank = await this.prisma.bankAccount.findFirst({
                where: { id: bankAccountId },
            });
            if (!bank)
                throw new common_1.NotFoundException('ບໍ່ພົບທະນາຄານ');
        }
        const currency = dto.currency ?? before.currency;
        const amount = dto.amount !== undefined ? (0, domain_1.dec)(dto.amount) : (0, domain_1.dec)(before.amount);
        if (!amount.isFinite() || amount.lte(0)) {
            throw new common_1.BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
        }
        const note = dto.note !== undefined ? dto.note : before.note;
        const kind = category.kind;
        const isIncome = kind === 'INCOME';
        if (category.kind === 'EXPENSE') {
            const [cashBalances, bankBalances] = await Promise.all([
                this.cash.cashBalances(),
                this.cash.bankBalances(),
            ]);
            if (method === 'CASH') {
                const bal = cashBalances.find((b) => b.currency === currency);
                let available = (0, domain_1.dec)(bal?.balance ?? '0');
                if (before.kind === 'EXPENSE' && before.method === 'CASH' && before.currency === currency) {
                    available = available.plus((0, domain_1.dec)(before.amount));
                }
                if (amount.gt(available)) {
                    throw new common_1.BadRequestException(`ເງິນສົດ ${currency} ໃນຮ້ານ (Module Cash) ບໍ່ພໍສຳລັບລາຍຈ່າຍ (ມີ ${available.toFixed()} ${currency}, ຕ້ອງການຈ່າຍ ${amount.toFixed()} ${currency})`);
                }
            }
            else if (method === 'BANK' && bankAccountId) {
                const bal = bankBalances.find((b) => b.bankAccountId === bankAccountId && b.currency === currency);
                let available = (0, domain_1.dec)(bal?.actual ?? '0');
                const bankName = bal?.bankNameLo ?? 'ທະນາຄານ';
                if (before.kind === 'EXPENSE' &&
                    before.method === 'BANK' &&
                    before.bankAccountId === bankAccountId &&
                    before.currency === currency) {
                    available = available.plus((0, domain_1.dec)(before.amount));
                }
                if (amount.gt(available)) {
                    throw new common_1.BadRequestException(`ຍອດເງິນ ${currency} ໃນບັນຊີ ${bankName} (Module Bank) ບໍ່ພໍສຳລັບລາຍຈ່າຍ (ມີ ${available.toFixed()} ${currency}, ຕ້ອງການຈ່າຍ ${amount.toFixed()} ${currency})`);
                }
            }
        }
        return this.prisma.$transaction(async (tx) => {
            const after = await tx.incomeExpenseTransaction.update({
                where: { id },
                data: {
                    categoryId: category.id,
                    kind,
                    method,
                    bankAccountId,
                    currency,
                    amount: D(amount),
                    note,
                },
                include: { category: true, bankAccount: true },
            });
            // Synchronize associated CashTransaction / BankTransaction
            if (before.method === 'CASH') {
                if (method === 'CASH') {
                    await tx.cashTransaction.updateMany({
                        where: { refType: 'IncomeExpenseTransaction', refId: id, deletedAt: null },
                        data: {
                            type: isIncome ? 'OTHER_INCOME' : 'OTHER_EXPENSE',
                            currency,
                            amount: D(amount),
                            note: `${category.nameLo}${note ? ` — ${note}` : ''}`,
                        },
                    });
                }
                else {
                    await tx.cashTransaction.updateMany({
                        where: { refType: 'IncomeExpenseTransaction', refId: id, deletedAt: null },
                        data: { deletedAt: new Date(), deletedById: user.id },
                    });
                    await tx.bankTransaction.create({
                        data: {
                            businessDayId: before.businessDayId,
                            bankAccountId: bankAccountId,
                            type: isIncome ? 'INCOME' : 'EXPENSE',
                            currency,
                            amount: D(amount),
                            refType: 'IncomeExpenseTransaction',
                            refId: id,
                            note: `${category.nameLo}${note ? ` — ${note}` : ''}`,
                            createdById: user.id,
                        },
                    });
                }
            }
            else {
                if (method === 'BANK') {
                    await tx.bankTransaction.updateMany({
                        where: { refType: 'IncomeExpenseTransaction', refId: id, deletedAt: null },
                        data: {
                            bankAccountId: bankAccountId,
                            type: isIncome ? 'INCOME' : 'EXPENSE',
                            currency,
                            amount: D(amount),
                            note: `${category.nameLo}${note ? ` — ${note}` : ''}`,
                        },
                    });
                }
                else {
                    await tx.bankTransaction.updateMany({
                        where: { refType: 'IncomeExpenseTransaction', refId: id, deletedAt: null },
                        data: { deletedAt: new Date(), deletedById: user.id },
                    });
                    await tx.cashTransaction.create({
                        data: {
                            businessDayId: before.businessDayId,
                            type: isIncome ? 'OTHER_INCOME' : 'OTHER_EXPENSE',
                            currency,
                            amount: D(amount),
                            refType: 'IncomeExpenseTransaction',
                            refId: id,
                            note: `${category.nameLo}${note ? ` — ${note}` : ''}`,
                            createdById: user.id,
                        },
                    });
                }
            }
            await this.audit.record({
                actorId: user.id,
                action: 'UPDATE',
                entity: 'IncomeExpenseTransaction',
                entityId: id,
                before: {
                    category: before.category.nameLo,
                    kind: before.kind,
                    method: before.method,
                    bankAccountId: before.bankAccountId,
                    currency: before.currency,
                    amount: (0, domain_1.dec)(before.amount).toFixed(),
                    note: before.note,
                },
                after: {
                    category: category.nameLo,
                    kind,
                    method,
                    bankAccountId,
                    currency,
                    amount: amount.toFixed(),
                    note,
                },
                summary: `ແກ້ໄຂ${isIncome ? 'ລາຍຮັບ' : 'ລາຍຈ່າຍ'} ${category.nameLo} ${amount.toFixed(0)} ${currency}`,
            }, tx);
            return after;
        });
    }
    async deleteIncomeExpense(id, user) {
        const before = await this.prisma.incomeExpenseTransaction.findFirst({
            where: { id, deletedAt: null },
            include: { category: true, bankAccount: true },
        });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການຮັບຈ່າຍ');
        return this.prisma.$transaction(async (tx) => {
            const now = new Date();
            const after = await tx.incomeExpenseTransaction.update({
                where: { id },
                data: { deletedAt: now, deletedById: user.id },
            });
            await tx.cashTransaction.updateMany({
                where: { refType: 'IncomeExpenseTransaction', refId: id, deletedAt: null },
                data: { deletedAt: now, deletedById: user.id },
            });
            await tx.bankTransaction.updateMany({
                where: { refType: 'IncomeExpenseTransaction', refId: id, deletedAt: null },
                data: { deletedAt: now, deletedById: user.id },
            });
            await this.audit.record({
                actorId: user.id,
                action: 'DELETE',
                entity: 'IncomeExpenseTransaction',
                entityId: id,
                before: {
                    category: before.category.nameLo,
                    kind: before.kind,
                    method: before.method,
                    bankAccountId: before.bankAccountId,
                    currency: before.currency,
                    amount: (0, domain_1.dec)(before.amount).toFixed(),
                    note: before.note,
                },
                after: { deletedAt: now.toISOString() },
                summary: `ລຶບ${before.kind === 'INCOME' ? 'ລາຍຮັບ' : 'ລາຍຈ່າຍ'} ${before.category.nameLo} ${(0, domain_1.dec)(before.amount).toFixed(0)} ${before.currency}`,
            }, tx);
            return after;
        });
    }
    /* ---------------------------------------------------------------- *
     * §3.7 — Module ຝາກສິນຄ້າ
     * ---------------------------------------------------------------- */
    /**
     * Gold left with the shop for safekeeping.
     *
     * Deliberately NOT posted to Stock, WAC, COH Gold or AP/AR: the shop holds
     * it but does not own it, and mixing it into inventory would overstate what
     * the shop can sell.
     */
    async createConsignment(dto, user) {
        if (dto.lines.length === 0) {
            throw new common_1.BadRequestException('ຕ້ອງມີລາຍການຝາກຢ່າງໜ້ອຍ 1 ລາຍການ');
        }
        const totalWeightG = dto.lines.reduce((sum, line) => sum.plus((0, domain_1.dec)(line.weightG).mul(line.quantity)), (0, domain_1.dec)(0));
        const totalQuantity = dto.lines.reduce((sum, line) => sum + line.quantity, 0);
        const customer = await this.prisma.customer.upsert({
            where: { phone: dto.phone },
            update: { nameLo: dto.customerName.trim() },
            create: { phone: dto.phone, nameLo: dto.customerName.trim() },
        });
        return this.prisma.$transaction(async (tx) => {
            const created = await tx.consignment.create({
                data: {
                    code: await this.nextCode(tx, 'consignment', 'CS'),
                    billId: dto.billId.trim(),
                    customerId: customer.id,
                    customerName: dto.customerName.trim(),
                    staffName: dto.staffName.trim(),
                    totalWeightG: D(totalWeightG),
                    totalQuantity,
                    note: dto.note ?? null,
                    createdById: user.id,
                    lines: {
                        create: dto.lines.map((line) => ({
                            nameLo: line.nameLo.trim(),
                            weightG: D((0, domain_1.dec)(line.weightG)),
                            quantity: line.quantity,
                        })),
                    },
                },
                include: { lines: true, customer: true },
            });
            await this.audit.record({
                actorId: user.id, action: 'CREATE', entity: 'Consignment', entityId: created.id,
                after: { code: created.code, totalWeightG: totalWeightG.toFixed() },
                summary: `ຮັບຝາກສິນຄ້າ ${created.code} — ${totalWeightG.toFixed()} g`,
            }, tx);
            return created;
        });
    }
    /** ຢືນຢັນການສົ່ງມອບຄືນ. */
    async returnConsignment(id, user) {
        const consignment = await this.prisma.consignment.findFirst({
            where: { id, deletedAt: null },
        });
        if (!consignment)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການຝາກສິນຄ້າ');
        if (consignment.status === 'RETURNED') {
            throw new common_1.BadRequestException('ລາຍການນີ້ສົ່ງມອບຄືນແລ້ວ');
        }
        const updated = await this.prisma.consignment.update({
            where: { id },
            data: { status: 'RETURNED', returnedAt: new Date(), returnedById: user.id },
        });
        await this.audit.record({
            actorId: user.id, action: 'UPDATE', entity: 'Consignment', entityId: id,
            before: { status: consignment.status }, after: { status: 'RETURNED' },
            summary: `ສົ່ງມອບຄືນສິນຄ້າຝາກ ${consignment.code}`,
        });
        return updated;
    }
    async consignments(status, query, user) {
        const range = this.range.resolve(query, user);
        /*
         * ຄຳທີ່ຍັງຝາກຢູ່ ຕ້ອງຄ້າງຢູ່ໜ້າຈໍຈົນກວ່າຈະສົ່ງຄືນ.
         *
         * ຖ້າກອງຕາມວັນທີສ້າງຢ່າງດຽວ ລາຍການທີ່ຮັບຝາກມື້ວານຈະຫາຍໄປຈາກໜ້າຈໍພໍ
         * ຂຶ້ນມື້ໃໝ່ ທັງທີ່ຄຳຍັງຢູ່ໃນຮ້ານ — ພະນັກງານຈຶ່ງບໍ່ຮູ້ວ່າຍັງຖືຂອງໃຜຢູ່.
         * ສະນັ້ນ: ລາຍການໃນຊ່ວງວັນທີ ບວກກັບ ລາຍການທີ່ຍັງ HELD ທັງໝົດ.
         */
        const inRange = { createdAt: history_range_service_1.HistoryRangeService.window(range) };
        const stillHeld = { status: 'HELD' };
        const where = {
            deletedAt: null,
            ...(status
                ? { status, ...(status === 'HELD' ? {} : inRange) }
                : { OR: [inRange, stillHeld] }),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.consignment.findMany({
                where,
                include: { lines: true, customer: true },
                orderBy: { createdAt: 'desc' },
                skip: range.skip,
                take: range.take,
            }),
            this.prisma.consignment.count({ where }),
        ]);
        // ຜູ້ບັນທຶກ — ລູກຄ້າຂໍໃຫ້ເຫັນທຸກ Module ທີ່ມີການລົງລາຍການ.
        const withActors = await this.audit.withCreatorNames(rows);
        // Totals describe the page's range, not the page: the shop wants to know
        // what it is holding over the period, not what fits on screen.
        const held = rows.filter((r) => r.status === 'HELD');
        return {
            ...this.range.page(withActors, total, range),
            totals: {
                totalWeightG: held
                    .reduce((sum, r) => sum.plus(toDec(r.totalWeightG)), (0, domain_1.dec)(0))
                    .toFixed(),
                totalQuantity: held.reduce((sum, r) => sum + r.totalQuantity, 0),
                billCount: held.length,
            },
        };
    }
    /* ---------------------------------------------------------------- *
     * §9.1 — ລາຍການ AP-AR (Cash)
     * ---------------------------------------------------------------- */
    async listApArCategories(side, withActor = false) {
        const rows = await this.prisma.apArCashCategory.findMany({
            where: {
                deletedAt: null,
                isActive: true,
                ...(side ? { OR: [{ side }, { side: null }] } : {}),
            },
            orderBy: { sortOrder: 'asc' },
        });
        return withActor ? this.audit.withCreatorsFromAudit('ApArCashCategory', rows) : rows;
    }
    async createApArCategory(dto, user) {
        const max = await this.prisma.apArCashCategory.aggregate({ _max: { sortOrder: true } });
        await this.assertNameFree(this.prisma.apArCashCategory, dto.nameLo, 'ປະເພດລາຍການ AP-AR');
        const code = await this.codes.nextFor('APAR_CASH_CATEGORY', this.prisma.apArCashCategory);
        const created = await this.prisma.apArCashCategory.create({
            data: {
                code,
                nameLo: dto.nameLo.trim(),
                // 'AP_AR' is the UI's way of saying "both sides", and both sides is
                // what NULL has always meant to every reader of this column.
                side: dto.side && dto.side !== 'AP_AR' ? dto.side : null,
                sortOrder: (max._max.sortOrder ?? 0) + 1,
            },
        });
        await this.audit.record({
            actorId: user.id, action: 'CREATE', entity: 'ApArCashCategory', entityId: created.id,
            after: created, summary: `ເພີ່ມປະເພດລາຍການ AP-AR (Cash) ${created.nameLo}`,
        });
        return created;
    }
    /* ---------------------------------------------------------------- *
     * §9.3 / §9.4 — +Add AP Cash / +Add AR Cash, and settlement
     * ---------------------------------------------------------------- */
    /** Raise a new AP or AR against a Supplier. */
    async addApArEntry(side, dto, user) {
        const amount = (0, domain_1.dec)(dto.amount);
        if (!amount.isFinite() || amount.lte(0)) {
            throw new common_1.BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
        }
        const [partner, category] = await Promise.all([
            this.prisma.partnerSource.findFirst({ where: { id: dto.partnerId, deletedAt: null } }),
            this.prisma.apArCashCategory.findFirst({ where: { id: dto.categoryId, deletedAt: null } }),
        ]);
        if (!partner)
            throw new common_1.NotFoundException('ບໍ່ພົບ Supplier');
        if (!category)
            throw new common_1.NotFoundException('ບໍ່ພົບປະເພດລາຍການ');
        const reason = side === 'AP' ? 'MANUAL_AP' : 'MANUAL_AR';
        return this.prisma.$transaction(async (tx) => {
            const row = await this.apar.postCash(tx, {
                reason,
                currency: dto.currency,
                amount,
                partnerId: dto.partnerId,
                categoryId: dto.categoryId,
                note: dto.note,
                createdById: user.id,
            });
            await this.audit.record({
                actorId: user.id, action: 'CREATE', entity: 'CashApArLedger', entityId: row?.id,
                after: { side, partner: partner.nameLo, currency: dto.currency, amount: amount.toFixed() },
                summary: `ເພີ່ມ ${side} (Cash) ${partner.nameLo} — ${amount.toFixed(0)} ${dto.currency}`,
            }, tx);
            return row;
        });
    }
    /**
     * ປຸ່ມ Payment — settle part or all of a Supplier's AP/AR balance.
     *
     * Settling an AP pays money OUT; settling an AR takes money IN. The cash or
     * bank movement is written in the same transaction as the ledger row, so a
     * balance can never be cleared without the money actually moving.
     */
    async settleApAr(side, dto, user) {
        const amount = (0, domain_1.dec)(dto.amount);
        if (!amount.isFinite() || amount.lte(0)) {
            throw new common_1.BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
        }
        if (dto.method === 'BANK' && !dto.bankAccountId) {
            throw new common_1.BadRequestException('ກະລຸນາເລືອກທະນາຄານ');
        }
        const partner = await this.prisma.partnerSource.findFirst({
            where: { id: dto.partnerId, deletedAt: null },
        });
        if (!partner)
            throw new common_1.NotFoundException('ບໍ່ພົບ Supplier');
        const outstanding = await this.partnerOutstanding(side, dto.partnerId, dto.currency);
        if (amount.gt(outstanding)) {
            throw new common_1.BadRequestException(`ຈຳນວນເງິນເກີນຍອດຄ້າງ (${outstanding.toFixed(0)} ${dto.currency})`);
        }
        const day = await this.businessDay.current();
        const reason = side === 'AP' ? 'MANUAL_AP_PAYMENT' : 'MANUAL_AR_RECEIPT';
        const moneyLeaves = side === 'AP';
        return this.prisma.$transaction(async (tx) => {
            if (dto.method === 'CASH') {
                await tx.cashTransaction.create({
                    data: {
                        businessDayId: day.id,
                        type: moneyLeaves ? 'OUT' : 'IN',
                        currency: dto.currency,
                        amount: D(amount),
                        refType: `${side}_CASH_SETTLEMENT`,
                        refId: dto.partnerId,
                        note: `${side} (Cash) ${partner.nameLo}`,
                        createdById: user.id,
                    },
                });
            }
            else {
                await tx.bankTransaction.create({
                    data: {
                        businessDayId: day.id,
                        bankAccountId: dto.bankAccountId,
                        type: moneyLeaves ? 'WITHDRAW' : 'DEPOSIT',
                        currency: dto.currency,
                        amount: D(amount),
                        refType: `${side}_CASH_SETTLEMENT`,
                        refId: dto.partnerId,
                        note: `${side} (Cash) ${partner.nameLo}`,
                        createdById: user.id,
                    },
                });
            }
            const latestEntry = await tx.cashApArLedger.findFirst({
                where: {
                    side,
                    partnerId: dto.partnerId,
                    currency: dto.currency,
                    categoryId: { not: null },
                    deletedAt: null,
                },
                orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
            });
            const row = await this.apar.postCash(tx, {
                reason,
                currency: dto.currency,
                amount,
                partnerId: dto.partnerId,
                categoryId: latestEntry?.categoryId ?? undefined,
                note: dto.note ?? `ຊຳຣະ ${side} (Cash) ${partner.nameLo}`,
                createdById: user.id,
            });
            await this.audit.record({
                actorId: user.id, action: 'UPDATE', entity: 'CashApArLedger', entityId: row?.id,
                after: { side, partner: partner.nameLo, amount: amount.toFixed() },
                summary: `ຊຳຣະ ${side} (Cash) ${partner.nameLo} — ${amount.toFixed(0)} ${dto.currency}`,
            }, tx);
            return row;
        });
    }
    /** ຍອດປັດຈຸບັນ for one Supplier on one side, in one currency. */
    async partnerOutstanding(side, partnerId, currency) {
        const agg = await this.prisma.cashApArLedger.aggregate({
            where: { side, partnerId, currency, deletedAt: null },
            _sum: { amountIn: true, amountOut: true },
        });
        return toDec(agg._sum.amountIn).minus(toDec(agg._sum.amountOut));
    }
    /**
     * ຕາຕະລາງ ແຍກຕາມ ແຫຼ່ງ for the AP (Cash) or AR (Cash) module (§9.3, §9.4).
     */
    async apArByPartner(side) {
        const day = await this.businessDay.current();
        const today = business_day_service_1.BusinessDayService.toDateOnly();
        const [partners, openings, prevMovements, movements] = await Promise.all([
            this.prisma.partnerSource.findMany({
                where: { deletedAt: null, isActive: true },
                orderBy: { sortOrder: 'asc' },
            }),
            this.prisma.cashApArOpening.findMany({ where: { businessDayId: day.id, side } }),
            this.prisma.cashApArLedger.groupBy({
                by: ['partnerId', 'currency'],
                where: { side, businessDate: { lt: today }, deletedAt: null },
                _sum: { amountIn: true, amountOut: true },
            }),
            this.prisma.cashApArLedger.groupBy({
                by: ['partnerId', 'currency'],
                where: { side, businessDate: today, deletedAt: null },
                _sum: { amountIn: true, amountOut: true },
            }),
        ]);
        return partners.flatMap((partner) => CURRENCIES.map((currency) => {
            const prevRow = prevMovements.find((m) => m.partnerId === partner.id && m.currency === currency);
            const prevNet = toDec(prevRow?._sum.amountIn).minus(toDec(prevRow?._sum.amountOut));
            const broughtForward = prevNet;
            const row = movements.find((m) => m.partnerId === partner.id && m.currency === currency);
            const increases = toDec(row?._sum.amountIn);
            const decreases = toDec(row?._sum.amountOut);
            return {
                partnerId: partner.id,
                partnerCode: partner.code,
                partnerNameLo: partner.nameLo,
                currency,
                broughtForward: broughtForward.toFixed(),
                increases: increases.toFixed(),
                decreases: decreases.toFixed(),
                current: (0, domain_1.partnerBalance)(broughtForward, increases, decreases).toFixed(),
            };
        }).filter((r) => r.increases !== '0' || r.decreases !== '0' || r.broughtForward !== '0'));
    }
    /** ຍອດລວມ AP (Cash) / AR (Cash) per currency. */
    async apArTotals(side) {
        const day = await this.businessDay.current();
        const today = business_day_service_1.BusinessDayService.toDateOnly();
        const [openings, prevMovements, movements] = await Promise.all([
            this.prisma.cashApArOpening.findMany({ where: { businessDayId: day.id, side } }),
            this.prisma.cashApArLedger.groupBy({
                by: ['currency'],
                where: { side, businessDate: { lt: today }, deletedAt: null },
                _sum: { amountIn: true, amountOut: true },
            }),
            this.prisma.cashApArLedger.groupBy({
                by: ['currency'],
                where: { side, businessDate: today, deletedAt: null },
                _sum: { amountIn: true, amountOut: true },
            }),
        ]);
        return CURRENCIES.map((currency) => {
            const prevRow = prevMovements.find((m) => m.currency === currency);
            const prevNet = toDec(prevRow?._sum.amountIn).minus(toDec(prevRow?._sum.amountOut));
            const manualOpening = toDec(openings.find((o) => o.currency === currency)?.openingAmount);
            const opening = manualOpening.plus(prevNet);
            const row = movements.find((m) => m.currency === currency);
            const net = (0, domain_1.netCashApAr)(opening, toDec(row?._sum.amountIn), toDec(row?._sum.amountOut));
            return {
                side,
                currency,
                opening: net.opening.toFixed(),
                increases: net.increases.toFixed(),
                decreases: net.decreases.toFixed(),
                net: net.net.toFixed(),
            };
        });
    }
    async apArHistory(side, query, user) {
        const range = this.range.resolve(query, user);
        const where = {
            side,
            deletedAt: null,
            businessDate: history_range_service_1.HistoryRangeService.dayWindow(range),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.cashApArLedger.findMany({
                where,
                include: { partner: true, category: true },
                orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
                skip: range.skip,
                take: range.take,
            }),
            this.prisma.cashApArLedger.count({ where }),
        ]);
        // ຜູ້ບັນທຶກ — ລູກຄ້າຂໍໃຫ້ເຫັນທຸກ Module ທີ່ມີການລົງລາຍການ.
        return this.range.page(await this.audit.withCreatorNames(rows), total, range);
    }
    /** Sequential code: <PREFIX>-YYMMDD-NNN. */
    async nextCode(tx, model, prefix) {
        const now = new Date();
        const stem = `${prefix}-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const count = model === 'consignment'
            ? await tx.consignment.count({ where: { code: { startsWith: stem } } })
            : await tx.incomeExpenseTransaction.count({ where: { code: { startsWith: stem } } });
        return `${stem}-${String(count + 1).padStart(3, '0')}`;
    }
    // --- ແກ້ໄຂ / ລຶບ ຂໍ້ມູນອ້າງອີງ (§3.7) -------------------------------------
    /** ແຖວລະບົບ: ປະຕິເສດການລຶບ ແລະ ການປິດການນຳໃຊ້. */
    assertNotSystemBank(code) {
        if (SYSTEM_BANK_CODES.includes(code)) {
            throw new common_1.BadRequestException(`ບັນຊີທະນາຄານ "${code}" ເປັນແຖວລະບົບ — ລຶບ ຫຼື ປິດການນຳໃຊ້ບໍ່ໄດ້. ແກ້ໄດ້ແຕ່ຊື່.`);
        }
    }
    /**
     * Refuse a delete that would orphan history. Reference data is named by
     * ledger rows that must stay readable, so deleting is only for rows
     * nothing has used; anything in use is deactivated instead.
     */
    async assertUnused(labelLo, counts) {
        const used = [];
        for (const [what, pending] of counts) {
            if ((await pending) > 0)
                used.push(what);
        }
        if (used.length > 0) {
            throw new common_1.BadRequestException(`ລຶບ${labelLo}ນີ້ບໍ່ໄດ້ — ຖືກໃຊ້ຢູ່ໃນ ${used.join(', ')}. ປິດການນຳໃຊ້ແທນ.`);
        }
    }
    async updateBankAccount(id, dto, user) {
        const before = await this.prisma.bankAccount.findUnique({ where: { id } });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບບັນຊີທະນາຄານ');
        if (dto.isActive === false)
            this.assertNotSystemBank(before.code);
        const after = await this.prisma.bankAccount.update({
            where: { id },
            data: {
                ...(dto.nameLo !== undefined ? { nameLo: dto.nameLo.trim() } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
        });
        await this.audit.record({
            actorId: user.id, action: 'UPDATE', entity: 'BankAccount', entityId: id,
            before, after, summary: `ແກ້ໄຂທະນາຄານ ${after.nameLo}`,
        });
        return after;
    }
    /**
     * ຫ້າມລົບຖ້າມີທຸລະກຳ ຫຼື ຍອດເງິນຄ້າງ.
     *
     * BankAccount has no deletedAt — it is referenced by eight payment tables
     * whose rows must keep resolving — so "ລຶບ" deactivates it. That is also
     * the only safe reading: a bank with a balance has not stopped existing.
     */
    async deleteBankAccount(id, user) {
        const before = await this.prisma.bankAccount.findUnique({ where: { id } });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບບັນຊີທະນາຄານ');
        this.assertNotSystemBank(before.code);
        await this.assertUnused('ບັນຊີທະນາຄານ', [
            ['ທຸລະກຳ Bank', this.prisma.bankTransaction.count({ where: { bankAccountId: id } })],
            ['ຍອດ Bank', this.prisma.bankNetBalance.count({ where: { bankAccountId: id } })],
            ['Buyback', this.prisma.buybackPayment.count({ where: { bankAccountId: id } })],
            ['ລາຍການປ່ຽນ', this.prisma.exchangePayment.count({ where: { bankAccountId: id } })],
            ['ສິນເຊື່ອ', this.prisma.creditReceipt.count({ where: { bankAccountId: id } })],
            ['Order', this.prisma.orderReceipt.count({ where: { bankAccountId: id } })],
            ['ລາຍຮັບລາຍຈ່າຍ', this.prisma.incomeExpenseTransaction.count({ where: { bankAccountId: id } })],
            ['Advance', this.prisma.advanceLedger.count({ where: { bankAccountId: id } })],
        ]);
        const after = await this.prisma.bankAccount.update({
            where: { id },
            data: { isActive: false },
        });
        await this.audit.record({
            actorId: user.id, action: 'DELETE', entity: 'BankAccount', entityId: id,
            before, after, summary: `ລຶບທະນາຄານ ${before.nameLo}`,
        });
        return after;
    }
    async updateIncomeExpenseCategory(id, dto, user) {
        const before = await this.prisma.incomeExpenseCategory.findFirst({
            where: { id, deletedAt: null },
        });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການຮັບຈ່າຍ');
        const after = await this.prisma.incomeExpenseCategory.update({
            where: { id },
            data: {
                ...(dto.nameLo !== undefined ? { nameLo: dto.nameLo.trim() } : {}),
                ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
        });
        await this.audit.record({
            actorId: user.id, action: 'UPDATE', entity: 'IncomeExpenseCategory', entityId: id,
            before, after, summary: `ແກ້ໄຂລາຍການຮັບຈ່າຍ ${after.nameLo}`,
        });
        return after;
    }
    async deleteIncomeExpenseCategory(id, user) {
        const before = await this.prisma.incomeExpenseCategory.findFirst({
            where: { id, deletedAt: null },
        });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການຮັບຈ່າຍ');
        await this.assertUnused('ລາຍການຮັບຈ່າຍ', [
            [
                'ລາຍຮັບລາຍຈ່າຍ',
                this.prisma.incomeExpenseTransaction.count({ where: { categoryId: id } }),
            ],
        ]);
        const after = await this.prisma.incomeExpenseCategory.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        await this.audit.record({
            actorId: user.id, action: 'DELETE', entity: 'IncomeExpenseCategory', entityId: id,
            before, after, summary: `ລຶບລາຍການຮັບຈ່າຍ ${before.nameLo}`,
        });
        return after;
    }
    async updateApArCategory(id, dto, user) {
        const before = await this.prisma.apArCashCategory.findFirst({
            where: { id, deletedAt: null },
        });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບປະເພດລາຍການ AP-AR');
        const after = await this.prisma.apArCashCategory.update({
            where: { id },
            data: {
                ...(dto.nameLo !== undefined ? { nameLo: dto.nameLo.trim() } : {}),
                ...(dto.side !== undefined
                    ? { side: dto.side === 'AP_AR' ? null : dto.side }
                    : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
        });
        await this.audit.record({
            actorId: user.id, action: 'UPDATE', entity: 'ApArCashCategory', entityId: id,
            before, after, summary: `ແກ້ໄຂປະເພດລາຍການ AP-AR ${after.nameLo}`,
        });
        return after;
    }
    async deleteApArCategory(id, user) {
        const before = await this.prisma.apArCashCategory.findFirst({
            where: { id, deletedAt: null },
        });
        if (!before)
            throw new common_1.NotFoundException('ບໍ່ພົບປະເພດລາຍການ AP-AR');
        await this.assertUnused('ປະເພດລາຍການ AP-AR', [
            ['AP/AR (ເງິນ)', this.prisma.cashApArLedger.count({ where: { categoryId: id } })],
        ]);
        const after = await this.prisma.apArCashCategory.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        await this.audit.record({
            actorId: user.id, action: 'DELETE', entity: 'ApArCashCategory', entityId: id,
            before, after, summary: `ລຶບປະເພດລາຍການ AP-AR ${before.nameLo}`,
        });
        return after;
    }
};
exports.FinanceService = FinanceService;
exports.FinanceService = FinanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        business_day_service_1.BusinessDayService,
        apar_posting_service_1.ApArPostingService,
        history_range_service_1.HistoryRangeService,
        code_generator_service_1.CodeGeneratorService,
        cash_service_1.CashService])
], FinanceService);
//# sourceMappingURL=finance.service.js.map