import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dec } from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { PricingService } from '../pricing/pricing.service';
import type {
  UpdateDeductionDto,
  UpdateSoftGoldFeeDto,
  UpsertBarFeeDto,
  UpsertJewelryFeeDto,
} from './dto/fee.dto';

/**
 * The fee tables of TOR §3.2 and §3.4.
 *
 * Every one of them is append-only and versioned by `effectiveAt`. Reading
 * the "current" value therefore means taking the newest row per key, and a
 * price quoted last month can still be reproduced exactly.
 */
@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pricing: PricingService,
  ) {}

  private toDecimal(raw: string, label: string, allowZero = true): Prisma.Decimal {
    const value = dec(raw);
    if (!value.isFinite() || value.isNegative() || (!allowZero && value.isZero())) {
      throw new BadRequestException(`${label} ບໍ່ຖືກຕ້ອງ`);
    }
    return new Prisma.Decimal(value.toFixed());
  }

  /**
   * Attach the editor's display name to history rows. One query for the whole
   * page rather than an include per row, which would fan out to a join on
   * every version of every weight.
   */
  private async withEditorNames<T extends { createdById: string }>(rows: T[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    return rows.map((r) => ({ ...r, updatedBy: nameById.get(r.createdById) ?? '—' }));
  }

  /** Keep only the newest row per key from an append-only table. */
  private newestPerKey<T>(rows: T[], key: (row: T) => string): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const row of rows) {
      const k = key(row);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(row);
    }
    return out;
  }

  // --- §3.4 ຄ່າປ່ຽນຮູບປະພັນ --------------------------------------------------

  async currentJewelryFees() {
    const rows = await this.prisma.jewelryConversionFee.findMany({
      orderBy: { effectiveAt: 'desc' },
      include: { tier: true },
    });
    // Retiring a tier appends a tombstone rather than deleting rows, so the
    // newest version has to be inspected before it counts as current.
    return this.newestPerKey(rows, (r) => r.tierCode)
      .filter((r) => r.deletedAt === null)
      .sort((a, b) => a.tier.sortOrder - b.tier.sortOrder);
  }

  async jewelryFeeHistory(limit = 60) {
    const rows = await this.prisma.jewelryConversionFee.findMany({
      orderBy: { effectiveAt: 'desc' },
      include: { tier: true },
      take: Math.min(limit, 500),
    });
    return this.withEditorNames(rows);
  }

  /**
   * Retire a tier's fee. The exchange engine falls back to 0 for a weight it
   * cannot find a fee for, so this silently zeroes ຄ່າຫຍຸບ for that tier —
   * which is why the UI asks for confirmation rather than offering a plain
   * delete button.
   */
  async deleteJewelryFee(tierCode: string, actorId: string) {
    const rows = await this.prisma.jewelryConversionFee.findMany({
      where: { tierCode },
      orderBy: { effectiveAt: 'desc' },
      include: { tier: true },
      take: 1,
    });
    const newest = rows[0];
    if (!newest || newest.deletedAt !== null) {
      throw new NotFoundException('ບໍ່ພົບຄ່າປ່ຽນຂອງນ້ຳໜັກນີ້');
    }

    const created = await this.prisma.jewelryConversionFee.create({
      data: {
        tierCode: newest.tierCode,
        weightG: newest.weightG,
        feeGoodShape: newest.feeGoodShape,
        feeDamagedShape: newest.feeDamagedShape,
        createdById: actorId,
        deletedAt: new Date(),
      },
    });

    await this.audit.record({
      actorId, action: 'DELETE', entity: 'JewelryConversionFee', entityId: created.id,
      before: newest, after: created,
      summary: `ລຶບຄ່າປ່ຽນຮູບປະພັນ ${newest.tier.labelLo}`,
    });
    return created;
  }

  async upsertJewelryFee(dto: UpsertJewelryFeeDto, actorId: string) {
    const tier = await this.prisma.weightTier.findUnique({ where: { code: dto.tierCode } });
    if (!tier) throw new NotFoundException('ບໍ່ພົບນ້ຳໜັກ SKU ທີ່ເລືອກ');

    const created = await this.prisma.jewelryConversionFee.create({
      data: {
        tierCode: dto.tierCode,
        weightG: this.toDecimal(dto.weightG, 'ນ້ຳໜັກ', false),
        feeGoodShape: this.toDecimal(dto.feeGoodShape, 'ຄ່າປ່ຽນຮູບປະພັນດີ'),
        feeDamagedShape: this.toDecimal(dto.feeDamagedShape, 'ຄ່າປ່ຽນເສຍຮູບ'),
        createdById: actorId,
      },
    });

    await this.audit.record({
      actorId, action: 'UPDATE', entity: 'JewelryConversionFee', entityId: created.id,
      after: created, summary: `ອັບເດດຄ່າປ່ຽນຮູບປະພັນ ${tier.labelLo}`,
    });
    return created;
  }

  // --- §3.4 ຄ່າປ່ຽນຄຳແທ່ງ ---------------------------------------------------

  async currentBarFees() {
    const rows = await this.prisma.barConversionFee.findMany({ orderBy: { effectiveAt: 'desc' } });
    return this.newestPerKey(rows, (r) => r.weightG.toFixed())
      .filter((r) => r.deletedAt === null)
      .sort((a, b) => Number(b.weightG) - Number(a.weightG));
  }

  async barFeeHistory(limit = 60) {
    const rows = await this.prisma.barConversionFee.findMany({
      orderBy: { effectiveAt: 'desc' },
      take: Math.min(limit, 500),
    });
    return this.withEditorNames(rows);
  }

  /** Retire a bar weight. See deleteJewelryFee — same tombstone, same caveat. */
  async deleteBarFee(weightG: string, actorId: string) {
    const weight = this.toDecimal(weightG, 'ນ້ຳໜັກ', false);
    const rows = await this.prisma.barConversionFee.findMany({
      where: { weightG: weight },
      orderBy: { effectiveAt: 'desc' },
      take: 1,
    });
    const newest = rows[0];
    if (!newest || newest.deletedAt !== null) {
      throw new NotFoundException('ບໍ່ພົບຄ່າປ່ຽນຂອງນ້ຳໜັກນີ້');
    }

    const created = await this.prisma.barConversionFee.create({
      data: {
        weightG: newest.weightG,
        barToJewelry: newest.barToJewelry,
        barToBar: newest.barToBar,
        createdById: actorId,
        deletedAt: new Date(),
      },
    });

    await this.audit.record({
      actorId, action: 'DELETE', entity: 'BarConversionFee', entityId: created.id,
      before: newest, after: created,
      summary: `ລຶບຄ່າປ່ຽນຄຳແທ່ງ ${newest.weightG.toFixed()} g`,
    });
    return created;
  }

  async upsertBarFee(dto: UpsertBarFeeDto, actorId: string) {
    const created = await this.prisma.barConversionFee.create({
      data: {
        weightG: this.toDecimal(dto.weightG, 'ນ້ຳໜັກ', false),
        barToJewelry: this.toDecimal(dto.barToJewelry, 'ຄຳແທ່ງ-ຮູບປະພັນ'),
        barToBar: this.toDecimal(dto.barToBar, 'ຄຳແທ່ງ-ຄຳແທ່ງ'),
        createdById: actorId,
      },
    });
    await this.audit.record({
      actorId, action: 'UPDATE', entity: 'BarConversionFee', entityId: created.id,
      after: created, summary: `ອັບເດດຄ່າປ່ຽນຄຳແທ່ງ ${created.weightG.toFixed()} g`,
    });
    return created;
  }

  // --- §3.4 ຄ່າອ່ອນ ---------------------------------------------------------

  async currentSoftGoldFee() {
    const row = await this.prisma.softGoldFeeSnapshot.findFirst({
      orderBy: { effectiveAt: 'desc' },
    });
    if (!row) throw new NotFoundException('ຍັງບໍ່ມີການຕັ້ງຄ່າອ່ອນ');
    return row;
  }

  async updateSoftGoldFee(dto: UpdateSoftGoldFeeDto, actorId: string) {
    const created = await this.prisma.softGoldFeeSnapshot.create({
      data: { value: this.toDecimal(dto.value, 'ຄ່າຄຳອ່ອນ'), createdById: actorId },
    });
    await this.audit.record({
      actorId, action: 'UPDATE', entity: 'SoftGoldFeeSnapshot', entityId: created.id,
      after: created, summary: `ອັບເດດຄ່າອ່ອນ = ${created.value.toFixed(0)}`,
    });
    return created;
  }

  async softGoldFeeHistory(limit = 30) {
    const rows = await this.prisma.softGoldFeeSnapshot.findMany({
      orderBy: { effectiveAt: 'desc' },
      take: Math.min(limit, 200),
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    return rows.map((r) => ({ ...r, updatedBy: nameById.get(r.createdById) ?? '—' }));
  }

  // --- §3.2 ຫັກອອກ (%) / ລາຄາລົບອອກ -----------------------------------------

  async currentDeductions() {
    const rows = await this.prisma.buybackDeductionRule.findMany({
      orderBy: { effectiveAt: 'desc' },
      include: { tier: true },
    });
    return this.newestPerKey(rows, (r) => r.tierCode).sort(
      (a, b) => a.tier.sortOrder - b.tier.sortOrder,
    );
  }

  async updateDeduction(dto: UpdateDeductionDto, actorId: string) {
    const tier = await this.prisma.weightTier.findUnique({ where: { code: dto.tierCode } });
    if (!tier) throw new NotFoundException('ບໍ່ພົບນ້ຳໜັກ SKU ທີ່ເລືອກ');

    const value = dec(dto.value);
    if (dto.kind === 'PERCENT' && (value.lt(0) || value.gte(100))) {
      throw new BadRequestException('ຫັກອອກ (%) ຕ້ອງຢູ່ລະຫວ່າງ 0 ຫາ 100');
    }

    const created = await this.prisma.buybackDeductionRule.create({
      data: {
        tierCode: dto.tierCode,
        kind: dto.kind,
        value: this.toDecimal(dto.value, 'ຄ່າຫັກ'),
        createdById: actorId,
      },
    });

    await this.audit.record({
      actorId, action: 'UPDATE', entity: 'BuybackDeductionRule', entityId: created.id,
      after: created,
      summary: `ອັບເດດຄ່າຫັກຊື້ຄືນ ${tier.labelLo}`,
    });

    /*
     * Re-price immediately.
     *
     * ລາຄາຊື້ຄືນ is derived from this rule, but it is READ from a price
     * snapshot — so changing the rule used to leave every quoted buyback
     * price on the old figure until someone retyped the gold price. The
     * shop would have edited the rule, seen ຈັດການ Products unchanged, and
     * reasonably concluded the edit had not saved.
     *
     * Both tables are append-only, so this keeps BOTH histories: the rule
     * change is its own row, and the re-priced board is a new snapshot
     * beside the old ones. Nothing is overwritten and every past quote can
     * still be re-derived from the snapshot that was current at the time.
     */
    const board = await this.pricing.recalculate(
      actorId,
      dto.kind === 'PERCENT'
        ? `ຄ່າຫັກ ${tier.labelLo} = ${created.value.toFixed()}% — ຄຳນວນລາຄາຊື້ຄືນຄືນ`
        : `ລາຄາລົບອອກ ${tier.labelLo} = ${created.value.toFixed(0)} — ຄຳນວນລາຄາຊື້ຄືນຄືນ`,
    );

    return { ...created, board };
  }
}
