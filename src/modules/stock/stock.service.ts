import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ApprovalStatus, type StockScope } from '@prisma/client';
import {
  checkStockOut,
  dec,
  goldTypeAverage,
  gramsToBaht,
  expectedReturnWeight,
  lineGoldWeight,
  pricePerBaht,
  type Decimal,
} from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { ApprovalService } from '../../common/services/approval.service';
import { BusinessDayService } from '../../common/services/business-day.service';
import { HistoryRangeService } from '../../common/services/history-range.service';
import type { HistoryRangeDto } from '../../common/dto/history-range.dto';
import { StockLedgerService } from '../../common/services/stock-ledger.service';
import { ApArPostingService } from '../../common/services/apar-posting.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type {
  CreateHandoverDto,
  CreateStockInDto,
  CreateStockOutDto,
  CreateTransferDto,
  FactoryAssessmentDto,
  FactoryTrackingQueryDto,
  ReviewStockDto,
  UpdateStockMovementDto,
  UpdateSkuBalanceDto,
  UpdateOldTypeBalanceDto,
  UpdateOldLedgerRowDto,
} from './dto/stock.dto';

const D = (value: Decimal) => new Prisma.Decimal(value.toFixed());
const toDec = (value: Prisma.Decimal | null | undefined) => dec(value?.toFixed() ?? 0);

/**
 * TOR §7.1 / §7.2 / §7.3 — the warehouse.
 *
 * Two rules shape this module:
 *
 *  1. A Stock OUT does not take effect when it is created. It waits for
 *     Admin/Manager approval, because an unapproved OUT that had already
 *     deducted stock would let anyone move gold out of the shop.
 *
 *  2. An OUT to FACTORY does not take effect even when approved. It parks in
 *     `FactoryOutTracking` until the factory reports the assessed weight
 *     (§7.3) — the shop does not know how much gold it has actually parted
 *     with until then.
 */
