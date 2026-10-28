import { Injectable } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  summary?: string;
  ipAddress?: string | null;
}

/**
 * TOR §10 — Audit Logs ທຸກການເພີ່ມ, ແກ້ໄຂ, ເບີກ, ມອບ, Approve, Reject.
 *
 * Pass the transaction client when auditing inside a $transaction so the log
 * commits or rolls back together with the change it describes.
 */
@Injectable()
export class AuditService {
  /** ຜູ້ບັນທຶກ ຂອງຂໍ້ມູນຕັ້ງຕົ້ນທີ່ມາພ້ອມການຕິດຕັ້ງລະບົບ. */
  static readonly SEEDED_BY = 'ຕິດຕັ້ງເບື້ອງຕົ້ນ';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve `createdById` / `approvedById` on a list of rows into display
   * names, in one query rather than per row.
   *
   * The TOR asks for UPDATED BY on every History table (§5.1, §5.2, §5.3),
   * but those columns are plain id strings rather than relations — keeping
   * them unlinked avoids a foreign key on every transactional table purely
   * for a label.
   *
   * Two different questions get two different fields, because the answers
   * differ on any record that was reviewed by someone other than its author:
   * `createdBy` = ຜູ້ບັນທຶກ (ຜູ້ລົງລາຍການ), `updatedBy` = ມືສຸດທ້າຍ.
   */
  async withActorNames<T extends { createdById?: string | null; approvedById?: string | null }>(
    rows: T[],
  ): Promise<Array<T & { createdBy: string; updatedBy: string }>> {
    const ids = [
      ...new Set(
        rows.flatMap((r) => [r.createdById, r.approvedById]).filter((v): v is string => Boolean(v)),
      ),
    ];
    if (ids.length === 0) {
      return rows.map((r) => ({ ...r, createdBy: '—', updatedBy: '—' }));
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));

    // The approver is the most recent hand on the record; fall back to the
    // creator when it has not been reviewed yet.
    return rows.map((r) => ({
      ...r,
      createdBy: (r.createdById ? nameById.get(r.createdById) : undefined) ?? '—',
      updatedBy:
        (r.approvedById ? nameById.get(r.approvedById) : undefined) ??
        (r.createdById ? nameById.get(r.createdById) : undefined) ??
        '—',
    }));
  }

  /**
   * ແປະຊື່ **ຜູ້ບັນທຶກ** ໃສ່ແຖວທີ່ບໍ່ມີຂັ້ນຕອນອະນຸມັດ (ບັນຊີ, ສາງ, ຝາກສິນຄ້າ ຯລ).
   *
   * ລູກຄ້າຂໍວ່າ ທຸກ Module ທີ່ມີການສ້າງລາຍການຫຼືທຸລະກຳ ຕ້ອງເຫັນວ່າ User ໃດ
   * ເປັນຄົນລົງ. ດຶງຊື່ເປັນ query ດຽວຕໍ່ໜ້າ ແທນການ join ຕໍ່ແຖວ.
   */
  async withCreatorNames<T extends { createdById?: string | null }>(
    rows: T[],
  ): Promise<Array<T & { createdBy: string }>> {
    const ids = [...new Set(rows.map((r) => r.createdById).filter((v): v is string => Boolean(v)))];
    if (ids.length === 0) return rows.map((r) => ({ ...r, createdBy: '—' }));

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    return rows.map((r) => ({
      ...r,
      createdBy: (r.createdById ? nameById.get(r.createdById) : undefined) ?? '—',
    }));
  }

  /**
   * ຜູ້ບັນທຶກ ສຳລັບຕາຕະລາງ Catalog ທີ່ບໍ່ມີຖັນ `createdById` (ປະເພດຄຳ, ຕູ້,
   * ແຫຼ່ງທີ່ມາ, ບັນຊີທະນາຄານ, ໝວດ, ຜູ້ໃຊ້).
   *
   * ອ່ານຈາກ Audit Log ແທນການເພີ່ມຖັນໃໝ່ທຸກຕາຕະລາງ — ການສ້າງຜ່ານໜ້າຈໍທຸກ
   * ລາຍການຖືກບັນທຶກໄວ້ແລ້ວ (TOR §10). ແຖວທີ່ບໍ່ມີ Log ຄືຂໍ້ມູນຕັ້ງຕົ້ນທີ່ມາ
   * ພ້ອມການຕິດຕັ້ງ ຈຶ່ງບອກຕາມນັ້ນ ແທນການປະໄວ້ຫວ່າງ.
   */
  async withCreatorsFromAudit<T extends { id: string }>(
    entity: string,
    rows: T[],
  ): Promise<Array<T & { createdBy: string }>> {
    if (rows.length === 0) return [];
    const logs = await this.prisma.auditLog.findMany({
      where: { entity, action: 'CREATE', entityId: { in: rows.map((r) => r.id) } },
      select: { entityId: true, actor: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const nameById = new Map<string, string>();
    for (const log of logs) {
      // ເອົາອັນແລກ (ການສ້າງຈິງ) ຖ້າມີຫຼາຍແຖວຕໍ່ 1 id.
      if (log.entityId && log.actor && !nameById.has(log.entityId)) {
        nameById.set(log.entityId, log.actor.fullName);
      }
    }
    return rows.map((r) => ({
      ...r,
      createdBy: nameById.get(r.id) ?? AuditService.SEEDED_BY,
    }));
  }

  /** Audit trail for one record — backs the VIEW buttons in §3.2 and §3.4. */
  async forEntity(entity: string, entityId?: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { entity, ...(entityId ? { entityId } : {}) },
      include: { actor: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  async record(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
        summary: entry.summary ?? null,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  }
}
