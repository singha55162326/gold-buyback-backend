import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ApArSide, type Currency, type IncomeExpenseKind } from '@prisma/client';
import { dec, netCashApAr, partnerBalance, type CashApArReason, type Decimal } from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { HistoryRangeService } from '../../common/services/history-range.service';
import { CodeGeneratorService } from '../../common/services/code-generator.service';
import type { HistoryRangeDto } from '../../common/dto/history-range.dto';
import { BusinessDayService } from '../../common/services/business-day.service';
import { ApArPostingService } from '../../common/services/apar-posting.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type {
  CreateApArCashCategoryDto,
  CreateApArCashEntryDto,
  CreateBankAccountDto,
  CreateConsignmentDto,
  CreateIncomeExpenseCategoryDto,
  CreateIncomeExpenseDto,
  SettleApArCashDto,
} from './dto/finance.dto';

const D = (value: Decimal) => new Prisma.Decimal(value.toFixed());
const toDec = (value: Prisma.Decimal | null | undefined) => dec(value?.toFixed() ?? 0);
const CURRENCIES: Currency[] = ['LAK', 'THB', 'USD'];

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
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly businessDay: BusinessDayService,
    private readonly apar: ApArPostingService,
    private readonly range: HistoryRangeService,
    private readonly codes: CodeGeneratorService,
  ) {}

  /* ---------------------------------------------------------------- *
   * §3.7 — Module ລາຍການ Bank
   * ---------------------------------------------------------------- */

  async createBankAccount(dto: CreateBankAccountDto, user: AuthenticatedUser) {
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

  listIncomeExpenseCategories(kind?: IncomeExpenseKind) {
    return this.prisma.incomeExpenseCategory.findMany({
      where: { deletedAt: null, isActive: true, ...(kind ? { kind } : {}) },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createIncomeExpenseCategory(
    dto: CreateIncomeExpenseCategoryDto,
    user: AuthenticatedUser,
  ) {
    const max = await this.prisma.incomeExpenseCategory.aggregate({ _max: { sortOrder: true } });
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
  async createIncomeExpense(dto: CreateIncomeExpenseDto, user: AuthenticatedUser) {
    // A single expense may be settled part in cash and part by transfer, in
    // more than one currency; each leg is its own row so Module Cash and
    // Module Bank each show what actually moved through them.
    const legs = dto.payments?.length
      ? dto.payments
      : dto.method && dto.currency && dto.amount
        ? [{ method: dto.method, bankAccountId: dto.bankAccountId, currency: dto.currency, amount: dto.amount }]
        : [];

    if (legs.length === 0) {
      throw new BadRequestException('ຕ້ອງມີລາຍການຈ່າຍ/ຮັບຢ່າງໜ້ອຍ 1 ລາຍການ');
    }

    const resolved = legs.map((leg) => {
      const amount = dec(leg.amount);
      if (!amount.isFinite() || amount.lte(0)) {
        throw new BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
      }
      if (leg.method === 'BANK' && !leg.bankAccountId) {
        throw new BadRequestException('ກະລຸນາເລືອກທະນາຄານ');
      }
      return { ...leg, amount };
    });

    const category = await this.prisma.incomeExpenseCategory.findFirst({
      where: { id: dto.categoryId, deletedAt: null },
    });
    if (!category) throw new NotFoundException('ບໍ່ພົບລາຍການຮັບຈ່າຍ');

    const day = await this.businessDay.current();
    const isIncome = category.kind === 'INCOME';

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
        } else {
          await tx.bankTransaction.create({
            data: {
              businessDayId: day.id,
              bankAccountId: leg.bankAccountId!,
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

        await this.audit.record(
          {
            actorId: user.id, action: 'CREATE', entity: 'IncomeExpenseTransaction',
            entityId: created.id,
            after: { category: category.nameLo, currency: leg.currency, amount: leg.amount.toFixed() },
            summary: `${isIncome ? 'ລາຍຮັບ' : 'ລາຍຈ່າຍ'} ${category.nameLo} ${leg.amount.toFixed(0)} ${leg.currency}`,
          },
          tx,
        );
      }

      // One leg still returns the row itself, so existing callers are unaffected.
      return rows.length === 1 ? rows[0] : rows;
    });
  }

  async incomeExpenseHistory(
    kind: IncomeExpenseKind | undefined,
    query: HistoryRangeDto,
    user?: AuthenticatedUser,
  ) {
    const range = this.range.resolve(query, user);
    const where = {
      deletedAt: null,
      createdAt: HistoryRangeService.window(range),
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
    // ຜູ້ລົງລາຍການ — ລູກຄ້າຂໍໃຫ້ເຫັນທຸກ Module ທີ່ມີການບັນທຶກ.
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    return this.range.page(
      rows.map((r) => ({ ...r, createdBy: nameById.get(r.createdById) ?? '—' })),
      total,
      range,
    );
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
  async createConsignment(dto: CreateConsignmentDto, user: AuthenticatedUser) {
    if (dto.lines.length === 0) {
      throw new BadRequestException('ຕ້ອງມີລາຍການຝາກຢ່າງໜ້ອຍ 1 ລາຍການ');
    }

    const totalWeightG = dto.lines.reduce(
      (sum, line) => sum.plus(dec(line.weightG).mul(line.quantity)),
      dec(0),
    );
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
              weightG: D(dec(line.weightG)),
              quantity: line.quantity,
            })),
          },
        },
        include: { lines: true, customer: true },
      });

      await this.audit.record(
        {
          actorId: user.id, action: 'CREATE', entity: 'Consignment', entityId: created.id,
          after: { code: created.code, totalWeightG: totalWeightG.toFixed() },
          summary: `ຮັບຝາກສິນຄ້າ ${created.code} — ${totalWeightG.toFixed()} g`,
        },
        tx,
      );

      return created;
    });
  }

  /** ຢືນຢັນການສົ່ງມອບຄືນ. */
  async returnConsignment(id: string, user: AuthenticatedUser) {
    const consignment = await this.prisma.consignment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!consignment) throw new NotFoundException('ບໍ່ພົບລາຍການຝາກສິນຄ້າ');
    if (consignment.status === 'RETURNED') {
      throw new BadRequestException('ລາຍການນີ້ສົ່ງມອບຄືນແລ້ວ');
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

  async consignments(
    status: 'HELD' | 'RETURNED' | undefined,
    query: HistoryRangeDto,
    user?: AuthenticatedUser,
  ) {
    const range = this.range.resolve(query, user);
    /*
     * ຄຳທີ່ຍັງຝາກຢູ່ ຕ້ອງຄ້າງຢູ່ໜ້າຈໍຈົນກວ່າຈະສົ່ງຄືນ.
     *
     * ຖ້າກອງຕາມວັນທີສ້າງຢ່າງດຽວ ລາຍການທີ່ຮັບຝາກມື້ວານຈະຫາຍໄປຈາກໜ້າຈໍພໍ
     * ຂຶ້ນມື້ໃໝ່ ທັງທີ່ຄຳຍັງຢູ່ໃນຮ້ານ — ພະນັກງານຈຶ່ງບໍ່ຮູ້ວ່າຍັງຖືຂອງໃຜຢູ່.
     * ສະນັ້ນ: ລາຍການໃນຊ່ວງວັນທີ ບວກກັບ ລາຍການທີ່ຍັງ HELD ທັງໝົດ.
     */
    const inRange = { createdAt: HistoryRangeService.window(range) };
    const stillHeld = { status: 'HELD' as const };
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

    // Totals describe the page's range, not the page: the shop wants to know
    // what it is holding over the period, not what fits on screen.
    const held = rows.filter((r) => r.status === 'HELD');
    return {
      ...this.range.page(rows, total, range),
      totals: {
        totalWeightG: held
          .reduce((sum, r) => sum.plus(toDec(r.totalWeightG)), dec(0))
          .toFixed(),
        totalQuantity: held.reduce((sum, r) => sum + r.totalQuantity, 0),
        billCount: held.length,
      },
    };
  }

  /* ---------------------------------------------------------------- *
   * §9.1 — ລາຍການ AP-AR (Cash)
   * ---------------------------------------------------------------- */

  listApArCategories(side?: ApArSide) {
    return this.prisma.apArCashCategory.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(side ? { OR: [{ side }, { side: null }] } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createApArCategory(dto: CreateApArCashCategoryDto, user: AuthenticatedUser) {
    const max = await this.prisma.apArCashCategory.aggregate({ _max: { sortOrder: true } });
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
  async addApArEntry(side: ApArSide, dto: CreateApArCashEntryDto, user: AuthenticatedUser) {
    const amount = dec(dto.amount);
    if (!amount.isFinite() || amount.lte(0)) {
      throw new BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
    }

    const [partner, category] = await Promise.all([
      this.prisma.partnerSource.findFirst({ where: { id: dto.partnerId, deletedAt: null } }),
      this.prisma.apArCashCategory.findFirst({ where: { id: dto.categoryId, deletedAt: null } }),
    ]);
    if (!partner) throw new NotFoundException('ບໍ່ພົບ Supplier');
    if (!category) throw new NotFoundException('ບໍ່ພົບປະເພດລາຍການ');

    const reason: CashApArReason = side === 'AP' ? 'MANUAL_AP' : 'MANUAL_AR';

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

      await this.audit.record(
        {
          actorId: user.id, action: 'CREATE', entity: 'CashApArLedger', entityId: row?.id,
          after: { side, partner: partner.nameLo, currency: dto.currency, amount: amount.toFixed() },
          summary: `ເພີ່ມ ${side} (Cash) ${partner.nameLo} — ${amount.toFixed(0)} ${dto.currency}`,
        },
        tx,
      );

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
  async settleApAr(side: ApArSide, dto: SettleApArCashDto, user: AuthenticatedUser) {
    const amount = dec(dto.amount);
    if (!amount.isFinite() || amount.lte(0)) {
      throw new BadRequestException('ຈຳນວນເງິນຕ້ອງໃຫຍ່ກວ່າ 0');
    }
    if (dto.method === 'BANK' && !dto.bankAccountId) {
      throw new BadRequestException('ກະລຸນາເລືອກທະນາຄານ');
    }

    const partner = await this.prisma.partnerSource.findFirst({
      where: { id: dto.partnerId, deletedAt: null },
    });
    if (!partner) throw new NotFoundException('ບໍ່ພົບ Supplier');

    const outstanding = await this.partnerOutstanding(side, dto.partnerId, dto.currency);
    if (amount.gt(outstanding)) {
      throw new BadRequestException(
        `ຈຳນວນເງິນເກີນຍອດຄ້າງ (${outstanding.toFixed(0)} ${dto.currency})`,
      );
    }

    const day = await this.businessDay.current();
    const reason: CashApArReason = side === 'AP' ? 'MANUAL_AP_PAYMENT' : 'MANUAL_AR_RECEIPT';
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
      } else {
        await tx.bankTransaction.create({
          data: {
            businessDayId: day.id,
            bankAccountId: dto.bankAccountId!,
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

      const row = await this.apar.postCash(tx, {
        reason,
        currency: dto.currency,
        amount,
        partnerId: dto.partnerId,
        note: dto.note ?? `ຊຳຣະ ${side} (Cash) ${partner.nameLo}`,
        createdById: user.id,
      });

      await this.audit.record(
        {
          actorId: user.id, action: 'UPDATE', entity: 'CashApArLedger', entityId: row?.id,
          after: { side, partner: partner.nameLo, amount: amount.toFixed() },
          summary: `ຊຳຣະ ${side} (Cash) ${partner.nameLo} — ${amount.toFixed(0)} ${dto.currency}`,
        },
        tx,
      );

      return row;
    });
  }

  /** ຍອດປັດຈຸບັນ for one Supplier on one side, in one currency. */
  private async partnerOutstanding(
    side: ApArSide,
    partnerId: string,
    currency: Currency,
  ): Promise<Decimal> {
    const agg = await this.prisma.cashApArLedger.aggregate({
      where: { side, partnerId, currency, deletedAt: null },
      _sum: { amountIn: true, amountOut: true },
    });
    return toDec(agg._sum.amountIn).minus(toDec(agg._sum.amountOut));
  }

  /**
   * ຕາຕະລາງ ແຍກຕາມ ແຫຼ່ງ for the AP (Cash) or AR (Cash) module (§9.3, §9.4).
   */
  async apArByPartner(side: ApArSide) {
    const day = await this.businessDay.current();

    const [partners, openings, movements] = await Promise.all([
      this.prisma.partnerSource.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.cashApArOpening.findMany({ where: { businessDayId: day.id, side } }),
      this.prisma.cashApArLedger.groupBy({
        by: ['partnerId', 'currency'],
        where: { side, businessDate: BusinessDayService.toDateOnly(), deletedAt: null },
        _sum: { amountIn: true, amountOut: true },
      }),
    ]);

    const openingFor = (currency: Currency) =>
      toDec(openings.find((o) => o.currency === currency)?.openingAmount);

    return partners.flatMap((partner) =>
      CURRENCIES.map((currency) => {
        const row = movements.find(
          (m) => m.partnerId === partner.id && m.currency === currency,
        );
        const increases = toDec(row?._sum.amountIn);
        const decreases = toDec(row?._sum.amountOut);
        const broughtForward = openingFor(currency);

        return {
          partnerId: partner.id,
          partnerCode: partner.code,
          partnerNameLo: partner.nameLo,
          currency,
          broughtForward: broughtForward.toFixed(),
          increases: increases.toFixed(),
          decreases: decreases.toFixed(),
          current: partnerBalance(broughtForward, increases, decreases).toFixed(),
        };
      }).filter((r) => r.increases !== '0' || r.decreases !== '0' || r.broughtForward !== '0'),
    );
  }

  /** ຍອດລວມ AP (Cash) / AR (Cash) per currency. */
  async apArTotals(side: ApArSide) {
    const day = await this.businessDay.current();
    const [openings, movements] = await Promise.all([
      this.prisma.cashApArOpening.findMany({ where: { businessDayId: day.id, side } }),
      this.prisma.cashApArLedger.groupBy({
        by: ['currency'],
        where: { side, businessDate: BusinessDayService.toDateOnly(), deletedAt: null },
        _sum: { amountIn: true, amountOut: true },
      }),
    ]);

    return CURRENCIES.map((currency) => {
      const row = movements.find((m) => m.currency === currency);
      const net = netCashApAr(
        toDec(openings.find((o) => o.currency === currency)?.openingAmount),
        toDec(row?._sum.amountIn),
        toDec(row?._sum.amountOut),
      );
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

  async apArHistory(side: ApArSide, query: HistoryRangeDto, user?: AuthenticatedUser) {
    const range = this.range.resolve(query, user);
    const where = {
      side,
      deletedAt: null,
      businessDate: HistoryRangeService.dayWindow(range),
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
    return this.range.page(rows, total, range);
  }

  /** Sequential code: <PREFIX>-YYMMDD-NNN. */
  private async nextCode(
    tx: Prisma.TransactionClient,
    model: 'incomeExpenseTransaction' | 'consignment',
    prefix: string,
  ): Promise<string> {
    const now = new Date();
    const stem = `${prefix}-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const count =
      model === 'consignment'
        ? await tx.consignment.count({ where: { code: { startsWith: stem } } })
        : await tx.incomeExpenseTransaction.count({ where: { code: { startsWith: stem } } });
    return `${stem}-${String(count + 1).padStart(3, '0')}`;
  }

  // --- ແກ້ໄຂ / ລຶບ ຂໍ້ມູນອ້າງອີງ (§3.7) -------------------------------------

  /**
   * Refuse a delete that would orphan history. Reference data is named by
   * ledger rows that must stay readable, so deleting is only for rows
   * nothing has used; anything in use is deactivated instead.
   */
  private async assertUnused(labelLo: string, counts: Array<[string, Promise<number>]>) {
    const used: string[] = [];
    for (const [what, pending] of counts) {
      if ((await pending) > 0) used.push(what);
    }
    if (used.length > 0) {
      throw new BadRequestException(
        `ລຶບ${labelLo}ນີ້ບໍ່ໄດ້ — ຖືກໃຊ້ຢູ່ໃນ ${used.join(', ')}. ປິດການນຳໃຊ້ແທນ.`,
      );
    }
  }

  async updateBankAccount(
    id: string,
    dto: { nameLo?: string; isActive?: boolean },
    user: AuthenticatedUser,
  ) {
    const before = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('ບໍ່ພົບບັນຊີທະນາຄານ');
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
  async deleteBankAccount(id: string, user: AuthenticatedUser) {
    const before = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('ບໍ່ພົບບັນຊີທະນາຄານ');

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

  async updateIncomeExpenseCategory(
    id: string,
    dto: { nameLo?: string; kind?: 'INCOME' | 'EXPENSE'; isActive?: boolean },
    user: AuthenticatedUser,
  ) {
    const before = await this.prisma.incomeExpenseCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) throw new NotFoundException('ບໍ່ພົບລາຍການຮັບຈ່າຍ');
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

  async deleteIncomeExpenseCategory(id: string, user: AuthenticatedUser) {
    const before = await this.prisma.incomeExpenseCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) throw new NotFoundException('ບໍ່ພົບລາຍການຮັບຈ່າຍ');

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

  async updateApArCategory(
    id: string,
    dto: { nameLo?: string; side?: 'AP' | 'AR' | 'AP_AR'; isActive?: boolean },
    user: AuthenticatedUser,
  ) {
    const before = await this.prisma.apArCashCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) throw new NotFoundException('ບໍ່ພົບປະເພດລາຍການ AP-AR');
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

  async deleteApArCategory(id: string, user: AuthenticatedUser) {
    const before = await this.prisma.apArCashCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) throw new NotFoundException('ບໍ່ພົບປະເພດລາຍການ AP-AR');

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

}
