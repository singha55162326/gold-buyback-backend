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
  ReviewStockDto,
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
  ) {}

  /* ---------------------------------------------------------------- *
   * Stock IN — §7.1 (NEW) and §7.2 (OLD)
   * ---------------------------------------------------------------- */

  /**
   * Stock IN takes effect immediately: the gold is physically in the shop, so
   * withholding it from the ledger would understate what the shop holds.
   */
  async stockIn(dto: CreateStockInDto, user: AuthenticatedUser) {
    const partner = await this.prisma.partnerSource.findFirst({
      where: { id: dto.partnerId, deletedAt: null },
    });
    if (!partner) throw new NotFoundException('ບໍ່ພົບແຫຼ່ງທີ່ມາ');

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
    const laborFeeThb = dec(dto.laborFeeThb ?? 0);

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          code: await this.nextCode(tx, 'IN'),
          scope: dto.scope,
          type: 'IN',
          partnerId: dto.partnerId,
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
        partnerId: dto.partnerId,
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

    // OUT is costed at WAC, so the cost of goods sold reflects the blended
    // acquisition price rather than whatever the newest purchase happened to be.
    const wac = await this.stockLedger.currentWac();
    const perG = wac.pricePerG;
    const totalCost = totalGoldG.mul(perG);

    const goldPercent = dto.goldPercent ? dec(dto.goldPercent) : null;

    const movement = await this.prisma.stockMovement.create({
      data: {
        code: await this.nextCode(this.prisma, 'OUT'),
        scope: dto.scope,
        type: 'OUT',
        partnerId: dto.partnerId,
        cabinetId: dto.cabinetId ?? null,
        transformType: dto.transformType ?? null,
        goldPercent: goldPercent ? D(goldPercent) : null,
        expectedReturnG: goldPercent ? D(expectedReturnWeight(totalGoldG, goldPercent)) : null,
        totalQuantity,
        totalGoldG: D(totalGoldG),
        totalCost: D(totalCost),
        pricePerG: D(perG),
        pricePerBaht: D(pricePerBaht(perG)),
        status: 'PENDING',
        note: dto.note ?? null,
        createdById: user.id,
        lines: {
          create: lines.map((line) => ({
            goldSkuId: line.goldSkuId ?? null,
            goldTypeId: line.goldTypeId ?? null,
            weightG: D(dec(line.weightG)),
            quantity: line.quantity,
            goldG: D(line.goldG),
            cost: D(line.goldG.mul(perG)),
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

    await this.notifications.notify({
      kind: 'STOCK_OUT_APPROVAL',
      recipientRole: 'ADMIN',
      title: 'ມີ Stock OUT ລໍຖ້າອະນຸມັດ',
      body: `${movement.code} — ${totalGoldG.toFixed()} g ໄປ ${partner.nameLo}`,
      refType: 'StockMovement',
      refId: movement.id,
    });

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
    const isFactory = movement.partner.code === 'FACTORY';

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
      await this.apar.postGold(tx, {
        scope: movement.scope as StockScope,
        type: 'OUT',
        partnerId: movement.partnerId,
        weightG: totalGoldG,
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

  listFactoryTracking() {
    return this.prisma.factoryOutTracking.findMany({
      include: { movement: { include: { lines: true, partner: true } }, partner: true },
      orderBy: { createdAt: 'desc' },
    });
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
    if (!assessed.isFinite() || assessed.lte(0)) {
      throw new BadRequestException('ນ້ຳໜັກທີ່ FACTORY ປະເມີນຕ້ອງໃຫຍ່ກວ່າ 0');
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

    const wac = await this.stockLedger.currentWac();
    const perG = wac.pricePerG;
    const totalCost = totalGoldG.mul(perG);
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

  async createHandover(dto: CreateHandoverDto, user: AuthenticatedUser, shiftId: string) {
    const weightG = dec(dto.weightG);
    if (weightG.lte(0)) throw new BadRequestException('ນ້ຳໜັກຕ້ອງໃຫຍ່ກວ່າ 0');

    const handover = await this.prisma.goldHandover.create({
      data: {
        code: await this.nextCode(this.prisma, 'HO'),
        shiftId,
        goldTypeId: dto.goldTypeId,
        weightG: D(weightG),
        note: dto.note ?? null,
        status: 'PENDING',
        createdById: user.id,
      },
    });

    await this.notifications.notify({
      kind: 'GOLD_HANDOVER',
      recipientRole: 'WAREHOUSE',
      title: 'ມີການມອບຄຳລະຫວ່າງມື້',
      body: `${handover.code} — ${weightG.toFixed()} g`,
      refType: 'GoldHandover',
      refId: handover.id,
    });

    return handover;
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

  listMovements(scope?: StockScope, status?: ApprovalStatus) {
    return this.prisma.stockMovement.findMany({
      where: { deletedAt: null, ...(scope ? { scope } : {}), ...(status ? { status } : {}) },
      include: { lines: true, partner: true, cabinet: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  newHistory(limit = 200) {
    return this.prisma.stockNewLedger.findMany({
      where: { deletedAt: null },
      orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
      take: Math.min(limit, 500),
    });
  }

  oldHistory(limit = 200) {
    return this.prisma.stockOldLedger.findMany({
      where: { deletedAt: null },
      include: { goldType: true },
      orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
      take: Math.min(limit, 500),
    });
  }

  async oldBalances() {
    const day = await this.businessDay.current();
    return this.prisma.stockOldTypeBalance.findMany({
      where: { businessDayId: day.id },
      include: { goldType: true },
      orderBy: { goldType: { sortOrder: 'asc' } },
    });
  }

  async newBalances() {
    const day = await this.businessDay.current();
    return this.prisma.stockNewSkuBalance.findMany({
      where: { businessDayId: day.id },
      include: { goldSku: { include: { goldItem: true } } },
      orderBy: { goldSku: { fullSkuName: 'asc' } },
    });
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
    const businessDate = BusinessDayService.toDateOnly();
    const tomorrow = new Date(businessDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [goldTypes, buybacks, exchanges] = await Promise.all([
      this.prisma.goldType.findMany({
        where: { isStockType: true, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.buyback.findMany({
        where: {
          deletedAt: null,
          status: 'COMPLETED',
          createdAt: { gte: businessDate, lt: tomorrow },
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

      const weightG = rows.reduce(
        (sum, r) => sum.plus(toDec(r.weightG).mul(r.quantity)),
        dec(0),
      );
      const quantity = rows.reduce((sum, r) => sum + r.quantity, 0);
      const totalPaid = rows.reduce((sum, r) => sum.plus(toDec(r.payableAmount)), dec(0));
      const newWeightG = newWeightByType.get(goldType.id) ?? dec(0);

      const average = goldTypeAverage(
        totalPaid,
        weightG,
        newWeightG,
        goldType.code === 'BOILED',
      );

      return {
        goldTypeId: goldType.id,
        goldTypeCode: goldType.code,
        goldTypeNameLo: goldType.nameLo,
        weightG: weightG.toFixed(),
        bahtWeight: gramsToBaht(weightG).toFixed(),
        quantity,
        totalPaid: totalPaid.toFixed(),
        newWeightG: newWeightG.toFixed(),
        averagePerGram: average.perGram ? average.perGram.toFixed() : null,
        averagePerBaht: average.perBaht ? average.perBaht.toFixed() : null,
        averageMessageLo: average.messageLo,
      };
    });
  }

  listHandovers(status?: ApprovalStatus) {
    return this.prisma.goldHandover.findMany({
      where: { deletedAt: null, ...(status ? { status } : {}) },
      include: { goldType: true, shift: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
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
}
