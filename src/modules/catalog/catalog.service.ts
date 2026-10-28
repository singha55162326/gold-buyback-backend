import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { CodeGeneratorService } from '../../common/services/code-generator.service';

/**
 * Simple reference data shared across the whole system:
 * ປະເພດຄຳ (§3.5), ລາຍການຄຳ (§3.5), ຕູ້ເຄື່ອງ (§3.7),
 * ແຫຼ່ງຮັບເຂົ້າ/ສົ່ງອອກ (§3.7) and bank accounts.
 *
 * All five behave identically — list, create, rename, soft-delete — so they
 * share one service rather than five near-copies.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly codes: CodeGeneratorService,
  ) {}

  /**
   * Refuse a delete that would orphan history.
   *
   * Reference data is pointed at by ledgers and receipts that must stay
   * readable years later, so "ລົບ" here means retiring a row nothing has
   * used yet. Anything already in use is deactivated instead, which keeps it
   * out of the pickers without breaking the rows that name it.
   */
  private async assertUnused(
    labelLo: string,
    counts: Array<[string, Promise<number>]>,
  ): Promise<void> {
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

  // --- ປະເພດຄຳ -------------------------------------------------------------

  /**
   * `withActor` ແປະຊື່ຜູ້ບັນທຶກໃສ່ແຕ່ລະແຖວ — ເປີດໃຊ້ແຕ່ໜ້າ Admin ທີ່ສະແດງ
   * ຕາຕະລາງ, ບໍ່ແມ່ນ dropdown ທົ່ວລະບົບ ເພື່ອບໍ່ໃຫ້ມີ query ເພີ່ມທຸກບ່ອນ.
   */
  async listGoldTypes(stockOnly = false, withActor = false) {
    const rows = await this.prisma.goldType.findMany({
      where: { deletedAt: null, isActive: true, ...(stockOnly ? { isStockType: true } : {}) },
      orderBy: { sortOrder: 'asc' },
    });
    return withActor ? this.audit.withCreatorsFromAudit('GoldType', rows) : rows;
  }

  async createGoldType(data: { nameLo: string; isStockType?: boolean }, actorId: string) {
    const max = await this.prisma.goldType.aggregate({ _max: { sortOrder: true } });
    const code = await this.codes.nextFor('GOLD_TYPE', this.prisma.goldType);
    const created = await this.prisma.goldType.create({
      data: {
        code,
        nameLo: data.nameLo.trim(),
        isStockType: data.isStockType ?? false,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
    await this.audit.record({
      actorId, action: 'CREATE', entity: 'GoldType', entityId: created.id,
      after: created, summary: `ເພີ່ມປະເພດຄຳ ${created.nameLo}`,
    });
    return created;
  }

  // --- ລາຍການຄຳ -----------------------------------------------------------

  async listGoldItems(withActor = false) {
    const rows = await this.prisma.goldItem.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return withActor ? this.audit.withCreatorsFromAudit('GoldItem', rows) : rows;
  }

  async createGoldItem(data: { nameLo: string }, actorId: string) {
    const max = await this.prisma.goldItem.aggregate({ _max: { sortOrder: true } });
    const code = await this.codes.nextFor('GOLD_ITEM', this.prisma.goldItem);
    const created = await this.prisma.goldItem.create({
      data: {
        code,
        nameLo: data.nameLo.trim(),
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
    await this.audit.record({
      actorId, action: 'CREATE', entity: 'GoldItem', entityId: created.id,
      after: created, summary: `ເພີ່ມລາຍການຄຳ ${created.nameLo}`,
    });
    return created;
  }

  // --- ຕູ້ເຄື່ອງ -------------------------------------------------------------

  async listCabinets(withActor = false) {
    const rows = await this.prisma.cabinet.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { code: 'asc' },
    });
    return withActor ? this.audit.withCreatorsFromAudit('Cabinet', rows) : rows;
  }

  async createCabinet(data: { nameLo: string }, actorId: string) {
    const code = await this.codes.nextFor('CABINET', this.prisma.cabinet);
    const created = await this.prisma.cabinet.create({
      data: { code, nameLo: data.nameLo.trim() },
    });
    await this.audit.record({
      actorId, action: 'CREATE', entity: 'Cabinet', entityId: created.id,
      after: created, summary: `ເພີ່ມຕູ້ເຄື່ອງ ${created.nameLo}`,
    });
    return created;
  }

  /**
   * ຕູ້ເຄື່ອງ detail — the View button lists the gold currently assigned to a
   * cabinet with its total weight (TOR §3.7).
   */
  /**
   * ລາຍການຄຳໃນຕູ້ເຄື່ອງ.
   *
   * range ກອງຕາມວັນທີທີ່ຄຳເຂົ້າຕູ້ (ວັນທີຂອງລາຍການປ່ຽນ). ຕ້ອງເປັນທາງເລືອກ
   * ບໍ່ແມ່ນຄ່າເລີ່ມຕົ້ນ: ການກວດກ່ອນລຶບຕູ້ ຕ້ອງເຫັນຄຳທັງໝົດ ບໍ່ແມ່ນສະເພາະມື້ນີ້
   * — ບໍ່ດັ່ງນັ້ນ ຕູ້ທີ່ມີຄຳເກົ່າຢູ່ ຈະຖືກລຶບໄດ້.
   */
  async cabinetContents(id: string, range?: { gte: Date; lt: Date }) {
    const cabinet = await this.prisma.cabinet.findFirst({ where: { id, deletedAt: null } });
    if (!cabinet) throw new NotFoundException('ບໍ່ພົບຕູ້ເຄື່ອງ');

    const lines = await this.prisma.exchangeNewLine.findMany({
      where: {
        cabinetId: id,
        ...(range ? { exchange: { createdAt: range } } : {}),
      },
      include: { goldSku: true, exchange: { select: { code: true, createdAt: true } } },
      orderBy: { exchange: { createdAt: 'desc' } },
    });

    const totalWeightG = lines.reduce(
      (sum, l) => sum + Number(l.weightG) * l.quantity,
      0,
    );

    return { cabinet, lines, totalWeightG: totalWeightG.toFixed(4) };
  }

  // --- ແຫຼ່ງຮັບເຂົ້າ / ແຫຼ່ງສົ່ງອອກ -------------------------------------------

  async listPartners(direction?: 'IN' | 'OUT', withActor = false) {
    const rows = await this.prisma.partnerSource.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(direction ? { direction: { in: [direction, 'BOTH'] } } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });
    return withActor ? this.audit.withCreatorsFromAudit('PartnerSource', rows) : rows;
  }

  async createPartner(
    data: { nameLo: string; direction: 'IN' | 'OUT' | 'BOTH'; tracksGoldApAr?: boolean },
    actorId: string,
  ) {
    const max = await this.prisma.partnerSource.aggregate({ _max: { sortOrder: true } });
    const code = await this.codes.nextFor('PARTNER', this.prisma.partnerSource);
    const created = await this.prisma.partnerSource.create({
      data: {
        code,
        nameLo: data.nameLo.trim(),
        direction: data.direction,
        tracksGoldApAr: data.tracksGoldApAr ?? false,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
    await this.audit.record({
      actorId, action: 'CREATE', entity: 'PartnerSource', entityId: created.id,
      after: created, summary: `ເພີ່ມແຫຼ່ງ ${created.nameLo}`,
    });
    return created;
  }

  // --- ທະນາຄານ -------------------------------------------------------------

  async listBankAccounts(withActor = false) {
    const rows = await this.prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return withActor ? this.audit.withCreatorsFromAudit('BankAccount', rows) : rows;
  }

  // --- ແກ້ໄຂ / ລຶບ ----------------------------------------------------------

  async updateGoldType(
    id: string,
    data: { nameLo?: string; isStockType?: boolean; isActive?: boolean },
    actorId: string,
  ) {
    const before = await this.prisma.goldType.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('ບໍ່ພົບປະເພດຄຳ');
    const after = await this.prisma.goldType.update({
      where: { id },
      data: {
        ...(data.nameLo !== undefined ? { nameLo: data.nameLo.trim() } : {}),
        ...(data.isStockType !== undefined ? { isStockType: data.isStockType } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await this.audit.record({
      actorId, action: 'UPDATE', entity: 'GoldType', entityId: id,
      before, after, summary: `ແກ້ໄຂປະເພດຄຳ ${after.nameLo}`,
    });
    return after;
  }

  async deleteGoldType(id: string, actorId: string) {
    const before = await this.prisma.goldType.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('ບໍ່ພົບປະເພດຄຳ');

    await this.assertUnused('ປະເພດຄຳ', [
      ['Buyback', this.prisma.buyback.count({ where: { goldTypeId: id } })],
      ['ລາຍການປ່ຽນ', this.prisma.exchangeOldLine.count({ where: { goldTypeId: id } })],
      ['Stock (OLD)', this.prisma.stockOldLedger.count({ where: { goldTypeId: id } })],
      ['ມອບຄຳ', this.prisma.goldHandover.count({ where: { goldTypeId: id } })],
      ['ລາຍການເຄື່ອນໄຫວສາງ', this.prisma.stockMovementLine.count({ where: { goldTypeId: id } })],
    ]);

    const after = await this.prisma.goldType.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.record({
      actorId, action: 'DELETE', entity: 'GoldType', entityId: id,
      before, after, summary: `ລຶບປະເພດຄຳ ${before.nameLo}`,
    });
    return after;
  }

  async updateGoldItem(id: string, data: { nameLo?: string; isActive?: boolean }, actorId: string) {
    const before = await this.prisma.goldItem.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('ບໍ່ພົບລາຍການຄຳ');
    const after = await this.prisma.goldItem.update({
      where: { id },
      data: {
        ...(data.nameLo !== undefined ? { nameLo: data.nameLo.trim() } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await this.audit.record({
      actorId, action: 'UPDATE', entity: 'GoldItem', entityId: id,
      before, after, summary: `ແກ້ໄຂລາຍການຄຳ ${after.nameLo}`,
    });
    return after;
  }

  async deleteGoldItem(id: string, actorId: string) {
    const before = await this.prisma.goldItem.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('ບໍ່ພົບລາຍການຄຳ');

    await this.assertUnused('ລາຍການຄຳ', [
      ['SKU', this.prisma.goldSku.count({ where: { goldItemId: id, deletedAt: null } })],
      ['Buyback', this.prisma.buyback.count({ where: { goldItemId: id } })],
      ['ລາຍການປ່ຽນ', this.prisma.exchangeOldLine.count({ where: { goldItemId: id } })],
      ['ສິນເຊື່ອ', this.prisma.goldCredit.count({ where: { goldItemId: id } })],
      ['Order', this.prisma.order.count({ where: { goldItemId: id } })],
    ]);

    const after = await this.prisma.goldItem.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.record({
      actorId, action: 'DELETE', entity: 'GoldItem', entityId: id,
      before, after, summary: `ລຶບລາຍການຄຳ ${before.nameLo}`,
    });
    return after;
  }

  async updateCabinet(id: string, data: { nameLo?: string; isActive?: boolean }, actorId: string) {
    const before = await this.prisma.cabinet.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('ບໍ່ພົບຕູ້ເຄື່ອງ');
    const after = await this.prisma.cabinet.update({
      where: { id },
      data: {
        ...(data.nameLo !== undefined ? { nameLo: data.nameLo.trim() } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await this.audit.record({
      actorId, action: 'UPDATE', entity: 'Cabinet', entityId: id,
      before, after, summary: `ແກ້ໄຂຕູ້ເຄື່ອງ ${after.nameLo}`,
    });
    return after;
  }

  /** ຫ້າມລົບຕູ້ທີ່ຍັງມີສິນຄ້າ. */
  async deleteCabinet(id: string, actorId: string) {
    const before = await this.prisma.cabinet.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('ບໍ່ພົບຕູ້ເຄື່ອງ');

    const contents = await this.cabinetContents(id);
    if (Number(contents.totalWeightG) > 0) {
      throw new BadRequestException(
        `ລຶບຕູ້ນີ້ບໍ່ໄດ້ — ຍັງມີຄຳຢູ່ ${contents.totalWeightG} g. ຍ້າຍຄຳອອກກ່ອນ.`,
      );
    }

    await this.assertUnused('ຕູ້ເຄື່ອງ', [
      ['ສິນເຊື່ອ', this.prisma.goldCredit.count({ where: { cabinetId: id } })],
      ['ລາຍການເຄື່ອນໄຫວສາງ', this.prisma.stockMovement.count({ where: { cabinetId: id } })],
    ]);

    const after = await this.prisma.cabinet.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.record({
      actorId, action: 'DELETE', entity: 'Cabinet', entityId: id,
      before, after, summary: `ລຶບຕູ້ເຄື່ອງ ${before.nameLo}`,
    });
    return after;
  }

  async updatePartner(
    id: string,
    data: {
      nameLo?: string;
      direction?: 'IN' | 'OUT' | 'BOTH';
      tracksGoldApAr?: boolean;
      isActive?: boolean;
    },
    actorId: string,
  ) {
    const before = await this.prisma.partnerSource.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('ບໍ່ພົບແຫຼ່ງຮັບເຂົ້າ/ສົ່ງອອກ');
    const after = await this.prisma.partnerSource.update({
      where: { id },
      data: {
        ...(data.nameLo !== undefined ? { nameLo: data.nameLo.trim() } : {}),
        ...(data.direction !== undefined ? { direction: data.direction } : {}),
        ...(data.tracksGoldApAr !== undefined ? { tracksGoldApAr: data.tracksGoldApAr } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await this.audit.record({
      actorId, action: 'UPDATE', entity: 'PartnerSource', entityId: id,
      before, after, summary: `ແກ້ໄຂແຫຼ່ງ ${after.nameLo}`,
    });
    return after;
  }

  async deletePartner(id: string, actorId: string) {
    const before = await this.prisma.partnerSource.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('ບໍ່ພົບແຫຼ່ງຮັບເຂົ້າ/ສົ່ງອອກ');

    await this.assertUnused('ແຫຼ່ງນີ້', [
      ['ລາຍການເຄື່ອນໄຫວສາງ', this.prisma.stockMovement.count({ where: { partnerId: id } })],
      ['AP/AR (ຄຳ)', this.prisma.goldApArLedger.count({ where: { partnerId: id } })],
      ['AP/AR (ເງິນ)', this.prisma.cashApArLedger.count({ where: { partnerId: id } })],
      ['ຕິດຕາມ FACTORY', this.prisma.factoryOutTracking.count({ where: { partnerId: id } })],
      ['Order', this.prisma.order.count({ where: { supplierId: id } })],
      ['ກົດການລົງບັນຊີ', this.prisma.goldApArPostingRule.count({ where: { partnerId: id } })],
    ]);

    const after = await this.prisma.partnerSource.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.record({
      actorId, action: 'DELETE', entity: 'PartnerSource', entityId: id,
      before, after, summary: `ລຶບແຫຼ່ງ ${before.nameLo}`,
    });
    return after;
  }

}
