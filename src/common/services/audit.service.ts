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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve `createdById` / `approvedById` on a list of rows into display
   * names, in one query rather than per row.
   *
   * The TOR asks for UPDATED BY on every History table (§5.1, §5.2, §5.3),
   * but those columns are plain id strings rather than relations — keeping
   * them unlinked avoids a foreign key on every transactional table purely
   * for a label.
   */
  async withActorNames<T extends { createdById?: string; approvedById?: string | null }>(
    rows: T[],
  ): Promise<Array<T & { updatedBy: string }>> {
    const ids = [
      ...new Set(
        rows.flatMap((r) => [r.createdById, r.approvedById]).filter((v): v is string => Boolean(v)),
      ),
    ];
    if (ids.length === 0) return rows.map((r) => ({ ...r, updatedBy: '—' }));

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));

    // The approver is the most recent hand on the record; fall back to the
    // creator when it has not been reviewed yet.
    return rows.map((r) => ({
      ...r,
      updatedBy:
        (r.approvedById ? nameById.get(r.approvedById) : undefined) ??
        (r.createdById ? nameById.get(r.createdById) : undefined) ??
        '—',
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
