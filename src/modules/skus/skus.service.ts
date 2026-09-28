import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dec, GRAMS_PER_BAHT, trimTrailingZeros, type Decimal } from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import type { CreateSkuDto, UpdateSkuDto } from './dto/sku.dto';

/**
 * TOR §3.6 — ລະບົບຈັດການ SKU ນ້ຳໜັກຂອງຄຳ.
 *
 *   ຜູ້ໃຊ້ປ້ອນ ຊື່ສິນຄ້າ + ນ້ຳໜັກ (g)
 *     -> ບາດຄຳ = weight_g / 15
 *     -> full_sku_name = [ຊື່ສິນຄ້າ] + [ບາດຄຳ] + " ບາດ"
 *
 * Worked example from the TOR: 'ສາຍແຂນ' at 15 g -> 1.00 ບາດ -> 'ສາຍແຂນ 1 ບາດ'.
 */
@Injectable()
export class SkusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * ບາດຄຳ = g / 15, shown to two decimals but with trailing zeros trimmed so
   * 15 g reads "1 ບາດ" rather than "1.00 ບາດ" — matching the TOR example.
   */
  static bahtWeight(weightG: Decimal): Decimal {
    return weightG.div(GRAMS_PER_BAHT);
  }

  static formatBaht(baht: Decimal): string {
    return trimTrailingZeros(baht.toDecimalPlaces(2).toFixed());
  }

  /** The derived name — exported so the web client can preview it live. */
  static buildFullSkuName(nameLo: string, weightG: Decimal): string {
    return `${nameLo.trim()} ${SkusService.formatBaht(SkusService.bahtWeight(weightG))} ບາດ`;
  }

  private parseWeight(raw: string): Decimal {
    const weight = dec(raw);
    if (!weight.isFinite() || weight.lte(0)) {
      throw new BadRequestException('ນ້ຳໜັກຕ້ອງໃຫຍ່ກວ່າ 0');
    }
    return weight;
  }

  /** Real-time preview for the SKU builder — no write. */
  preview(nameLo: string, weightG: string) {
    const weight = this.parseWeight(weightG);
    const baht = SkusService.bahtWeight(weight);
    return {
      weightG: weight.toFixed(),
      bahtWeight: baht.toFixed(),
      bahtWeightDisplay: SkusService.formatBaht(baht),
      fullSkuName: SkusService.buildFullSkuName(nameLo, weight),
    };
  }

  async list(includeInactive = false) {
    return this.prisma.goldSku.findMany({
      where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      include: { goldItem: true },
      orderBy: [{ goldItem: { sortOrder: 'asc' } }, { weightG: 'desc' }],
    });
  }

  async create(dto: CreateSkuDto, actorId: string) {
    const weight = this.parseWeight(dto.weightG);

    const goldItem = await this.prisma.goldItem.findFirst({
      where: { id: dto.goldItemId, deletedAt: null },
    });
    if (!goldItem) throw new NotFoundException('ບໍ່ພົບລາຍການຄຳທີ່ເລືອກ');

    const duplicate = await this.prisma.goldSku.findFirst({
      where: { goldItemId: dto.goldItemId, weightG: new Prisma.Decimal(weight.toFixed()), deletedAt: null },
    });
    if (duplicate) throw new ConflictException('SKU ນ້ຳໜັກນີ້ມີຢູ່ແລ້ວ');

    const created = await this.prisma.goldSku.create({
      data: {
        goldItemId: dto.goldItemId,
        nameLo: dto.nameLo.trim(),
        weightG: new Prisma.Decimal(weight.toFixed()),
        bahtWeight: new Prisma.Decimal(SkusService.bahtWeight(weight).toFixed()),
        fullSkuName: SkusService.buildFullSkuName(dto.nameLo, weight),
        createdById: actorId,
      },
      include: { goldItem: true },
    });

    await this.audit.record({
      actorId,
      action: 'CREATE',
      entity: 'GoldSku',
      entityId: created.id,
      after: { fullSkuName: created.fullSkuName, weightG: created.weightG.toFixed() },
      summary: `ເພີ່ມ SKU ${created.fullSkuName}`,
    });

    return created;
  }

  async update(id: string, dto: UpdateSkuDto, actorId: string) {
    const existing = await this.prisma.goldSku.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('ບໍ່ພົບ SKU');

    const weight = dto.weightG ? this.parseWeight(dto.weightG) : dec(existing.weightG.toFixed());
    const nameLo = dto.nameLo?.trim() ?? existing.nameLo;

    const updated = await this.prisma.goldSku.update({
      where: { id },
      data: {
        nameLo,
        weightG: new Prisma.Decimal(weight.toFixed()),
        bahtWeight: new Prisma.Decimal(SkusService.bahtWeight(weight).toFixed()),
        fullSkuName: SkusService.buildFullSkuName(nameLo, weight),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      },
      include: { goldItem: true },
    });

    await this.audit.record({
      actorId,
      action: 'UPDATE',
      entity: 'GoldSku',
      entityId: id,
      before: { fullSkuName: existing.fullSkuName, weightG: existing.weightG.toFixed() },
      after: { fullSkuName: updated.fullSkuName, weightG: updated.weightG.toFixed() },
    });

    return updated;
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.goldSku.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('ບໍ່ພົບ SKU');

    // Soft delete so the row still resolves in historic stock movements and
    // surfaces in the Deleted List module.
    const removed = await this.prisma.goldSku.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.record({
      actorId,
      action: 'DELETE',
      entity: 'GoldSku',
      entityId: id,
      before: { fullSkuName: existing.fullSkuName },
      summary: `ລຶບ SKU ${existing.fullSkuName}`,
    });

    return removed;
  }
}
