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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
/**
 * TOR §10 — Audit Logs ທຸກການເພີ່ມ, ແກ້ໄຂ, ເບີກ, ມອບ, Approve, Reject.
 *
 * Pass the transaction client when auditing inside a $transaction so the log
 * commits or rolls back together with the change it describes.
 */
let AuditService = class AuditService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Resolve `createdById` / `approvedById` on a list of rows into display
     * names, in one query rather than per row.
     *
     * The TOR asks for UPDATED BY on every History table (§5.1, §5.2, §5.3),
     * but those columns are plain id strings rather than relations — keeping
     * them unlinked avoids a foreign key on every transactional table purely
     * for a label.
     */
    async withActorNames(rows) {
        const ids = [
            ...new Set(rows.flatMap((r) => [r.createdById, r.approvedById]).filter((v) => Boolean(v))),
        ];
        if (ids.length === 0)
            return rows.map((r) => ({ ...r, updatedBy: '—' }));
        const users = await this.prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, fullName: true },
        });
        const nameById = new Map(users.map((u) => [u.id, u.fullName]));
        // The approver is the most recent hand on the record; fall back to the
        // creator when it has not been reviewed yet.
        return rows.map((r) => ({
            ...r,
            updatedBy: (r.approvedById ? nameById.get(r.approvedById) : undefined) ??
                (r.createdById ? nameById.get(r.createdById) : undefined) ??
                '—',
        }));
    }
    /** Audit trail for one record — backs the VIEW buttons in §3.2 and §3.4. */
    async forEntity(entity, entityId, limit = 50) {
        return this.prisma.auditLog.findMany({
            where: { entity, ...(entityId ? { entityId } : {}) },
            include: { actor: { select: { fullName: true, username: true } } },
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit, 200),
        });
    }
    async record(entry, tx) {
        const client = tx ?? this.prisma;
        await client.auditLog.create({
            data: {
                actorId: entry.actorId ?? null,
                action: entry.action,
                entity: entry.entity,
                entityId: entry.entityId ?? null,
                before: (entry.before ?? undefined),
                after: (entry.after ?? undefined),
                summary: entry.summary ?? null,
                ipAddress: entry.ipAddress ?? null,
            },
        });
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
//# sourceMappingURL=audit.service.js.map