@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approval: ApprovalService,
    private readonly businessDay: BusinessDayService,
    private readonly stockLedger: StockLedgerService,
    private readonly apar: ApArPostingService,
    private readonly notifications: NotificationsService,
    private readonly range: HistoryRangeService,
  ) {}

  /* ---------------------------------------------------------------- *
   * Stock IN — §7.1 (NEW) and §7.2 (OLD)
   * ---------------------------------------------------------------- */

  /**
   * Stock IN takes effect immediately: the gold is physically in the shop, so
   * withholding it from the ledger would understate what the shop holds.
   */
  async stockIn(dto: CreateStockInDto, user: AuthenticatedUser) {
    /*
     * ຄຳເກົ່າເຂົ້າສາງ ມາຈາກ Cashier ສະເໝີ (TOR §7.1 ຕາມທີ່ລູກຄ້າແຈ້ງ): ມັນຄື
     * ຄຳທີ່ຮັບຊື້ຄືນໜ້າຮ້ານ. ບັງຄັບຢູ່ server ບໍ່ແມ່ນແຕ່ຢູ່ຟອມ, ເພື່ອບໍ່ໃຫ້
     * ຄຳເກົ່າຖືກບັນທຶກເປັນໜີ້ຕ້ອງສົ່ງຄືນໃຫ້ຜູ້ສະໜອງໂດຍບັງເອີນ.
     */
    const partner =
      dto.scope === 'OLD'
        ? await this.prisma.partnerSource.findFirst({
            where: { code: 'CASHIER', deletedAt: null },
          })
        : dto.partnerId
          ? await this.prisma.partnerSource.findFirst({
              where: { id: dto.partnerId, deletedAt: null },
            })
          : null;
    if (!partner) throw new NotFoundException('ບໍ່ພົບແຫຼ່ງທີ່ມາ');
    const partnerId = partner.id;

    const lines = dto.lines.map((line) => ({
      ...line,
      goldG: lineGoldWeight(line.weightG, line.quantity),
    }));

    const totalGoldG = lines.reduce((sum, l) => sum.plus(l.goldG), dec(0));
    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
    const totalCost = dec(dto.totalCost);

    if (totalGoldG.lte(0)) throw new BadRequestException('ນ້ຳໜັກລວມຕ້ອງໃຫຍ່ກວ່າ 0');

    // ລາຄາ/g = ຕົ້ນທຶນຄໍາ / GOLD (g)
    const perG = totalCost.div(totalGoldG);
    const day = await this.businessDay.current();
    // ຄ່າແຮງ ມີແຕ່ຝັ່ງ Stock (NEW); ຖ້າ client ເກົ່າສົ່ງມາກັບ OLD ກໍຖິ້ມ.
    const laborFeeThb = dto.scope === 'NEW' ? dec(dto.laborFeeThb ?? 0) : dec(0);

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          code: await this.nextCode(tx, 'IN'),
          scope: dto.scope,
          type: 'IN',
          partnerId,
          totalQuantity,
          totalGoldG: D(totalGoldG),
          totalCost: D(totalCost),
          pricePerG: D(perG),
          pricePerBaht: D(pricePerBaht(perG)),
          laborFeeThb: D(laborFeeThb),
          status: 'COMPLETED',
          note: dto.note ?? null,
          createdById: user.id,
          approvedById: user.id,
          approvedAt: new Date(),
          lines: {
            create: lines.map((line) => ({
              goldSkuId: line.goldSkuId ?? null,
              goldTypeId: line.goldTypeId ?? null,
              goldItemId: line.goldItemId ?? null,
              oldCategory: dto.scope === 'OLD' ? (line.oldCategory ?? null) : null,
              weightG: D(dec(line.weightG)),
              quantity: line.quantity,
              goldG: D(line.goldG),
              cost: D(line.goldG.mul(perG)),
            })),
          },
        },
        include: { lines: true },
      });

      if (dto.scope === 'NEW') {
        await this.stockLedger.postNew(tx, {
          businessDayId: day.id,
          goldInG: totalGoldG,
          priceIn: totalCost,
          partnerLabel: partner.nameLo,
          typeLabel: `IN — ${movement.code}`,
          movementId: movement.id,
          createdById: user.id,
        });
        await this.refreshSkuBalances(tx, day.id, lines, 'IN');
      } else {
        for (const line of lines) {
          if (!line.goldTypeId) continue;
          await this.stockLedger.postOld(tx, {
            goldTypeId: line.goldTypeId,
            businessDayId: day.id,
            goldInG: line.goldG,
            priceIn: line.goldG.mul(perG),
            partnerLabel: partner.nameLo,
            typeLabel: `IN — ${movement.code}`,
            movementId: movement.id,
            createdById: user.id,
          });
        }
      }

      // §8.3 — gold received creates or settles an obligation to the partner.
      await this.apar.postGold(tx, {
        scope: dto.scope,
        type: 'IN',
        partnerId,
        weightG: totalGoldG,
        cost: totalCost,
        movementId: movement.id,
        refType: 'STOCK_IN',
        createdById: user.id,
      });

      // §9.2 — ຄ່າແຮງຊ່າງ on a Stock IN is a cash payable until settled.
      if (laborFeeThb.gt(0)) {
        await this.apar.postCash(tx, {
          reason: 'LABOR_PAYABLE',
          currency: 'THB',
          amount: laborFeeThb,
          refId: movement.id,
          partnerId,
          note: `ຄ່າແຮງຊ່າງ ${movement.code}`,
          createdById: user.id,
        });
      }

      await this.audit.record(
        {
          actorId: user.id,
          action: 'CREATE',
          entity: 'StockMovement',
          entityId: movement.id,
          after: { code: movement.code, totalGoldG: totalGoldG.toFixed(), scope: dto.scope },
          summary: `Stock IN ${movement.code} — ${totalGoldG.toFixed()} g ຈາກ ${partner.nameLo}`,
        },
        tx,
      );

      return movement;
    });
  }

  /* ---------------------------------------------------------------- *
   * Stock OUT — requires Admin/Manager approval
   * ---------------------------------------------------------------- */

  async stockOut(dto: CreateStockOutDto, user: AuthenticatedUser) {
    const partner = await this.prisma.partnerSource.findFirst({
      where: { id: dto.partnerId, deletedAt: null },
    });
    if (!partner) throw new NotFoundException('ບໍ່ພົບແຫຼ່ງສົ່ງອອກ');

    const lines = dto.lines.map((line) => ({
      ...line,
      goldG: lineGoldWeight(line.weightG, line.quantity),
    }));
    const totalGoldG = lines.reduce((sum, l) => sum.plus(l.goldG), dec(0));
    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);

    if (totalGoldG.lte(0)) throw new BadRequestException('ນ້ຳໜັກລວມຕ້ອງໃຫຍ່ກວ່າ 0');

    // ⚠ §7.2: never let an OUT exceed what the bucket actually holds.
    if (dto.scope === 'OLD') {
      const byType = new Map<string, Decimal>();
      for (const line of lines) {
        if (!line.goldTypeId) continue;
        byType.set(line.goldTypeId, (byType.get(line.goldTypeId) ?? dec(0)).plus(line.goldG));
      }
      for (const [goldTypeId, requested] of byType) {
        const available = await this.stockLedger.availableOldWeight(goldTypeId);
        const check = checkStockOut(available, requested);
        if (!check.allowed) throw new BadRequestException(check.messageLo!);
      }
    } else {
      const position = await this.stockLedger.newPosition();
      const check = checkStockOut(position.weightG, totalGoldG);
      if (!check.allowed) throw new BadRequestException(check.messageLo!);
    }

    // For Stock OUT:
    // If scope is OLD, cost is based on the specific gold type balance from stockOldTypeBalance.
    // If scope is NEW, cost is based on WAC.
    let perG: Decimal;
    let totalCost: Decimal;
    const lineCosts: Decimal[] = [];

    if (dto.scope === 'OLD') {
      let accumulatedCost = dec(0);
      for (const line of lines) {
        if (!line.goldTypeId) {
          lineCosts.push(dec(0));
          continue;
        }
        const balance = await this.prisma.stockOldTypeBalance.findFirst({
          where: { goldTypeId: line.goldTypeId },
          orderBy: { updatedAt: 'desc' },
        });
        const closingWeight = toDec(balance?.closingWeightG);
        const closingCost = toDec(balance?.closingCost);
        let typeRate = dec(0);
        if (closingWeight.gt(0) && closingCost.gt(0)) {
          typeRate = closingCost.div(closingWeight);
        } else {
          const opWeight = toDec(balance?.openingWeightG);
          const opCost = toDec(balance?.openingCost);
          if (opWeight.gt(0) && opCost.gt(0)) {
            typeRate = opCost.div(opWeight);
          } else {
            typeRate = (await this.stockLedger.currentWac()).pricePerG;
          }
        }
        const lineCost = line.goldG.mul(typeRate);
        lineCosts.push(lineCost);
        accumulatedCost = accumulatedCost.plus(lineCost);
      }
      totalCost = accumulatedCost;
      perG = totalGoldG.gt(0) ? totalCost.div(totalGoldG) : dec(0);
    } else {
      const newPos = await this.stockLedger.newPosition();
      perG = newPos.weightG.gt(0) ? newPos.cost.div(newPos.weightG) : dec(0);
      totalCost = totalGoldG.mul(perG);
      for (const line of lines) {
        lineCosts.push(line.goldG.mul(perG));
      }
    }

    const isFactory =
      dto.scope === 'OLD' &&
      (partner.type === 'FACTORY' || (!partner.type && partner.code === 'FACTORY'));

    const effectiveGoldPercent = isFactory ? null : (dto.goldPercent ? dec(dto.goldPercent) : null);

    const movement = await this.prisma.stockMovement.create({
      data: {
        code: await this.nextCode(this.prisma, 'OUT'),
        scope: dto.scope,
        type: 'OUT',
        partnerId: dto.partnerId,
        cabinetId: dto.cabinetId ?? null,
        transformType: dto.transformType ?? null,
        goldPercent: effectiveGoldPercent ? D(effectiveGoldPercent) : null,
        expectedReturnG: effectiveGoldPercent ? D(expectedReturnWeight(totalGoldG, effectiveGoldPercent)) : null,
        totalQuantity,
        totalGoldG: D(totalGoldG),
        totalCost: D(totalCost),
        pricePerG: D(perG),
        pricePerBaht: D(pricePerBaht(perG)),
        status: 'PENDING',
        note: dto.note ?? null,
        createdById: user.id,
        lines: {
          create: lines.map((line, idx) => ({
            goldSkuId: line.goldSkuId ?? null,
            goldTypeId: line.goldTypeId ?? null,
            weightG: D(dec(line.weightG)),
            quantity: line.quantity,
            goldG: D(line.goldG),
            cost: D(lineCosts[idx]),
          })),
        },
      },
      include: { lines: true },
    });

    await this.audit.record({
      actorId: user.id,
      action: 'CREATE',
      entity: 'StockMovement',
      entityId: movement.id,
      after: { code: movement.code, totalGoldG: totalGoldG.toFixed() },
      summary: `ຮ້ອງຂໍ Stock OUT ${movement.code} — ${totalGoldG.toFixed()} g ໄປ ${partner.nameLo}`,
    });

    /*
     * ທັງ Admin ແລະ Manager ອະນຸມັດ Stock OUT ໄດ້ (TOR §7.2) ແຕ່ການແຈ້ງເຕືອນ
     * ຮັບໄດ້ Role ດຽວຕໍ່ແຖວ — ສົ່ງສອງແຖວ, ບໍ່ດັ່ງນັ້ນ Manager ຈະບໍ່ເຫັນກະດິ່ງ
     * ແລະ ລາຍການຈະຄ້າງລໍຖ້າໂດຍບໍ່ມີໃຜຮູ້.
     */
    for (const recipientRole of ['ADMIN', 'MANAGER'] as const) {
      await this.notifications.notify({
        kind: 'STOCK_OUT_APPROVAL',
        recipientRole,
        title: 'ມີ Stock OUT ລໍຖ້າອະນຸມັດ',
        body: `${movement.code} — ${totalGoldG.toFixed()} g ໄປ ${partner.nameLo}`,
        refType: 'StockMovement',
        refId: movement.id,
      });
    }

    return movement;
  }

  /**
   * Admin/Manager approves a Stock OUT.
   *
   * For every destination except FACTORY the stock moves here. For FACTORY it
   * does NOT: the row is parked in FactoryOutTracking until the assessed
   * weight comes back (§7.3).
   */
  async reviewOut(id: string, dto: ReviewStockDto, user: AuthenticatedUser) {
    const movement = await this.prisma.stockMovement.findFirst({
      where: { id, deletedAt: null },
      include: { lines: true, partner: true },
    });
    if (!movement) throw new NotFoundException('ບໍ່ພົບລາຍການ');
    if (!movement.partner) throw new BadRequestException('ລາຍການນີ້ບໍ່ມີແຫຼ່ງສົ່ງອອກ');

    const next: ApprovalStatus = dto.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    this.approval.assertTransition(movement.status, next);

    const day = await this.businessDay.current();
    const isFactory =
      movement.scope === 'OLD' &&
      (movement.partner.type === 'FACTORY' ||
        (!movement.partner.type && movement.partner.code === 'FACTORY'));

    return this.prisma.$transaction(async (tx) => {
      if (dto.decision === 'APPROVED') {
        if (isFactory) {
          // §7.3 — park it; nothing is deducted yet.
          await tx.factoryOutTracking.create({
            data: {
              movementId: movement.id,
              partnerId: movement.partnerId!,
              goldOutG: movement.totalGoldG,
              cost: movement.totalCost,
              status: 'AWAITING_ASSESSMENT',
            },
          });

          await this.notifications.notify(
            {
              kind: 'FACTORY_ASSESSMENT',
              recipientRole: 'WAREHOUSE',
              title: 'ລໍຖ້າ FACTORY ປະເມີນນ້ຳໜັກ',
              body: `${movement.code} — ${movement.totalGoldG.toFixed()} g`,
              refType: 'StockMovement',
              refId: movement.id,
            },
            tx,
          );
        } else {
          await this.applyOut(tx, movement, day.id, user.id);
        }
      }

      const updated = await tx.stockMovement.update({
        where: { id },
        data: {
          // A FACTORY OUT stays APPROVED until §7.3 completes it.
          status: dto.decision === 'APPROVED' ? (isFactory ? 'APPROVED' : 'COMPLETED') : 'REJECTED',
          approvedById: user.id,
          approvedAt: new Date(),
          rejectReason: dto.decision === 'REJECTED' ? (dto.reason ?? null) : null,
        },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
          entity: 'StockMovement',
          entityId: id,
          before: { status: movement.status },
          after: { status: updated.status },
          summary: `${dto.decision === 'APPROVED' ? 'ອະນຸມັດ' : 'ປະຕິເສດ'} Stock OUT ${movement.code}`,
        },
        tx,
      );

      return updated;
    });
  }

  /** Deduct the stock and post the AP/AR (GOLD) side of an approved OUT. */
  private async applyOut(
    tx: Prisma.TransactionClient,
    movement: Prisma.StockMovementGetPayload<{ include: { lines: true; partner: true } }>,
    businessDayId: string,
    userId: string,
  ) {
    const totalGoldG = toDec(movement.totalGoldG);
    const totalCost = toDec(movement.totalCost);

    if (movement.scope === 'NEW') {
      await this.stockLedger.postNew(tx, {
        businessDayId,
        goldOutG: totalGoldG,
        priceOut: totalCost,
        partnerLabel: movement.partner?.nameLo,
        typeLabel: `OUT — ${movement.code}`,
        movementId: movement.id,
        createdById: userId,
      });
      await this.refreshSkuBalances(
        tx,
        businessDayId,
        movement.lines.map((l) => ({
          goldSkuId: l.goldSkuId ?? undefined,
          quantity: l.quantity,
          weightG: l.weightG.toFixed(),
        })),
        'OUT',
      );
    } else {
      for (const line of movement.lines) {
        if (!line.goldTypeId) continue;
        await this.stockLedger.postOld(tx, {
          goldTypeId: line.goldTypeId,
          businessDayId,
          goldOutG: toDec(line.goldG),
          priceOut: toDec(line.cost),
          partnerLabel: movement.partner?.nameLo,
          typeLabel: `OUT — ${movement.code}`,
          movementId: movement.id,
          createdById: userId,
        });
      }
    }

    if (movement.partnerId) {
      const aparWeight = movement.expectedReturnG
        ? toDec(movement.expectedReturnG)
        : totalGoldG;

      await this.apar.postGold(tx, {
        scope: movement.scope as StockScope,
        type: 'OUT',
        partnerId: movement.partnerId,
        weightG: aparWeight,
        cost: totalCost,
        movementId: movement.id,
        refType: 'STOCK_OUT',
        createdById: userId,
      });
    }
  }

  /* ---------------------------------------------------------------- *
   * §7.3 — ຕິດຕາມ Stock Out ໄປ FACTORY
   * ---------------------------------------------------------------- */

  /**
   * ລາຍການຕິດຕາມ FACTORY (TOR §7.3).
   *
   * ສົ່ງ ປະເພດຄຳ ແລະ ຜູ້ອັບເດດ ມານຳ: ແຖວໜຶ່ງອາດມີຫຼາຍປະເພດຄຳ (OUT ຮັບຫຼາຍ
   * ປະເພດໃນລາຍການດຽວ), ສະນັ້ນສົ່ງເປັນລາຍການ ບໍ່ແມ່ນຄ່າດຽວ. ຊື່ຜູ້ອັບເດດ
   * ດຶງເປັນ query ດຽວຕໍ່ໜ້າ ບໍ່ແມ່ນ join ຕໍ່ແຖວ.
   */
  async listFactoryTracking(query: FactoryTrackingQueryDto, user?: AuthenticatedUser) {
    const range = this.range.resolve(query, user);

    /*
     * ຄິວລໍຖ້າປະເມີນ ບໍ່ແມ່ນລາຍການປະຫວັດ — ມັນຍັງຄ້າງຢູ່ຈົນກວ່າ FACTORY ຈະຕອບ,
     * ເຊິ່ງອາດເປັນອາທິດ. ຖ້າເອົາຊ່ວງວັນທີເລີ່ມຕົ້ນ (= ມື້ນີ້) ມາກອງມັນ ແຖວທີ່
     * ອະນຸມັດມື້ວານຈະຫາຍໄປທັນທີທີ່ຂຶ້ນມື້ໃໝ່ ທັງທີ່ຍັງບໍ່ທັນໄດ້ເຮັດ.
     *
     * ສະນັ້ນ: ຂໍຄິວມາລ້າໆ (`status=AWAITING_ASSESSMENT` ບໍ່ມີວັນທີ) = ເອົາທຸກແຖວ
     * ທີ່ຍັງຄ້າງ. ຖ້າຜູ້ໃຊ້ລະບຸວັນທີເອງ ກໍ່ກອງຕາມນັ້ນ — ບໍ່ມີການມິດງຽບ.
     */
    const explicitRange = Boolean(
      query.from_date ?? query.fromDate ?? query.to_date ?? query.toDate,
    );
    const openQueue = query.status === 'AWAITING_ASSESSMENT' && !explicitRange;

    const where: Prisma.FactoryOutTrackingWhereInput = {
      ...(openQueue ? {} : { createdAt: HistoryRangeService.window(range) }),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.factoryOutTracking.findMany({
        where,
        include: {
          movement: {
            include: { lines: { include: { goldType: true } }, partner: true },
          },
          partner: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: range.skip,
        take: range.take,
      }),
      this.prisma.factoryOutTracking.count({ where }),
    ]);

    /*
     * ຜູ້ບັນທຶກ = ຜູ້ທີ່ສ້າງລາຍການສົ່ງຄຳອອກ FACTORY (ຢູ່ຕາຕະລາງ StockMovement),
     * ສ່ວນ ຜູ້ແກ້ໄຂ = ຜູ້ປ້ອນນ້ຳໜັກທີ່ FACTORY ປະເມີນ. ສອງຄົນນີ້ມັກຕ່າງກັນ
     * ຈຶ່ງສະແດງທັງສອງ.
     */
    const actorIds = [
      ...new Set(
        rows
          .flatMap((r) => [r.updatedById, r.movement.createdById])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const nameById = new Map(actors.map((u) => [u.id, u.fullName]));

    return this.range.page(
      rows.map((row) => ({
        ...row,
        createdBy: nameById.get(row.movement.createdById) ?? '—',
        updatedBy: row.updatedById ? (nameById.get(row.updatedById) ?? '—') : '—',
        goldTypesLo: [
          ...new Set(
            row.movement.lines
              .map((l) => l.goldType?.nameLo)
              .filter((n): n is string => Boolean(n)),
          ),
        ].join(', '),
      })),
      total,
      range,
    );
  }

  /**
   * ອັບເດດ ນໍ້າໜັກg FACTORY ປະເມີນ.
   *
   * This is where a FACTORY OUT finally takes effect: Stock (OLD) is deducted
   * at the weight KPV sent, and AP/AR (GOLD) is booked at the weight FACTORY
   * acknowledged. The two differ by the melt loss, which is precisely the
   * discrepancy the shop needs visible.
   *
   * Once COMPLETED only ADMIN/MANAGER may edit — enforced on the controller.
   */
  async recordFactoryAssessment(
    id: string,
    dto: FactoryAssessmentDto,
    user: AuthenticatedUser,
  ) {
    const tracking = await this.prisma.factoryOutTracking.findUnique({
      where: { id },
      include: { movement: { include: { lines: true, partner: true } } },
    });
    if (!tracking) throw new NotFoundException('ບໍ່ພົບລາຍການຕິດຕາມ');

    const assessed = dec(dto.factoryAssessedG);
    if (assessed.gt(toDec(tracking.goldOutG))) {
      throw new BadRequestException(
        `ນ້ຳໜັກທີ່ FACTORY ປະເມີນ (${assessed.toFixed()} g) ຕ້ອງບໍ່ເກີນ ຄຳເກົ່າອອກລວມ (${toDec(tracking.goldOutG).toFixed()} g)`,
      );
    }
    if (!assessed.isFinite() || assessed.lte(0)) {
      throw new BadRequestException('ນ້ຳໜັກທີ່ FACTORY ປະເມີນຕ້ອງໃຫຍ່ກວ່າ 0');
    }
    if (assessed.gt(toDec(tracking.goldOutG))) {
      throw new BadRequestException(
        `ນ້ຳໜັກທີ່ FACTORY ປະເມີນ (${assessed.toFixed()} g) ຕ້ອງບໍ່ເກີນ ຄຳເກົ່າອອກລວມ (${toDec(tracking.goldOutG).toFixed()} g)`,
      );
    }

    const wasCompleted = tracking.status === 'COMPLETED';
    const day = await this.businessDay.current();

    return this.prisma.$transaction(async (tx) => {
      // Only the first completion posts; later edits by Admin correct the
      // recorded figure without double-deducting the stock.
      if (!wasCompleted) {
        for (const line of tracking.movement.lines) {
          if (!line.goldTypeId) continue;
          await this.stockLedger.postOld(tx, {
            goldTypeId: line.goldTypeId,
            businessDayId: day.id,
            goldOutG: toDec(line.goldG),
            priceOut: toDec(line.cost),
            partnerLabel: tracking.movement.partner?.nameLo ?? 'FACTORY',
            typeLabel: `OUT FACTORY — ${tracking.movement.code}`,
            movementId: tracking.movementId,
            createdById: user.id,
          });
        }

        await this.apar.postGold(tx, {
          scope: 'OLD',
          type: 'OUT',
          partnerId: tracking.partnerId,
          weightG: assessed,
          cost: toDec(tracking.cost),
          movementId: tracking.movementId,
          refType: 'FACTORY_ASSESSED',
          note: `FACTORY ປະເມີນ ${assessed.toFixed()} g ຈາກ ${tracking.goldOutG.toFixed()} g`,
          createdById: user.id,
        });

        await tx.stockMovement.update({
          where: { id: tracking.movementId },
          data: { status: 'COMPLETED' },
        });
      }

      const updated = await tx.factoryOutTracking.update({
        where: { id },
        data: {
          factoryAssessedG: D(assessed),
          status: 'COMPLETED',
          completedAt: tracking.completedAt ?? new Date(),
          updatedById: user.id,
        },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: wasCompleted ? 'UPDATE' : 'COMPLETE',
          entity: 'FactoryOutTracking',
          entityId: id,
          before: { factoryAssessedG: tracking.factoryAssessedG?.toFixed() ?? null },
          after: { factoryAssessedG: assessed.toFixed() },
          summary: wasCompleted
            ? `ແກ້ໄຂນ້ຳໜັກ FACTORY ປະເມີນ ${tracking.movement.code} = ${assessed.toFixed()} g`
            : `FACTORY ປະເມີນ ${tracking.movement.code} = ${assessed.toFixed()} g`,
        },
        tx,
      );

      return updated;
    });
  }

  /* ---------------------------------------------------------------- *
   * Transfer NEW <-> OLD (§7.1, §7.2)
   * ---------------------------------------------------------------- */

  async transfer(dto: CreateTransferDto, user: AuthenticatedUser) {
    const totalGoldG = dto.lines.reduce(
      (sum, line) => sum.plus(lineGoldWeight(line.weightG, line.quantity)),
      dec(0),
    );
    if (totalGoldG.lte(0)) throw new BadRequestException('ນ້ຳໜັກລວມຕ້ອງໃຫຍ່ກວ່າ 0');

    const from: StockScope = dto.direction === 'NEW_TO_OLD' ? 'NEW' : 'OLD';

    if (from === 'OLD') {
      const available = await this.stockLedger.availableOldWeight(dto.goldTypeId);
      const check = checkStockOut(available, totalGoldG);
      if (!check.allowed) throw new BadRequestException(check.messageLo!);
    } else {
      const position = await this.stockLedger.newPosition();
      const check = checkStockOut(position.weightG, totalGoldG);
      if (!check.allowed) throw new BadRequestException(check.messageLo!);
    }

    let perG: Decimal;
    let totalCost: Decimal;

    if (from === 'OLD') {
      const balance = await this.prisma.stockOldTypeBalance.findFirst({
        where: { goldTypeId: dto.goldTypeId },
        orderBy: { updatedAt: 'desc' },
      });
      const closingWeight = toDec(balance?.closingWeightG);
      const closingCost = toDec(balance?.closingCost);
      if (closingWeight.gt(0) && closingCost.gt(0)) {
        perG = closingCost.div(closingWeight);
      } else {
        const opWeight = toDec(balance?.openingWeightG);
        const opCost = toDec(balance?.openingCost);
        if (opWeight.gt(0) && opCost.gt(0)) {
          perG = opCost.div(opWeight);
        } else {
          perG = (await this.stockLedger.currentWac()).pricePerG;
        }
      }
      totalCost = totalGoldG.mul(perG);
    } else {
      const newPos = await this.stockLedger.newPosition();
      perG = newPos.weightG.gt(0) ? newPos.cost.div(newPos.weightG) : dec(0);
      totalCost = totalGoldG.mul(perG);
    }
    const day = await this.businessDay.current();

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          code: await this.nextCode(tx, 'TR'),
          scope: from,
          type: 'TRANSFER',
          totalQuantity: dto.lines.reduce((sum, l) => sum + l.quantity, 0),
          totalGoldG: D(totalGoldG),
          totalCost: D(totalCost),
          pricePerG: D(perG),
          pricePerBaht: D(pricePerBaht(perG)),
          status: 'COMPLETED',
          note: dto.note ?? null,
          createdById: user.id,
          approvedById: user.id,
          approvedAt: new Date(),
          lines: {
            create: dto.lines.map((line) => ({
              goldSkuId: line.goldSkuId ?? null,
              goldTypeId: dto.goldTypeId,
              weightG: D(dec(line.weightG)),
              quantity: line.quantity,
              goldG: D(lineGoldWeight(line.weightG, line.quantity)),
              cost: D(lineGoldWeight(line.weightG, line.quantity).mul(perG)),
            })),
          },
        },
      });

      // A transfer is one movement with two legs: out of one warehouse and
      // into the other, at the same weight and cost, so total holdings are
      // unchanged.
      if (from === 'NEW') {
        await this.stockLedger.postNew(tx, {
          businessDayId: day.id,
          goldOutG: totalGoldG,
          priceOut: totalCost,
          typeLabel: `Transfer NEW→OLD — ${movement.code}`,
          movementId: movement.id,
          createdById: user.id,
        });
        await this.refreshSkuBalances(tx, day.id, dto.lines, 'OUT');
        await this.stockLedger.postOld(tx, {
          goldTypeId: dto.goldTypeId,
          businessDayId: day.id,
          goldInG: totalGoldG,
          priceIn: totalCost,
          typeLabel: `Transfer NEW→OLD — ${movement.code}`,
          movementId: movement.id,
          createdById: user.id,
        });
      } else {
        await this.stockLedger.postOld(tx, {
          goldTypeId: dto.goldTypeId,
          businessDayId: day.id,
          goldOutG: totalGoldG,
          priceOut: totalCost,
          typeLabel: `Transfer OLD→NEW — ${movement.code}`,
          movementId: movement.id,
          createdById: user.id,
        });
        await this.stockLedger.postNew(tx, {
          businessDayId: day.id,
          goldInG: totalGoldG,
          priceIn: totalCost,
          typeLabel: `Transfer OLD→NEW — ${movement.code}`,
          movementId: movement.id,
          createdById: user.id,
        });
        await this.refreshSkuBalances(tx, day.id, dto.lines, 'IN');
      }

      await this.audit.record(
        {
          actorId: user.id,
          action: 'CREATE',
          entity: 'StockMovement',
          entityId: movement.id,
          summary: `Transfer ${dto.direction} ${movement.code} — ${totalGoldG.toFixed()} g`,
        },
        tx,
      );

      return movement;
    });
  }

  /* ---------------------------------------------------------------- *
   * §4.3 — ມອບຄຳລະຫວ່າງມື້
   * ---------------------------------------------------------------- */

  /**
   * ມອບຄຳລະຫວ່າງມື້ — ສອງຮູບແບບ ຕາມທີ່ລູກຄ້າໃຊ້ຢູ່ໜ້າຮ້ານ:
   *
   *  ຄຳດີ / ຄຳຫຍຸບ / ແທ່ງ — ຊັ່ງເປັນຮອບ: ນ້ຳໜັກອອກ ແຍກເປັນ ເນື້ອລ້ວນ + ມີແກ້ວ,
   *  ສ່ວນທີ່ເຫຼືອເປັນ ຂາດດຸ. ຂາດດຸ ຄຳນວນຢູ່ server ບໍ່ແມ່ນຮັບມາຈາກຟອມ, ຈຶ່ງ
   *  ບໍ່ມີທາງທີ່ຕົວເລກໃນບິນຈະບໍ່ກົງກັບສູດ.
   *
   *  ຄຳຕົ້ມ — ມອບເປັນລາຍການ: ເລືອກ Buyback ຄຳຕົ້ມ ທີ່ຍັງບໍ່ໄດ້ມອບ ຫຼາຍລາຍການ
   *  ຕໍ່ຄັ້ງ ແລະ ບໍ່ໄລ່ເປັນຮອບ (ຕາມທີ່ລູກຄ້າແຈ້ງ).
   */
  async createHandover(dto: CreateHandoverDto, user: AuthenticatedUser, shiftId: string) {
    // ຮອບດຽວມອບ ຄຳດີ + ຄຳຫຍຸບ + ແທ່ງ ພ້ອມກັນໄດ້ (TOR §4.2 ຕາມແບບທີ່ລູກຄ້າໃຫ້).
    if (dto.lines?.length) return this.createHandoverRound(dto, user, shiftId);

    if (!dto.goldTypeId) throw new BadRequestException('ຕ້ອງເລືອກປະເພດຄຳ');
    const goldType = await this.prisma.goldType.findFirst({
      where: { id: dto.goldTypeId, deletedAt: null },
    });
    if (!goldType) throw new NotFoundException('ບໍ່ພົບປະເພດຄຳທີ່ເລືອກ');

    /*
     * ຮູບແບບເກົ່າ (ປະເພດດຽວ, ນ້ຳໜັກຢູ່ລະດັບເທິງ) ຖືກແປງເປັນຮອບທີ່ມີແຖວດຽວ —
     * ກົດການກວດ ແລະ ການຄິດຕົ້ນທຶນຈຶ່ງມີຊຸດດຽວ ບໍ່ແມ່ນສອງຊຸດທີ່ຂັດກັນ.
     */
    if (goldType.code !== 'BOILED') {
      return this.createHandoverRound(
        {
          ...dto,
          lines: [
            {
              goldTypeId: goldType.id,
              outWeightG: dto.grossWeightG ?? dto.weightG ?? '0',
              pureWeightG: dto.pureWeightG,
              glassWeightG: dto.glassWeightG,
            },
          ],
        },
        user,
        shiftId,
      );
    }

    const day = await this.businessDay.current();

    // ── ຄຳຕົ້ມ: ນ້ຳໜັກມາຈາກລາຍການທີ່ເລືອກ, ບໍ່ແມ່ນຈາກຊ່ອງປ້ອນ
    let items: Array<{
      buybackId: string;
      weightG: Prisma.Decimal;
      quantity: number;
      goldPercent: Prisma.Decimal | null;
      payableAmount: Prisma.Decimal;
    }> = [];
    let weightG: Decimal;

    {
      const ids = [...new Set(dto.buybackIds ?? [])];
      if (ids.length === 0) {
        throw new BadRequestException('ຄຳຕົ້ມ ຕ້ອງເລືອກລາຍການຄຳເກົ່າທີ່ຮັບຊື້ຄືນ');
      }

      const rows = await this.prisma.buyback.findMany({
        where: {
          id: { in: ids },
          deletedAt: null,
          status: 'COMPLETED',
          goldTypeId: goldType.id,
          handoverItem: null,
        },
        select: {
          id: true, weightG: true, quantity: true,
          goldPercent: true, payableAmount: true,
        },
      });
      if (rows.length !== ids.length) {
        throw new BadRequestException(
          'ມີລາຍການທີ່ມອບແລ້ວ ຫຼື ບໍ່ຢູ່ໃນເງື່ອນໄຂ — ກະລຸນາໂຫຼດລາຍການຄືນ',
        );
      }

      items = rows.map((r) => ({
        buybackId: r.id,
        weightG: r.weightG,
        quantity: r.quantity,
        goldPercent: r.goldPercent,
        payableAmount: r.payableAmount,
      }));
      /*
       * `Buyback.weightG` ເປັນ "ຍອດລວມຂອງບິນ" ຢູ່ແລ້ວ (Σ ນ້ຳໜັກ × ຈຳນວນ
       * ຂອງທຸກແຖວ) ຕັ້ງແຕ່ບິນດຽວມີຫຼາຍແຖວໄດ້ — ຄູນດ້ວຍ `quantity` ຂອງຫົວບິນ
       * ອີກເທື່ອ ຈະນັບສອງເທື່ອ.
       */
      weightG = rows.reduce((sum, r) => sum.plus(toDec(r.weightG)), dec(0));
    }

    // ຕົ້ນທຶນເຂົ້າສາງ ຂອງ ຄຳຕົ້ມ = ລາຄາທີ່ຈ່າຍຂອງລາຍການທີ່ເລືອກ (ບໍ່ແມ່ນສະເລ່ຍ).
    const warehouseCost = items.reduce((sum, i) => sum.plus(toDec(i.payableAmount)), dec(0));

    const handover = await this.prisma.$transaction(async (tx) =>
      // ຄຳຕົ້ມ ບໍ່ໄລ່ເປັນຮອບ => roundNo ປະໄວ້ null.
      tx.goldHandover.create({
        data: {
          code: await this.nextCode(tx, 'HO'),
          shiftId,
          businessDayId: day.id,
          goldTypeId: goldType.id,
          roundNo: null,
          weightG: D(weightG),
          warehouseCost: D(warehouseCost),
          note: dto.note ?? null,
          status: 'PENDING',
          createdById: user.id,
          items: { create: items },
        },
        include: { items: true, goldType: true },
      }),
    );

    await this.notifications.notify({
      kind: 'GOLD_HANDOVER',
      recipientRole: 'WAREHOUSE',
      title: 'ມີການມອບຄຳລະຫວ່າງມື້',
      body: `${handover.code} — ${goldType.nameLo} ${items.length} ລາຍການ — ${weightG.toFixed()} g`,
      refType: 'GoldHandover',
      refId: handover.id,
    });

    return handover;
  }

  /**
   * ສະເລ່ຍ ກີບ/g ທີ່ຮັບມາຈາກຜູ້ປະເມີນໃນມື້ການຄ້ານີ້ ແຍກຕາມປະເພດຄຳ.
   *
   * ອ່ານຈາກ `buyback_lines` ບ່ອນດຽວ ຄືກັນກັບຕາຕະລາງສະຫຼຸບ ສະນັ້ນ ຕົ້ນທຶນ
   * ເຂົ້າສາງ ກັບ ສະເລ່ຍ/g ທີ່ສະແດງຢູ່ໜ້າຈໍ ຈຶ່ງມາຈາກຕົວເລກຊຸດດຽວກັນ.
   */
  private async receivedAverageByType(): Promise<Map<string, Decimal>> {
    const from = BusinessDayService.localMidnight();
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    const lines = await this.prisma.buybackLine.findMany({
      where: {
        buyback: { deletedAt: null, status: 'COMPLETED', createdAt: { gte: from, lt: to } },
      },
      select: { goldTypeId: true, weightG: true, quantity: true, payableAmount: true },
    });

    const weight = new Map<string, Decimal>();
    const paid = new Map<string, Decimal>();
    for (const line of lines) {
      const w = toDec(line.weightG).mul(line.quantity);
      weight.set(line.goldTypeId, (weight.get(line.goldTypeId) ?? dec(0)).plus(w));
      paid.set(line.goldTypeId, (paid.get(line.goldTypeId) ?? dec(0)).plus(toDec(line.payableAmount)));
    }

    const average = new Map<string, Decimal>();
    for (const [goldTypeId, w] of weight) {
      if (w.gt(0)) average.set(goldTypeId, (paid.get(goldTypeId) ?? dec(0)).div(w));
    }
    return average;
  }

  /** ຕົ້ນທຶນເຂົ້າສາງ ຂອງນ້ຳໜັກກ້ອນໜຶ່ງ. ຍັງບໍ່ມີການຮັບຊື້ໃນມື້ => null. */
  private async warehouseCostFor(goldTypeId: string, weightG: Decimal): Promise<Decimal | null> {
    const average = (await this.receivedAverageByType()).get(goldTypeId);
    return average ? weightG.mul(average) : null;
  }

  /**
   * ມອບຄຳເປັນ "ຮອບ" — ຮອບດຽວມີໄດ້ຫຼາຍປະເພດຄຳ.
   *
   * ເກັບເປັນແຖວລະປະເພດຄຳ ແຕ່ແບ່ງ ຮອບທີ ອັນດຽວກັນ: ສາງຮັບ/ປະຕິເສດເປັນລາຍ
   * ປະເພດໄດ້ ແລະ ການລົງສາງກໍຍັງແຍກຕາມປະເພດຄຳຄືເກົ່າ, ແຕ່ໃບພິມ ແລະ ຕາຕະລາງ
   * ຍັງອ່ານເປັນຮອບດຽວ ຕາມແບບທີ່ລູກຄ້າໃຫ້ມາ.
   */
  private async createHandoverRound(
    dto: CreateHandoverDto,
    user: AuthenticatedUser,
    shiftId: string,
  ) {
    const lines = dto.lines ?? [];
    const ids = lines.map((l) => l.goldTypeId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('ປະເພດຄຳຊ້ຳກັນໃນຮອບດຽວບໍ່ໄດ້');
    }

    const goldTypes = await this.prisma.goldType.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
    if (goldTypes.length !== new Set(ids).size) {
      throw new NotFoundException('ບໍ່ພົບປະເພດຄຳທີ່ເລືອກ');
    }
    const byId = new Map(goldTypes.map((t) => [t.id, t]));

    const average = await this.receivedAverageByType();
    const prepared = lines.map((line) => {
      const goldType = byId.get(line.goldTypeId)!;
      if (goldType.code === 'BOILED') {
        throw new BadRequestException('ຄຳຕົ້ມ ມອບເປັນລາຍການ ບໍ່ແມ່ນເປັນຮອບ');
      }

      const out = dec(line.outWeightG);
      if (!out.isFinite() || out.lte(0)) {
        throw new BadRequestException(`${goldType.nameLo}: ນ້ຳໜັກລວມອອກຕ້ອງໃຫຍ່ກວ່າ 0`);
      }

      const pure = dec(line.pureWeightG ?? 0);
      const glass = dec(line.glassWeightG ?? 0);
      if (!pure.isFinite() || pure.isNegative() || !glass.isFinite() || glass.isNegative()) {
        throw new BadRequestException(`${goldType.nameLo}: ເນື້ອລ້ວນ ແລະ ມີແກ້ວ ຕ້ອງບໍ່ຕິດລົບ`);
      }

      /*
       * ເນື້ອລ້ວນ + ມີແກ້ວ ຕ້ອງບໍ່ນ້ອຍກວ່າ ນ້ຳໜັກລວມອອກ (ຕາມແບບທີ່ລູກຄ້າໃຫ້):
       * ຫຼາຍກວ່າໄດ້ ເພາະຊັ່ງແຍກສ່ວນມັກໄດ້ເກີນ, ແຕ່ນ້ອຍກວ່າແປວ່າຊັ່ງຕົກ.
       * ສຳລັບ ຄຳແທ່ງ ບໍ່ແຍກເນື້ອລ້ວນ/ມີແກ້ວ ຈຶ່ງຂ້າມການກວດນີ້.
       */
      const split = pure.gt(0) || glass.gt(0);
      if (split && pure.plus(glass).lt(out)) {
        throw new BadRequestException(
          `${goldType.nameLo}: ເນື້ອລ້ວນ + ມີແກ້ວ (${pure.plus(glass).toFixed()} g) ນ້ອຍກວ່ານ້ຳໜັກລວມອອກ (${out.toFixed()} g)`,
        );
      }

      const perGram = average.get(goldType.id);
      return {
        goldType,
        out,
        pure: split ? pure : null,
        glass: split ? glass : null,
        /** ຂາດດຸ = ນ້ຳໜັກລວມອອກ − (ເນື້ອລ້ວນ + ມີແກ້ວ) — ຄຳນວນຢູ່ server. */
        shortfall: split ? out.minus(pure).minus(glass) : null,
        cost: perGram ? out.mul(perGram) : null,
      };
    });

    const day = await this.businessDay.current();
    const created = await this.prisma.$transaction(async (tx) => {
      const last = await tx.goldHandover.aggregate({
        where: { businessDayId: day.id, roundNo: { not: null } },
        _max: { roundNo: true },
      });
      const roundNo = (last._max.roundNo ?? 0) + 1;

      const rows = [];
      for (const line of prepared) {
        rows.push(
          await tx.goldHandover.create({
            data: {
              code: await this.nextCode(tx, 'HO'),
              shiftId,
              businessDayId: day.id,
              goldTypeId: line.goldType.id,
              roundNo,
              weightG: D(line.out),
              grossWeightG: D(line.out),
              pureWeightG: line.pure ? D(line.pure) : null,
              glassWeightG: line.glass ? D(line.glass) : null,
              shortfallG: line.shortfall ? D(line.shortfall) : null,
              warehouseCost: line.cost ? D(line.cost) : null,
              note: dto.note ?? null,
              status: 'PENDING',
              createdById: user.id,
            },
            include: { items: true, goldType: true },
          }),
        );
      }
      return rows;
    });

    const totalG = prepared.reduce((sum, l) => sum.plus(l.out), dec(0));
    await this.notifications.notify({
      kind: 'GOLD_HANDOVER',
      recipientRole: 'WAREHOUSE',
      title: 'ມີການມອບຄຳລະຫວ່າງມື້',
      body: `ຮອບທີ ${created[0].roundNo} — ${prepared.map((l) => l.goldType.nameLo).join(', ')} — ${totalG.toFixed()} g`,
      refType: 'GoldHandover',
      refId: created[0].id,
    });

    return { roundNo: created[0].roundNo, rows: created };
  }

  /** Warehouse approves; the gold enters Stock (OLD) at zero added cost —
   *  it was already paid for by the Buyback that brought it in. */
  async reviewHandover(id: string, dto: ReviewStockDto, user: AuthenticatedUser) {
    const handover = await this.prisma.goldHandover.findFirst({
      where: { id, deletedAt: null },
    });
    if (!handover) throw new NotFoundException('ບໍ່ພົບລາຍການມອບຄຳ');

    const next: ApprovalStatus = dto.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    this.approval.assertTransition(handover.status, next);

    const day = await this.businessDay.current();

    return this.prisma.$transaction(async (tx) => {
      /*
       * ປະຕິເສດແລ້ວ ລາຍການຄຳຕົ້ມຕ້ອງກັບໄປຢູ່ "ລໍຖ້າມອບ" ເພື່ອມອບໃໝ່ໄດ້.
       *
       * "ຍັງບໍ່ໄດ້ມອບ" ອ່ານຈາກການບໍ່ມີ GoldHandoverItem ແລະ `buybackId` ເປັນ
       * unique — ຖ້າປະແຖວນັ້ນໄວ້ ຄຳຈະຄ້າງ: ມອບຄືນບໍ່ໄດ້ຕະຫຼອດໄປ. ຫົວບິນການ
       * ມອບຍັງຢູ່ຄົບ (ລະຫັດ, ສະຖານະ, ເຫດຜົນ, ນ້ຳໜັກ) ສຳລັບການກວດສອບ.
       */
      if (dto.decision === 'REJECTED') {
        await tx.goldHandoverItem.deleteMany({ where: { handoverId: id } });
      }

      const updated = await tx.goldHandover.update({
        where: { id },
        data: {
          status: next,
          approvedById: user.id,
          approvedAt: new Date(),
          rejectReason: dto.decision === 'REJECTED' ? (dto.reason ?? null) : null,
        },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
          entity: 'GoldHandover',
          entityId: id,
          summary: `${dto.decision === 'APPROVED' ? 'ຮັບ' : 'ປະຕິເສດ'}ການມອບຄຳ ${handover.code}`,
        },
        tx,
      );

      await this.notifications.notify(
        {
          kind: 'APPROVAL_RESULT',
          recipientUserId: handover.createdById,
          title:
            dto.decision === 'APPROVED'
              ? `ການມອບຄຳ ${handover.code} ຖືກຮັບແລ້ວ`
              : `ການມອບຄຳ ${handover.code} ຖືກປະຕິເສດ`,
          refType: 'GoldHandover',
          refId: id,
        },
        tx,
      );

      return updated;
    });
  }

  /* ---------------------------------------------------------------- *
   * Reads
   * ---------------------------------------------------------------- */

  /** ລາຍການເຂົ້າ-ອອກສາງ ພ້ອມຊື່ຜູ້ບັນທຶກ ແລະ ຜູ້ອະນຸມັດ. */
  async listMovements(scope?: StockScope, status?: ApprovalStatus) {
    const rows = await this.prisma.stockMovement.findMany({
      where: { deletedAt: null, ...(scope ? { scope } : {}), ...(status ? { status } : {}) },
      include: { lines: true, partner: true, cabinet: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return this.audit.withActorNames(rows);
  }

  async newHistory(query: HistoryRangeDto, user?: AuthenticatedUser) {
    const range = this.range.resolve(query, user);
    // businessDate is a DATE column, so the inclusive end is the day itself.
    const where = { deletedAt: null, businessDate: HistoryRangeService.dayWindow(range) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockNewLedger.findMany({
        where,
        include: {
          movement: {
            include: {
              lines: {
                include: {
                  goldSku: { include: { goldItem: true } },
                  goldType: true,
                },
              },
              partner: true,
            },
          },
        },
        orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
        skip: range.skip,
        take: range.take,
      }),
      this.prisma.stockNewLedger.count({ where }),
    ]);
    // ຜູ້ບັນທຶກ — ລູກຄ້າຂໍໃຫ້ເຫັນທຸກ Module ທີ່ມີການລົງລາຍການ.
    return this.range.page(await this.audit.withCreatorNames(rows), total, range);
  }

  async oldHistory(query: HistoryRangeDto, user?: AuthenticatedUser) {
    const range = this.range.resolve(query, user);
    const where = { deletedAt: null, businessDate: HistoryRangeService.dayWindow(range) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockOldLedger.findMany({
        where,
        include: {
          goldType: true,
          movement: {
            include: {
              lines: {
                include: {
                  goldSku: { include: { goldItem: true } },
                  goldType: true,
                  goldItem: true,
                },
              },
              partner: true,
            },
          },
        },
        orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
        skip: range.skip,
        take: range.take,
      }),
      this.prisma.stockOldLedger.count({ where }),
    ]);
    return this.range.page(await this.audit.withCreatorNames(rows), total, range);
  }

  async oldBalances() {
    const day = await this.businessDay.current();
    await this.ensureOldTypeBalancesForDay(day.id);
    return this.prisma.stockOldTypeBalance.findMany({
      where: { businessDayId: day.id },
      include: { goldType: true },
      orderBy: { goldType: { sortOrder: 'asc' } },
    });
  }

  async newBalances() {
    const day = await this.businessDay.current();
    await this.ensureSkuBalancesForDay(day.id);
    return this.prisma.stockNewSkuBalance.findMany({
      where: {
        businessDayId: day.id,
        goldSku: { deletedAt: null, isActive: true },
      },
      include: { goldSku: { include: { goldItem: true } } },
      orderBy: { goldSku: { fullSkuName: 'asc' } },
    });
  }

  async ensureSkuBalancesForDay(businessDayId: string) {
    const activeSkus = await this.prisma.goldSku.findMany({
      where: { deletedAt: null, isActive: true },
    });
    if (activeSkus.length === 0) return;

    const existingBalances = await this.prisma.stockNewSkuBalance.findMany({
      where: { businessDayId },
      select: { goldSkuId: true },
    });
    const existingSkuIds = new Set(existingBalances.map((b) => b.goldSkuId));

    const missingSkus = activeSkus.filter((s) => !existingSkuIds.has(s.id));
    if (missingSkus.length === 0) return;

    const latestPrev = await this.prisma.stockNewSkuBalance.findFirst({
      where: { businessDayId: { not: businessDayId } },
      orderBy: { businessDay: { date: 'desc' } },
      select: { businessDayId: true },
    });

    const prevBalancesMap = new Map<string, { balanceQty: number; totalWeightG: Prisma.Decimal }>();
    if (latestPrev) {
      const prevBalances = await this.prisma.stockNewSkuBalance.findMany({
        where: {
          businessDayId: latestPrev.businessDayId,
          goldSkuId: { in: missingSkus.map((s) => s.id) },
        },
      });
      for (const b of prevBalances) {
        prevBalancesMap.set(b.goldSkuId, {
          balanceQty: b.balanceQty,
          totalWeightG: b.totalWeightG,
        });
      }
    }

    for (const sku of missingSkus) {
      const prev = prevBalancesMap.get(sku.id);
      const openingQty = prev?.balanceQty ?? 0;
      const totalWeightG =
        prev?.totalWeightG ??
        new Prisma.Decimal(dec(sku.weightG.toFixed()).mul(openingQty).toFixed());

      await this.prisma.stockNewSkuBalance.upsert({
        where: {
          businessDayId_goldSkuId: {
            businessDayId,
            goldSkuId: sku.id,
          },
        },
        update: {},
        create: {
          businessDayId,
          goldSkuId: sku.id,
          openingQty,
          inQty: 0,
          outQty: 0,
          balanceQty: openingQty,
          totalWeightG,
        },
      });
    }
  }

  async ensureOldTypeBalancesForDay(businessDayId: string) {
    const activeTypes = await this.prisma.goldType.findMany({
      where: { deletedAt: null, isActive: true },
    });
    if (activeTypes.length === 0) return;

    const existingBalances = await this.prisma.stockOldTypeBalance.findMany({
      where: { businessDayId },
      select: { goldTypeId: true },
    });
    const existingTypeIds = new Set(existingBalances.map((b) => b.goldTypeId));

    const missingTypes = activeTypes.filter((t) => !existingTypeIds.has(t.id));
    if (missingTypes.length === 0) return;

    const latestPrev = await this.prisma.stockOldTypeBalance.findFirst({
      where: { businessDayId: { not: businessDayId } },
      orderBy: { businessDay: { date: 'desc' } },
      select: { businessDayId: true },
    });

    const prevBalancesMap = new Map<string, { closingWeightG: Prisma.Decimal; closingCost: Prisma.Decimal }>();
    if (latestPrev) {
      const prevBalances = await this.prisma.stockOldTypeBalance.findMany({
        where: {
          businessDayId: latestPrev.businessDayId,
          goldTypeId: { in: missingTypes.map((t) => t.id) },
        },
      });
      for (const b of prevBalances) {
        prevBalancesMap.set(b.goldTypeId, {
          closingWeightG: b.closingWeightG,
          closingCost: b.closingCost,
        });
      }
    }

    for (const type of missingTypes) {
      const prev = prevBalancesMap.get(type.id);
      const openingWeightG = prev?.closingWeightG ?? new Prisma.Decimal(0);
      const openingCost = prev?.closingCost ?? new Prisma.Decimal(0);

      await this.prisma.stockOldTypeBalance.upsert({
        where: {
          businessDayId_goldTypeId: {
            businessDayId,
            goldTypeId: type.id,
          },
        },
        update: {},
        create: {
          businessDayId,
          goldTypeId: type.id,
          openingWeightG,
          openingCost,
          inG: new Prisma.Decimal(0),
          outG: new Prisma.Decimal(0),
          priceIn: new Prisma.Decimal(0),
          priceOut: new Prisma.Decimal(0),
          closingWeightG: openingWeightG,
          closingCost: openingCost,
        },
      });
    }
  }

  /**
   * TOR §4.2 — ສະຫຼຸບປະເພດຄຳ for the day.
   *
   * Groups the day's completed buybacks by ປະເພດຄຳ and applies the §4.2
   * averages. The ຄຳດີ/ຫຍຸບ/ແທ່ງ divisor is (old weight − new weight), which
   * is zero whenever an exchange balances — so `goldTypeAverage` returns null
   * with a Lao reason rather than Infinity, and the UI renders "—".
   */
  async oldGoldSummary() {
    // ທຽບກັບຖັນ timestamp ຈຶ່ງໃຊ້ທ່ຽງຄືນ "ທ້ອງຖິ່ນ" — ທ່ຽງຄືນ UTC ຈະຕັດເອົາ
    // ການຮັບຊື້ຊ່ວງ 00:00–07:00 ຂອງມື້ນີ້ໄປນັບເປັນມື້ວານ.
    const businessDate = BusinessDayService.localMidnight();
    const tomorrow = new Date(businessDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [goldTypes, buybacks, exchanges, handovers] = await Promise.all([
      this.prisma.goldType.findMany({
        where: { isStockType: true, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
      /*
       * ອ່ານເປັນ "ແຖວລາຍການ" ບໍ່ແມ່ນ "ບິນ": ບິນດຽວມີຫຼາຍປະເພດຄຳໄດ້ ແລະ
       * ສະຫຼຸບນີ້ແຍກຕາມປະເພດຄຳ. ບິນເກົ່າກ່ອນມີຕາຕະລາງແຖວ ຖືກຍ້າຍເຂົ້າ
       * `buyback_lines` ຕອນ migrate ແລ້ວ ຈຶ່ງອ່ານບ່ອນດຽວໄດ້ໝົດ.
       */
      this.prisma.buybackLine.findMany({
        where: {
          buyback: {
            deletedAt: null,
            status: 'COMPLETED',
            createdAt: { gte: businessDate, lt: tomorrow },
          },
        },
        select: { goldTypeId: true, weightG: true, quantity: true, payableAmount: true },
      }),
      this.prisma.goldExchange.findMany({
        where: {
          deletedAt: null,
          status: { in: ['APPROVED', 'COMPLETED'] },
          createdAt: { gte: businessDate, lt: tomorrow },
        },
        select: {
          oldLines: { select: { goldTypeId: true, weightG: true, quantity: true } },
          newLines: { select: { weightG: true, quantity: true } },
        },
      }),
      // ມອບແລ້ວ = ສິ່ງທີ່ອອກຈາກມືຜູ້ປະເມີນເຂົ້າສາງ. ນັບແຖວທີ່ຍັງບໍ່ຖືກ
      // ປະຕິເສດ: ລໍຖ້າສາງຮັບ ກໍຖືວ່າ ຄຳບໍ່ຢູ່ກັບຜູ້ປະເມີນອີກແລ້ວ.
      this.prisma.goldHandover.findMany({
        where: {
          deletedAt: null,
          status: { in: ['PENDING', 'APPROVED', 'COMPLETED'] },
          createdAt: { gte: businessDate, lt: tomorrow },
        },
        select: { goldTypeId: true, weightG: true, items: { select: { payableAmount: true } } },
      }),
    ]);

    // New-gold weight is not attributable to one ປະເພດຄຳ, so it is spread
    // across the old lines of the same exchange in proportion to their weight.
    const newWeightByType = new Map<string, Decimal>();
    for (const exchange of exchanges) {
      const oldTotal = exchange.oldLines.reduce(
        (sum, l) => sum.plus(toDec(l.weightG).mul(l.quantity)),
        dec(0),
      );
      if (oldTotal.lte(0)) continue;

      const newTotal = exchange.newLines.reduce(
        (sum, l) => sum.plus(toDec(l.weightG).mul(l.quantity)),
        dec(0),
      );

      for (const line of exchange.oldLines) {
        const share = toDec(line.weightG).mul(line.quantity).div(oldTotal).mul(newTotal);
        newWeightByType.set(
          line.goldTypeId,
          (newWeightByType.get(line.goldTypeId) ?? dec(0)).plus(share),
        );
      }
    }

    return goldTypes.map((goldType) => {
      const rows = buybacks.filter((b) => b.goldTypeId === goldType.id);

      const receivedG = rows.reduce(
        (sum, r) => sum.plus(toDec(r.weightG).mul(r.quantity)),
        dec(0),
      );
      const quantity = rows.reduce((sum, r) => sum + r.quantity, 0);
      const receivedPaid = rows.reduce((sum, r) => sum.plus(toDec(r.payableAmount)), dec(0));
      const newWeightG = newWeightByType.get(goldType.id) ?? dec(0);

      // ມອບແລ້ວ ຂອງປະເພດຄຳນີ້ — ແລະ ສຳລັບ ຄຳຕົ້ມ ຍັງຮູ້ວ່າເງິນເທົ່າໃດອອກໄປ
      // ພ້ອມກັບລາຍການນັ້ນ, ເພາະມອບເປັນລາຍການ ບໍ່ແມ່ນເປັນນ້ຳໜັກກ້ອນ.
      const mine = handovers.filter((h) => h.goldTypeId === goldType.id);
      const handedG = mine.reduce((sum, h) => sum.plus(toDec(h.weightG)), dec(0));
      const handedPaid = mine.reduce(
        (sum, h) => sum.plus(h.items.reduce((s, i) => s.plus(toDec(i.payableAmount)), dec(0))),
        dec(0),
      );

      /*
       * ຄົງເຫຼືອ = ຮັບຈາກຜູ້ປະເມີນ − ມອບເຂົ້າສາງ (TOR §4.2).
       *
       * ບໍ່ປ່ອຍໃຫ້ຕິດລົບ: ການຊັ່ງຄືນຢູ່ສາງບາງຄັ້ງໄດ້ຫຼາຍກວ່າທີ່ຮັບມາໃນມື້
       * (ຄຳຕົກມາຈາກມື້ກ່ອນ) — ສະແດງ 0 ແລ້ວໃຫ້ຜູ້ໃຊ້ເຫັນທັງສອງຕົວເລກ ດີກວ່າ
       * ສະແດງຍອດຕິດລົບທີ່ອ່ານຜິດໄດ້ງ່າຍ.
       */
      const remainingG = receivedG.minus(handedG);
      const shownRemainingG = remainingG.isNegative() ? dec(0) : remainingG;

      /*
       * ເງິນທີ່ຈ່າຍຄົງເຫຼືອ = ເງິນທີ່ຈ່າຍທັງໝົດ (ສູດໃນຊີດຂອງລູກຄ້າ: L6 = E6).
       *
       * ການມອບເຂົ້າສາງ ຍ້າຍ "ນ້ຳໜັກ" ເທົ່ານັ້ນ ບໍ່ແມ່ນ "ເງິນ" — ເງິນຈ່າຍອອກ
       * ໄປແລ້ວຕອນຮັບຊື້ຄືນ. ສະນັ້ນ ສະເລ່ຍ/g ຂອງຕາຕະລາງ 2 ຈຶ່ງສູງຂຶ້ນເມື່ອມອບ
       * ຫຼາຍ — ເປັນຕາມທີ່ລູກຄ້າຕ້ອງການ ແລະ ອະທິບາຍໄວ້ໃນກ່ອງ "ວິທີຄິດໄລ່".
       */
      const remainingPaid = receivedPaid;

      // ສູດຂອງແບບນີ້ແມ່ນ ເງິນ ÷ ນ້ຳໜັກ ກົງໆ (ບໍ່ຫັກນ້ຳໜັກຄຳໃໝ່) —
      // ສົ່ງ 0 ເປັນນ້ຳໜັກຄຳໃໝ່ ເພື່ອໃຊ້ການຈັດການ "—" ຂອງ helper ດຽວກັນ.
      const receivedAverage = goldTypeAverage(receivedPaid, receivedG, dec(0), true);
      const average = goldTypeAverage(remainingPaid, shownRemainingG, dec(0), true);

      return {
        goldTypeId: goldType.id,
        goldTypeCode: goldType.code,
        goldTypeNameLo: goldType.nameLo,

        /** ຕາຕະລາງ 1 — ຮັບມາຈາກຜູ້ປະເມີນ (ກ່ອນມອບເຂົ້າສາງ). */
        receivedG: receivedG.toFixed(),
        receivedBahtWeight: gramsToBaht(receivedG).toFixed(),
        receivedPaid: receivedPaid.toFixed(),
        receivedAveragePerGram: receivedAverage.perGram ? receivedAverage.perGram.toFixed() : null,
        receivedAveragePerBaht: receivedAverage.perBaht ? receivedAverage.perBaht.toFixed() : null,

        /** ຕາຕະລາງ 2 — ຫຼັງສົ່ງມອບເຂົ້າສາງແລ້ວ. */
        handedG: handedG.toFixed(),
        handedPaid: handedPaid.toFixed(),
        weightG: shownRemainingG.toFixed(),
        bahtWeight: gramsToBaht(shownRemainingG).toFixed(),
        totalPaid: remainingPaid.toFixed(),
        averagePerGram: average.perGram ? average.perGram.toFixed() : null,
        averagePerBaht: average.perBaht ? average.perBaht.toFixed() : null,
        averageMessageLo: average.messageLo,

        quantity,
        /** ນ້ຳໜັກຄຳໃໝ່ທີ່ຈ່າຍອອກໃນການປ່ຽນ — ໄວ້ໃຫ້ລາຍງານອື່ນໃຊ້. */
        newWeightG: newWeightG.toFixed(),
      };
    });
  }

  /** History ມອບຄຳ — ຄ່າເລີ່ມຕົ້ນ = ມື້ນີ້, ກວ້າງອອກໄດ້ຕາມສິດ. */
  async listHandovers(
    status: ApprovalStatus | undefined,
    query: HistoryRangeDto,
    user?: AuthenticatedUser,
    filters?: { goldTypeId?: string; q?: string },
  ) {
    const range = this.range.resolve(query, user);
    const q = filters?.q?.trim();
    const where = {
      deletedAt: null,
      createdAt: HistoryRangeService.window(range),
      ...(status ? { status } : {}),
      ...(filters?.goldTypeId ? { goldTypeId: filters.goldTypeId } : {}),
      // ຄົ້ນຫາ: ລະຫັດການມອບ · ລະຫັດ/ຊື່ລາຍການຄຳຕົ້ມ · ຊື່ຜູ້ມອບ.
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' as const } },
              { items: { some: { buyback: { code: { contains: q, mode: 'insensitive' as const } } } } },
              {
                items: {
                  some: { buyback: { goldItem: { nameLo: { contains: q, mode: 'insensitive' as const } } } },
                },
              },
              { shift: { user: { fullName: { contains: q, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.goldHandover.findMany({
        where,
        include: {
          goldType: true,
          shift: { include: { user: true } },
          items: { include: { buyback: { select: { code: true, goldItem: { select: { nameLo: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: range.skip,
        take: range.take,
      }),
      this.prisma.goldHandover.count({ where }),
    ]);
    return this.range.page(await this.audit.withActorNames(rows), total, range);
  }

  /**
   * ລາຍການຄຳເກົ່າ (ຄຳຕົ້ມ) ທີ່ຮັບຊື້ຄືນແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ມອບເຂົ້າສາງ.
   *
   * ອ່ານຈາກການບໍ່ມີ GoldHandoverItem — ບໍ່ແມ່ນ flag ຢູ່ Buyback — ສະນັ້ນ
   * ລາຍການຈະຫຼຸດອອກຈາກລາຍການເລືອກທັນທີທີ່ມອບ ແລະ ບໍ່ມີທາງມອບສອງຄັ້ງ.
   */
  async pendingOldGoldItems(goldTypeId?: string) {
    const rows = await this.prisma.buyback.findMany({
      where: {
        deletedAt: null,
        status: 'COMPLETED',
        handoverItem: null,
        // ບິນທີ່ "ມີແຖວ" ເປັນຄຳຕົ້ມ — ບໍ່ແມ່ນອີງແຕ່ປະເພດຂອງຫົວບິນ,
        // ເພາະບິນດຽວປະສົມຫຼາຍປະເພດໄດ້ແລ້ວ.
        ...(goldTypeId
          ? { lines: { some: { goldTypeId } } }
          : { lines: { some: { goldType: { code: 'BOILED' } } } }),
      },
      select: {
        id: true, code: true, weightG: true, quantity: true,
        goldPercent: true, payableAmount: true, createdAt: true,
        goldItem: { select: { nameLo: true } },
        goldType: { select: { nameLo: true } },
        customer: { select: { phone: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return rows.map((r) => ({
      ...r,
      weightG: r.weightG.toFixed(),
      goldPercent: r.goldPercent ? r.goldPercent.toFixed() : null,
      payableAmount: r.payableAmount.toFixed(),
      /** ຄືກັນກັບ `weightG` — ຫົວບິນເກັບຍອດລວມຢູ່ແລ້ວ. ເກັບຊື່ໄວ້ໃຫ້ client ເກົ່າ. */
      totalWeightG: toDec(r.weightG).toFixed(),
    }));
  }

  /* ---------------------------------------------------------------- *
   * Helpers
   * ---------------------------------------------------------------- */

  /** Ready to Gold counts: Balance = ຕັ້ງຕົ້ນ + IN − OUT (§7.1). */
  private async refreshSkuBalances(
    tx: Prisma.TransactionClient,
    businessDayId: string,
    lines: Array<{ goldSkuId?: string | undefined; quantity: number; weightG: string }>,
    direction: 'IN' | 'OUT',
  ) {
    for (const line of lines) {
      if (!line.goldSkuId) continue;

      const key = { businessDayId_goldSkuId: { businessDayId, goldSkuId: line.goldSkuId } };
      const existing = await tx.stockNewSkuBalance.findUnique({ where: key });

      const openingQty = existing?.openingQty ?? 0;
      const inQty = (existing?.inQty ?? 0) + (direction === 'IN' ? line.quantity : 0);
      const outQty = (existing?.outQty ?? 0) + (direction === 'OUT' ? line.quantity : 0);
      const balanceQty = openingQty + inQty - outQty;

      const data = {
        inQty,
        outQty,
        balanceQty,
        totalWeightG: D(dec(line.weightG).mul(balanceQty)),
      };

      await tx.stockNewSkuBalance.upsert({
        where: key,
        update: data,
        create: { businessDayId, goldSkuId: line.goldSkuId, ...data },
      });
    }
  }

  private async nextCode(
    client: Prisma.TransactionClient | PrismaService,
    kind: string,
  ): Promise<string> {
    const now = new Date();
    const prefix = `${kind}-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const count =
      kind === 'HO'
        ? await client.goldHandover.count({ where: { code: { startsWith: prefix } } })
        : await client.stockMovement.count({ where: { code: { startsWith: prefix } } });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  /* ---------------------------------------------------------------- *
   * Task 1: Movement View, Edit, Delete & SkuBalance Edit
   * ---------------------------------------------------------------- */

  async getMovement(id: string) {
    const movement = await this.prisma.stockMovement.findFirst({
      where: { id, deletedAt: null },
      include: {
        lines: {
          include: {
            goldSku: { include: { goldItem: true } },
            goldType: true,
            goldItem: true,
          },
        },
        partner: true,
        cabinet: true,
      },
    });
    if (!movement) throw new NotFoundException('ບໍ່ພົບລາຍການເຄື່ອນໄຫວສາງ');

    const actorIds = [movement.createdById, movement.approvedById].filter(
      (uid): uid is string => Boolean(uid),
    );
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const nameMap = new Map(users.map((u) => [u.id, u.fullName]));

    return {
      ...movement,
      createdByName: nameMap.get(movement.createdById) ?? '—',
      approvedByName: movement.approvedById ? (nameMap.get(movement.approvedById) ?? '—') : null,
    };
  }

  async updateMovement(id: string, dto: UpdateStockMovementDto, user: AuthenticatedUser) {
    const movement = await this.prisma.stockMovement.findFirst({
      where: { id, deletedAt: null },
      include: { lines: true, partner: true },
    });
    if (!movement) throw new NotFoundException('ບໍ່ພົບລາຍການເຄື່ອນໄຫວສາງ');

    const day = await this.businessDay.current();

    return this.prisma.$transaction(async (tx) => {
      let partner = movement.partner;
      if (dto.partnerId && dto.partnerId !== movement.partnerId) {
        partner = await tx.partnerSource.findUnique({ where: { id: dto.partnerId } });
        if (!partner) throw new NotFoundException('ບໍ່ພົບແຫຼ່ງ');
      }

      let totalGoldG = toDec(movement.totalGoldG);
      let totalQuantity = movement.totalQuantity;
      let totalCost = toDec(movement.totalCost);
      let perG = toDec(movement.pricePerG);

      let parsedLines: Array<{
        goldSkuId?: string;
        goldTypeId?: string;
        goldItemId?: string;
        oldCategory?: 'JEWELRY' | 'BAR';
        weightG: string;
        quantity: number;
        goldG: Decimal;
      }> | null = null;

      // If lines updated
      if (dto.lines && dto.lines.length > 0) {
        parsedLines = dto.lines.map((line) => ({
          ...line,
          goldG: lineGoldWeight(line.weightG, line.quantity),
        }));
        const newGoldG = parsedLines.reduce((sum, l) => sum.plus(l.goldG), dec(0));
        const newQuantity = parsedLines.reduce((sum, l) => sum + l.quantity, 0);

        if (newGoldG.lte(0)) throw new BadRequestException('ນ້ຳໜັກລວມຕ້ອງໃຫຍ່ກວ່າ 0');

        // Reverse old lines from SKU balance if scope NEW or TRANSFER
        const isNewIn =
          movement.type === 'IN' || (movement.type === 'TRANSFER' && movement.scope === 'OLD');
        if (
          (movement.scope === 'NEW' || movement.type === 'TRANSFER') &&
          (movement.status === 'COMPLETED' || movement.status === 'APPROVED')
        ) {
          const affectedSkuIds = new Set<string>();
          for (const line of movement.lines) {
            if (!line.goldSkuId) continue;
            affectedSkuIds.add(line.goldSkuId);
            const bal = await tx.stockNewSkuBalance.findUnique({
              where: {
                businessDayId_goldSkuId: { businessDayId: day.id, goldSkuId: line.goldSkuId },
              },
            });
            if (bal) {
              const inQty = isNewIn ? Math.max(0, bal.inQty - line.quantity) : bal.inQty;
              const outQty = !isNewIn ? Math.max(0, bal.outQty - line.quantity) : bal.outQty;
              const balanceQty = bal.openingQty + inQty - outQty;
              const sku = await tx.goldSku.findUnique({ where: { id: line.goldSkuId } });
              const totalWeightG = dec(sku?.weightG ?? 0).mul(balanceQty);
              await tx.stockNewSkuBalance.update({
                where: { id: bal.id },
                data: { inQty, outQty, balanceQty, totalWeightG: D(totalWeightG) },
              });
            }
          }

          // Apply new lines to SKU balance
          for (const line of parsedLines) {
            if (!line.goldSkuId) continue;
            affectedSkuIds.add(line.goldSkuId);
            const key = {
              businessDayId_goldSkuId: { businessDayId: day.id, goldSkuId: line.goldSkuId },
            };
            const existing = await tx.stockNewSkuBalance.findUnique({ where: key });
            const openingQty = existing?.openingQty ?? 0;
            const inQty = (existing?.inQty ?? 0) + (isNewIn ? line.quantity : 0);
            const outQty = (existing?.outQty ?? 0) + (!isNewIn ? line.quantity : 0);
            const balanceQty = openingQty + inQty - outQty;
            const sku = await tx.goldSku.findUnique({ where: { id: line.goldSkuId } });
            const totalWeightG = dec(sku?.weightG ?? 0).mul(balanceQty);
            await tx.stockNewSkuBalance.upsert({
              where: key,
              update: { inQty, outQty, balanceQty, totalWeightG: D(totalWeightG) },
              create: {
                businessDayId: day.id,
                goldSkuId: line.goldSkuId,
                openingQty,
                inQty,
                outQty,
                balanceQty,
                totalWeightG: D(totalWeightG),
              },
            });
          }

          // Ensure no affected SKU balance went negative
          for (const skuId of affectedSkuIds) {
            const finalBal = await tx.stockNewSkuBalance.findUnique({
              where: { businessDayId_goldSkuId: { businessDayId: day.id, goldSkuId: skuId } },
            });
            if (finalBal && finalBal.balanceQty < 0) {
              throw new BadRequestException(
                'ບໍ່ສາມາດແກ້ໄຂໄດ້ ເນື່ອງຈາກຍອດຄົງເຫຼືອ SKU ຈະຕິດລົບ (ມີການຕັດສະຕັອກອອກໄປແລ້ວ)',
              );
            }
          }
        }

        totalGoldG = newGoldG;
        totalQuantity = newQuantity;

        if (movement.type === 'IN') {
          totalCost = dto.totalCost ? dec(dto.totalCost) : totalCost;
          perG = totalGoldG.gt(0) ? totalCost.div(totalGoldG) : dec(0);
        } else {
          totalCost = totalGoldG.mul(perG);
        }

        // Replace lines in database
        await tx.stockMovementLine.deleteMany({ where: { movementId: id } });
        await tx.stockMovementLine.createMany({
          data: parsedLines.map((l) => ({
            movementId: id,
            goldSkuId: l.goldSkuId ?? null,
            goldTypeId: dto.goldTypeId ?? l.goldTypeId ?? null,
            goldItemId: l.goldItemId ?? null,
            oldCategory: l.oldCategory ?? null,
            weightG: D(dec(l.weightG)),
            quantity: l.quantity,
            goldG: D(l.goldG),
            cost: D(l.goldG.mul(perG)),
          })),
        });
      } else if (dto.totalCost && movement.type === 'IN') {
        totalCost = dec(dto.totalCost);
        perG = totalGoldG.gt(0) ? totalCost.div(totalGoldG) : dec(0);
      }

      const laborFeeThb =
        dto.laborFeeThb !== undefined ? dec(dto.laborFeeThb) : toDec(movement.laborFeeThb);

      const nextGoldPercent =
        dto.goldPercent !== undefined
          ? dto.goldPercent
            ? dec(dto.goldPercent)
            : null
          : movement.goldPercent
            ? toDec(movement.goldPercent)
            : null;
      const nextTransformType =
        dto.transformType !== undefined ? dto.transformType : movement.transformType;

      const activePartner = partner ?? movement.partner;
      const isFactory =
        movement.scope === 'OLD' &&
        (activePartner?.type === 'FACTORY' ||
          (!activePartner?.type && activePartner?.code === 'FACTORY'));
      const effectiveGoldPercent = isFactory ? null : nextGoldPercent;

      const updated = await tx.stockMovement.update({
        where: { id },
        data: {
          partnerId: partner?.id ?? movement.partnerId,
          transformType: nextTransformType,
          goldPercent: effectiveGoldPercent ? D(effectiveGoldPercent) : null,
          expectedReturnG: effectiveGoldPercent ? D(expectedReturnWeight(totalGoldG, effectiveGoldPercent)) : null,
          totalGoldG: D(totalGoldG),
          totalQuantity,
          totalCost: D(totalCost),
          pricePerG: D(perG),
          pricePerBaht: D(pricePerBaht(perG)),
          laborFeeThb: D(laborFeeThb),
          note: dto.note !== undefined ? dto.note : movement.note,
        },
      });

      // Update StockNewLedger row
      const isNewLedgerIn =
        movement.type === 'IN' || (movement.type === 'TRANSFER' && movement.scope === 'OLD');
      await tx.stockNewLedger.updateMany({
        where: { movementId: id, deletedAt: null },
        data: {
          partnerLabel:
            movement.type === 'TRANSFER' ? null : (partner?.nameLo ?? movement.partner?.nameLo),
          goldInG: isNewLedgerIn ? D(totalGoldG) : D(dec(0)),
          goldOutG: !isNewLedgerIn ? D(totalGoldG) : D(dec(0)),
          priceIn: isNewLedgerIn ? D(totalCost) : D(dec(0)),
          priceOut: !isNewLedgerIn ? D(totalCost) : D(dec(0)),
        },
      });
      await this.recomputeNewLedgerRunningTotals(tx);

      // Update StockOldLedger rows and StockOldTypeBalance if applicable
      const oldLedgerRows = await tx.stockOldLedger.findMany({
        where: { movementId: id, deletedAt: null },
        orderBy: { sequence: 'asc' },
      });

      if (oldLedgerRows.length > 0) {
        // 1. Reverse existing oldLedgerRows from StockOldTypeBalance
        for (const r of oldLedgerRows) {
          await this.adjustOldTypeBalance(tx, day.id, r.goldTypeId, {
            inDelta: toDec(r.goldInG).neg(),
            outDelta: toDec(r.goldOutG).neg(),
            priceInDelta: toDec(r.priceIn).neg(),
            priceOutDelta: toDec(r.priceOut).neg(),
          });
        }

        // 2. Build new StockOldLedger entries
        const partnerLabel =
          movement.type === 'TRANSFER'
            ? null
            : (partner?.nameLo ?? movement.partner?.nameLo ?? oldLedgerRows[0].partnerLabel);

        const newOldEntries: Array<{
          goldTypeId: string;
          goldInG: Decimal;
          goldOutG: Decimal;
          priceIn: Decimal;
          priceOut: Decimal;
        }> = [];

        if (movement.type === 'TRANSFER') {
          const isInOld = movement.scope === 'NEW'; // NEW_TO_OLD puts gold IN to OLD
          const gtId =
            dto.goldTypeId ??
            parsedLines?.[0]?.goldTypeId ??
            movement.lines[0]?.goldTypeId ??
            oldLedgerRows[0].goldTypeId;
          newOldEntries.push({
            goldTypeId: gtId,
            goldInG: isInOld ? totalGoldG : dec(0),
            goldOutG: !isInOld ? totalGoldG : dec(0),
            priceIn: isInOld ? totalCost : dec(0),
            priceOut: !isInOld ? totalCost : dec(0),
          });
        } else {
          const effectiveLines = parsedLines
            ? parsedLines.map((l) => ({
                goldTypeId: dto.goldTypeId ?? l.goldTypeId ?? oldLedgerRows[0].goldTypeId,
                goldG: l.goldG,
                cost: l.goldG.mul(perG),
              }))
            : movement.lines.map((l) => ({
                goldTypeId: dto.goldTypeId ?? l.goldTypeId ?? oldLedgerRows[0].goldTypeId,
                goldG: toDec(l.goldG),
                cost: toDec(l.goldG).mul(perG),
              }));

          for (const l of effectiveLines) {
            if (!l.goldTypeId) continue;
            newOldEntries.push({
              goldTypeId: l.goldTypeId,
              goldInG: movement.type === 'IN' ? l.goldG : dec(0),
              goldOutG: movement.type !== 'IN' ? l.goldG : dec(0),
              priceIn: movement.type === 'IN' ? l.cost : dec(0),
              priceOut: movement.type !== 'IN' ? l.cost : dec(0),
            });
          }
        }

        const now = new Date();
        const maxLen = Math.max(oldLedgerRows.length, newOldEntries.length);
        for (let i = 0; i < maxLen; i++) {
          const existingRow = oldLedgerRows[i];
          const entry = newOldEntries[i];
          if (existingRow && entry) {
            await tx.stockOldLedger.update({
              where: { id: existingRow.id },
              data: {
                goldTypeId: entry.goldTypeId,
                partnerLabel,
                goldInG: D(entry.goldInG),
                goldOutG: D(entry.goldOutG),
                priceIn: D(entry.priceIn),
                priceOut: D(entry.priceOut),
              },
            });
          } else if (existingRow && !entry) {
            await tx.stockOldLedger.update({
              where: { id: existingRow.id },
              data: { deletedAt: now },
            });
          } else if (!existingRow && entry) {
            const baseRow = oldLedgerRows[0];
            const lastSeq = await tx.stockOldLedger.findFirst({
              where: { businessDate: baseRow.businessDate },
              orderBy: { sequence: 'desc' },
            });
            await tx.stockOldLedger.create({
              data: {
                movementId: id,
                goldTypeId: entry.goldTypeId,
                businessDate: baseRow.businessDate,
                partnerLabel,
                typeLabel: baseRow.typeLabel,
                goldInG: D(entry.goldInG),
                goldOutG: D(entry.goldOutG),
                priceIn: D(entry.priceIn),
                priceOut: D(entry.priceOut),
                weightG: D(dec(0)),
                cost: D(dec(0)),
                sequence: (lastSeq?.sequence ?? 0) + 1,
                createdById: user.id,
              },
            });
          }
        }

        // 3. Apply newOldEntries to StockOldTypeBalance
        for (const entry of newOldEntries) {
          await this.adjustOldTypeBalance(tx, day.id, entry.goldTypeId, {
            inDelta: entry.goldInG,
            outDelta: entry.goldOutG,
            priceInDelta: entry.priceIn,
            priceOutDelta: entry.priceOut,
          });
        }

        // 4. Recompute running totals in StockOldLedger
        await this.recomputeOldLedgerRunningTotals(tx);
      }

      // Update GoldApArLedger row if exists
      const aparRow = await tx.goldApArLedger.findFirst({
        where: { movementId: id, deletedAt: null },
      });
      if (aparRow) {
        const pId = partner?.id ?? movement.partnerId;
        if (pId) {
          const effectiveExpectedReturnG = nextGoldPercent
            ? expectedReturnWeight(totalGoldG, nextGoldPercent)
            : movement.expectedReturnG
              ? toDec(movement.expectedReturnG)
              : null;
          const aparWeight = effectiveExpectedReturnG ?? totalGoldG;

          await tx.goldApArLedger.update({
            where: { id: aparRow.id },
            data: {
              partnerId: pId,
              goldInG: movement.type === 'IN' ? D(totalGoldG) : D(dec(0)),
              goldOutG: movement.type !== 'IN' ? D(aparWeight) : D(dec(0)),
              priceIn: movement.type === 'IN' ? D(totalCost) : D(dec(0)),
              priceOut: movement.type !== 'IN' ? D(totalCost) : D(dec(0)),
            },
          });
          await this.recomputeGoldApArRunningTotals(tx, pId, aparRow.side as 'AP' | 'AR');
        }
      }

      // Update CashApArLedger row for labor fee if exists or create if needed
      const cashAparRow = await tx.cashApArLedger.findFirst({
        where: { refId: id, refType: 'LABOR_PAYABLE', deletedAt: null },
      });
      const cashPartnerId = partner?.id ?? movement.partnerId;
      if (cashAparRow) {
        if (laborFeeThb.gt(0)) {
          await tx.cashApArLedger.update({
            where: { id: cashAparRow.id },
            data: {
              partnerId: cashPartnerId ?? undefined,
              amountIn: D(laborFeeThb),
            },
          });
        } else {
          await tx.cashApArLedger.update({
            where: { id: cashAparRow.id },
            data: { deletedAt: new Date() },
          });
        }
      } else if (movement.type === 'IN' && laborFeeThb.gt(0)) {
        await this.apar.postCash(tx, {
          reason: 'LABOR_PAYABLE',
          currency: 'THB',
          amount: laborFeeThb,
          refId: movement.id,
          partnerId: cashPartnerId ?? undefined,
          note: `ຄ່າແຮງຊ່າງ ${movement.code}`,
          createdById: user.id,
        });
      }

      await this.audit.record(
        {
          actorId: user.id,
          action: 'UPDATE',
          entity: 'StockMovement',
          entityId: id,
          before: {
            partnerId: movement.partnerId,
            totalGoldG: movement.totalGoldG.toFixed(),
            totalCost: movement.totalCost.toFixed(),
          },
          after: {
            partnerId: partner?.id ?? movement.partnerId,
            totalGoldG: totalGoldG.toFixed(),
            totalCost: totalCost.toFixed(),
          },
          summary: `ແກ້ໄຂການເຄື່ອນໄຫວສາງ ${movement.code} — ${totalGoldG.toFixed()} g`,
        },
        tx,
      );

      return updated;
    });
  }

  async deleteMovement(id: string, user: AuthenticatedUser) {
    const movement = await this.prisma.stockMovement.findFirst({
      where: { id, deletedAt: null },
      include: { lines: true, partner: true },
    });
    if (!movement) throw new NotFoundException('ບໍ່ພົບລາຍການເຄື່ອນໄຫວສາງ');

    const day = await this.businessDay.current();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Reverse SKU balances if NEW scope or TRANSFER
      const isNewIn =
        movement.type === 'IN' || (movement.type === 'TRANSFER' && movement.scope === 'OLD');
      if (
        (movement.scope === 'NEW' || movement.type === 'TRANSFER') &&
        (movement.status === 'COMPLETED' || movement.status === 'APPROVED')
      ) {
        if (isNewIn) {
          for (const line of movement.lines) {
            if (!line.goldSkuId) continue;
            const bal = await tx.stockNewSkuBalance.findUnique({
              where: {
                businessDayId_goldSkuId: { businessDayId: day.id, goldSkuId: line.goldSkuId },
              },
            });
            if (bal) {
              const inQty = Math.max(0, bal.inQty - line.quantity);
              const balanceQty = bal.openingQty + inQty - bal.outQty;
              if (balanceQty < 0) {
                throw new BadRequestException(
                  'ບໍ່ສາມາດລຶບລາຍການນີ້ໄດ້ ເນື່ອງຈາກສິນຄ້າຖືກຕັດສະຕັອກອອກໄປແລ້ວ (ຍອດຄົງເຫຼືອຈະຕິດລົບ)',
                );
              }
              const sku = await tx.goldSku.findUnique({ where: { id: line.goldSkuId } });
              const totalWeightG = dec(sku?.weightG ?? 0).mul(balanceQty);
              await tx.stockNewSkuBalance.update({
                where: { id: bal.id },
                data: { inQty, balanceQty, totalWeightG: D(totalWeightG) },
              });
            }
          }
        } else if (movement.type === 'OUT' || movement.type === 'TRANSFER') {
          for (const line of movement.lines) {
            if (!line.goldSkuId) continue;
            const bal = await tx.stockNewSkuBalance.findUnique({
              where: {
                businessDayId_goldSkuId: { businessDayId: day.id, goldSkuId: line.goldSkuId },
              },
            });
            if (bal) {
              const outQty = Math.max(0, bal.outQty - line.quantity);
              const balanceQty = bal.openingQty + bal.inQty - outQty;
              const sku = await tx.goldSku.findUnique({ where: { id: line.goldSkuId } });
              const totalWeightG = dec(sku?.weightG ?? 0).mul(balanceQty);
              await tx.stockNewSkuBalance.update({
                where: { id: bal.id },
                data: { outQty, balanceQty, totalWeightG: D(totalWeightG) },
              });
            }
          }
        }
      }

      // 2. Soft-delete movement
      const updated = await tx.stockMovement.update({
        where: { id },
        data: { deletedAt: now, deletedById: user.id },
      });

      // 3. Soft-delete StockNewLedger row
      await tx.stockNewLedger.updateMany({
        where: { movementId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      await this.recomputeNewLedgerRunningTotals(tx);

      // 4. Reverse StockOldTypeBalance and soft-delete StockOldLedger rows
      const oldLedgerRows = await tx.stockOldLedger.findMany({
        where: { movementId: id, deletedAt: null },
      });
      for (const r of oldLedgerRows) {
        await this.adjustOldTypeBalance(tx, day.id, r.goldTypeId, {
          inDelta: toDec(r.goldInG).neg(),
          outDelta: toDec(r.goldOutG).neg(),
          priceInDelta: toDec(r.priceIn).neg(),
          priceOutDelta: toDec(r.priceOut).neg(),
        });
      }
      await tx.stockOldLedger.updateMany({
        where: { movementId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      if (oldLedgerRows.length > 0) {
        await this.recomputeOldLedgerRunningTotals(tx);
      }

      // 5. Soft-delete GoldApArLedger row
      const aparRow = await tx.goldApArLedger.findFirst({
        where: { movementId: id, deletedAt: null },
      });
      await tx.goldApArLedger.updateMany({
        where: { movementId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      if (movement.partnerId) {
        await this.recomputeGoldApArRunningTotals(
          tx,
          movement.partnerId,
          (aparRow?.side as 'AP' | 'AR') ?? 'AP',
        );
      }

      // 6. Soft-delete CashApArLedger row
      await tx.cashApArLedger.updateMany({
        where: { refId: id, deletedAt: null },
        data: { deletedAt: now },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: 'DELETE',
          entity: 'StockMovement',
          entityId: id,
          before: { code: movement.code, totalGoldG: movement.totalGoldG.toFixed() },
          after: { deletedAt: now.toISOString() },
          summary: `ລຶບການເຄື່ອນໄຫວສາງ ${movement.code} — ${movement.totalGoldG.toFixed()} g`,
        },
        tx,
      );

      return updated;
    });
  }

  async updateSkuBalance(id: string, dto: UpdateSkuBalanceDto, user: AuthenticatedUser) {
    const balance = await this.prisma.stockNewSkuBalance.findUnique({
      where: { id },
      include: { goldSku: true },
    });
    if (!balance) throw new NotFoundException('ບໍ່ພົບຍອດ SKU');

    const newOpeningQty = dto.openingQty;
    const newBalanceQty = newOpeningQty + balance.inQty - balance.outQty;
    if (newBalanceQty < 0) {
      throw new BadRequestException(
        'ບໍ່ສາມາດປັບຈຳນວນຕັ້ງຕົ້ນໄດ້ ເນື່ອງຈາກຍອດຄົງເຫຼືອຈະຕິດລົບ (ມີຍອດຈ່າຍອອກໄປແລ້ວ)',
      );
    }
    const totalWeightG = dec(balance.goldSku.weightG).mul(newBalanceQty);

    const updated = await this.prisma.stockNewSkuBalance.update({
      where: { id },
      data: {
        openingQty: newOpeningQty,
        balanceQty: newBalanceQty,
        totalWeightG: D(totalWeightG),
      },
    });

    await this.audit.record({
      actorId: user.id,
      action: 'UPDATE',
      entity: 'StockNewSkuBalance',
      entityId: id,
      before: { openingQty: balance.openingQty, balanceQty: balance.balanceQty },
      after: { openingQty: newOpeningQty, balanceQty: newBalanceQty },
      summary: `ແກ້ໄຂຈຳນວນຕັ້ງຕົ້ນ ${balance.goldSku.fullSkuName}: ${balance.openingQty} -> ${newOpeningQty}`,
    });

    return updated;
  }

  async updateOldTypeBalance(id: string, dto: UpdateOldTypeBalanceDto, user: AuthenticatedUser) {
    const balance = await this.prisma.stockOldTypeBalance.findUnique({
      where: { id },
      include: { goldType: true },
    });
    if (!balance) throw new NotFoundException('ບໍ່ພົບຍອດປະເພດຄຳ');

    const newOpeningWeightG = dec(dto.openingWeightG);
    const newOpeningCost = dec(dto.openingCost);
    if (newOpeningWeightG.lt(0) || newOpeningCost.lt(0)) {
      throw new BadRequestException('ຍອດຕັ້ງຕົ້ນຕ້ອງບໍ່ຕິດລົບ');
    }

    const inG = toDec(balance.inG);
    const outG = toDec(balance.outG);
    const priceIn = toDec(balance.priceIn);
    const priceOut = toDec(balance.priceOut);

    const newClosingWeightG = newOpeningWeightG.plus(inG).minus(outG);
    const newClosingCost = newOpeningCost.plus(priceIn).minus(priceOut);

    const updated = await this.prisma.stockOldTypeBalance.update({
      where: { id },
      data: {
        openingWeightG: D(newOpeningWeightG),
        openingCost: D(newOpeningCost),
        closingWeightG: D(newClosingWeightG),
        closingCost: D(newClosingCost),
      },
    });

    await this.audit.record({
      actorId: user.id,
      action: 'UPDATE',
      entity: 'StockOldTypeBalance',
      entityId: id,
      before: {
        openingWeightG: balance.openingWeightG.toFixed(),
        openingCost: balance.openingCost.toFixed(),
        closingWeightG: balance.closingWeightG.toFixed(),
        closingCost: balance.closingCost.toFixed(),
      },
      after: {
        openingWeightG: newOpeningWeightG.toFixed(),
        openingCost: newOpeningCost.toFixed(),
        closingWeightG: newClosingWeightG.toFixed(),
        closingCost: newClosingCost.toFixed(),
      },
      summary: `ແກ້ໄຂຍອດຕັ້ງຕົ້ນ ${balance.goldType.nameLo}: ${balance.openingWeightG.toFixed()} g -> ${newOpeningWeightG.toFixed()} g`,
    });

    return updated;
  }

  async updateOldHistoryRow(id: string, dto: UpdateOldLedgerRowDto, user: AuthenticatedUser) {
    const row = await this.prisma.stockOldLedger.findFirst({
      where: { id, deletedAt: null },
      include: { goldType: true },
    });
    if (!row) throw new NotFoundException('ບໍ່ພົບລາຍການປະຫວັດສາງຄຳເກົ່າ');

    const day = await this.businessDay.current();
    const isIn = toDec(row.goldInG).gt(0) || toDec(row.goldOutG).eq(0);
    const newWeight = dto.weightG !== undefined ? dec(dto.weightG) : isIn ? toDec(row.goldInG) : toDec(row.goldOutG);
    if (newWeight.lte(0)) throw new BadRequestException('ນ້ຳໜັກຕ້ອງໃຫຍ່ກວ່າ 0');

    const newCost = dto.totalCost !== undefined ? dec(dto.totalCost) : isIn ? toDec(row.priceIn) : toDec(row.priceOut);
    const nextGoldTypeId = dto.goldTypeId ?? row.goldTypeId;

    return this.prisma.$transaction(async (tx) => {
      await this.adjustOldTypeBalance(tx, day.id, row.goldTypeId, {
        inDelta: toDec(row.goldInG).neg(),
        outDelta: toDec(row.goldOutG).neg(),
        priceInDelta: toDec(row.priceIn).neg(),
        priceOutDelta: toDec(row.priceOut).neg(),
      });

      const updated = await tx.stockOldLedger.update({
        where: { id },
        data: {
          goldTypeId: nextGoldTypeId,
          partnerLabel: dto.partnerLabel !== undefined ? dto.partnerLabel : row.partnerLabel,
          goldInG: isIn ? D(newWeight) : D(dec(0)),
          goldOutG: !isIn ? D(newWeight) : D(dec(0)),
          priceIn: isIn ? D(newCost) : D(dec(0)),
          priceOut: !isIn ? D(newCost) : D(dec(0)),
        },
      });

      await this.adjustOldTypeBalance(tx, day.id, nextGoldTypeId, {
        inDelta: isIn ? newWeight : dec(0),
        outDelta: !isIn ? newWeight : dec(0),
        priceInDelta: isIn ? newCost : dec(0),
        priceOutDelta: !isIn ? newCost : dec(0),
      });

      await this.recomputeOldLedgerRunningTotals(tx);

      await this.audit.record(
        {
          actorId: user.id,
          action: 'UPDATE',
          entity: 'StockOldLedger',
          entityId: id,
          before: {
            goldTypeId: row.goldTypeId,
            goldInG: row.goldInG.toFixed(),
            goldOutG: row.goldOutG.toFixed(),
            priceIn: row.priceIn.toFixed(),
            priceOut: row.priceOut.toFixed(),
          },
          after: {
            goldTypeId: nextGoldTypeId,
            weightG: newWeight.toFixed(),
            cost: newCost.toFixed(),
          },
          summary: `ແກ້ໄຂປະຫວັດສາງຄຳເກົ່າ ${row.typeLabel} — ${newWeight.toFixed()} g`,
        },
        tx,
      );

      return updated;
    });
  }

  async deleteOldHistoryRow(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.stockOldLedger.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('ບໍ່ພົບລາຍການປະຫວັດສາງຄຳເກົ່າ');

    if (row.movementId) {
      return this.deleteMovement(row.movementId, user);
    }

    const day = await this.businessDay.current();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await this.adjustOldTypeBalance(tx, day.id, row.goldTypeId, {
        inDelta: toDec(row.goldInG).neg(),
        outDelta: toDec(row.goldOutG).neg(),
        priceInDelta: toDec(row.priceIn).neg(),
        priceOutDelta: toDec(row.priceOut).neg(),
      });

      const updated = await tx.stockOldLedger.update({
        where: { id },
        data: { deletedAt: now },
      });

      await this.recomputeOldLedgerRunningTotals(tx);

      await this.audit.record(
        {
          actorId: user.id,
          action: 'DELETE',
          entity: 'StockOldLedger',
          entityId: id,
          before: { typeLabel: row.typeLabel, goldInG: row.goldInG.toFixed(), goldOutG: row.goldOutG.toFixed() },
          after: { deletedAt: now.toISOString() },
          summary: `ລຶບປະຫວັດສາງຄຳເກົ່າ ${row.typeLabel}`,
        },
        tx,
      );

      return updated;
    });
  }

  private async adjustOldTypeBalance(
    tx: Prisma.TransactionClient,
    businessDayId: string,
    goldTypeId: string,
    deltas: {
      inDelta: Decimal;
      outDelta: Decimal;
      priceInDelta: Decimal;
      priceOutDelta: Decimal;
    },
  ) {
    const key = {
      businessDayId_goldTypeId: { businessDayId, goldTypeId },
    };
    const existing = await tx.stockOldTypeBalance.findUnique({ where: key });

    let openingWeightG = toDec(existing?.openingWeightG);
    let openingCost = toDec(existing?.openingCost);

    if (!existing) {
      const latestPrev = await tx.stockOldTypeBalance.findFirst({
        where: { goldTypeId, businessDayId: { not: businessDayId } },
        orderBy: [{ businessDay: { date: 'desc' } }, { updatedAt: 'desc' }],
      });
      if (latestPrev) {
        openingWeightG = toDec(latestPrev.closingWeightG);
        openingCost = toDec(latestPrev.closingCost);
      }
    }

    const inG = toDec(existing?.inG).plus(deltas.inDelta);
    const outG = toDec(existing?.outG).plus(deltas.outDelta);
    const priceIn = toDec(existing?.priceIn).plus(deltas.priceInDelta);
    const priceOut = toDec(existing?.priceOut).plus(deltas.priceOutDelta);

    const clampedInG = inG.lt(0) ? dec(0) : inG;
    const clampedOutG = outG.lt(0) ? dec(0) : outG;
    const clampedPriceIn = priceIn.lt(0) ? dec(0) : priceIn;
    const clampedPriceOut = priceOut.lt(0) ? dec(0) : priceOut;

    const data = {
      inG: D(clampedInG),
      outG: D(clampedOutG),
      priceIn: D(clampedPriceIn),
      priceOut: D(clampedPriceOut),
      closingWeightG: D(openingWeightG.plus(clampedInG).minus(clampedOutG)),
      closingCost: D(openingCost.plus(clampedPriceIn).minus(clampedPriceOut)),
    };

    await tx.stockOldTypeBalance.upsert({
      where: key,
      update: data,
      create: {
        businessDayId,
        goldTypeId,
        openingWeightG: D(openingWeightG),
        openingCost: D(openingCost),
        ...data,
      },
    });
  }

  async recomputeNewLedgerRunningTotals(tx: Prisma.TransactionClient) {
    const rows = await tx.stockNewLedger.findMany({
      where: { deletedAt: null },
      orderBy: [{ businessDate: 'asc' }, { sequence: 'asc' }],
    });
    let runningWeight = dec(0);
    let runningCost = dec(0);
    for (const row of rows) {
      runningWeight = runningWeight.plus(toDec(row.goldInG)).minus(toDec(row.goldOutG));
      runningCost = runningCost.plus(toDec(row.priceIn)).minus(toDec(row.priceOut));
      await tx.stockNewLedger.update({
        where: { id: row.id },
        data: {
          weightG: D(runningWeight),
          cost: D(runningCost),
        },
      });
    }
  }

  async recomputeOldLedgerRunningTotals(tx: Prisma.TransactionClient) {
    const rows = await tx.stockOldLedger.findMany({
      where: { deletedAt: null },
      orderBy: [{ businessDate: 'asc' }, { sequence: 'asc' }],
    });
    let runningWeight = dec(0);
    let runningCost = dec(0);
    for (const row of rows) {
      runningWeight = runningWeight.plus(toDec(row.goldInG)).minus(toDec(row.goldOutG));
      runningCost = runningCost.plus(toDec(row.priceIn)).minus(toDec(row.priceOut));
      await tx.stockOldLedger.update({
        where: { id: row.id },
        data: {
          weightG: D(runningWeight),
          cost: D(runningCost),
        },
      });
    }
  }

  async recomputeGoldApArRunningTotals(
    tx: Prisma.TransactionClient,
    partnerId: string,
    side: 'AP' | 'AR',
  ) {
    const rows = await tx.goldApArLedger.findMany({
      where: { partnerId, side, deletedAt: null },
      orderBy: [{ businessDate: 'asc' }, { sequence: 'asc' }],
    });
    let runningWeight = dec(0);
    let runningCost = dec(0);
    for (const row of rows) {
      runningWeight = runningWeight.plus(toDec(row.goldInG)).minus(toDec(row.goldOutG));
      runningCost = runningCost.plus(toDec(row.priceIn)).minus(toDec(row.priceOut));
      await tx.goldApArLedger.update({
        where: { id: row.id },
        data: {
          weightG: D(runningWeight),
          cost: D(runningCost),
        },
      });
    }
  }

}
