import { Injectable } from '@nestjs/common';
import type { NotificationKind, Prisma, UserRole, WhatsAppStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { WhatsAppService } from './whatsapp.service';

export interface CreateNotificationInput {
  kind: NotificationKind;
  title: string;
  body?: string;
  refType?: string;
  refId?: string;
  /** Target one person, a whole role, or both. */
  recipientUserId?: string;
  recipientRole?: UserRole;
}

/**
 * Notifications are persisted first and pushed second, so a user who was
 * offline when the event happened still sees it in the bell on next login.
 *
 * Two delivery channels (TOR §10):
 *
 *  - **Socket.IO** — immediate and in-process. Losing it costs nothing,
 *    because the bell also re-reads from the API.
 *  - **WhatsApp** — queued here and delivered afterwards by
 *    `NotificationDispatcherService`. It is queued rather than sent inline
 *    precisely because `notify()` usually runs INSIDE a business transaction;
 *    an HTTP call there would hold row locks open and let a gateway timeout
 *    roll back a gold transaction.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async notify(input: CreateNotificationInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    const { status, to } = await this.resolveWhatsAppTarget(client, input);

    const notification = await client.notification.create({
      data: {
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        recipientUserId: input.recipientUserId ?? null,
        recipientRole: input.recipientRole ?? null,
        whatsappStatus: status,
        whatsappTo: to,
      },
    });

    if (input.recipientUserId) this.gateway.emitToUser(input.recipientUserId, notification);
    if (input.recipientRole) this.gateway.emitToRole(input.recipientRole, notification);

    return notification;
  }

  /**
   * Decide whether this notification gets a WhatsApp copy, and to which
   * number.
   *
   * The number is resolved and SNAPSHOTTED now rather than at send time, so a
   * later profile edit cannot redirect an already-queued message.
   *
   * A role-targeted notification resolves to a single recipient only when
   * exactly one opted-in user holds that role. Fanning one alert out to a
   * whole role over WhatsApp is how a notification system turns into spam —
   * and the in-app bell already reaches everyone in the role.
   */
  private async resolveWhatsAppTarget(
    client: Prisma.TransactionClient | PrismaService,
    input: CreateNotificationInput,
  ): Promise<{ status: WhatsAppStatus; to: string | null }> {
    if (!this.whatsapp.enabled || !this.whatsapp.configured) {
      return { status: 'SKIPPED', to: null };
    }

    const candidates = input.recipientUserId
      ? await client.user.findMany({
          where: { id: input.recipientUserId, isActive: true, deletedAt: null, notifyWhatsApp: true },
          select: { whatsappNumber: true, phone: true },
        })
      : input.recipientRole
        ? await client.user.findMany({
            where: {
              role: input.recipientRole,
              isActive: true,
              deletedAt: null,
              notifyWhatsApp: true,
            },
            select: { whatsappNumber: true, phone: true },
          })
        : [];

    if (candidates.length !== 1) return { status: 'SKIPPED', to: null };

    const candidate = candidates[0]!;
    const chatId = WhatsAppService.toChatId(candidate.whatsappNumber ?? candidate.phone);
    if (!chatId) return { status: 'SKIPPED', to: null };

    return { status: 'PENDING', to: WhatsAppService.toNumber(chatId) };
  }

  async listForUser(userId: string, role: UserRole, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        OR: [{ recipientUserId: userId }, { recipientRole: role }],
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(id: string, userId: string, role: UserRole) {
    return this.prisma.notification.updateMany({
      where: { id, OR: [{ recipientUserId: userId }, { recipientRole: role }] },
      data: { readAt: new Date() },
    });
  }

  /** WhatsApp delivery log, for the Admin settings screen. */
  whatsappLog(limit = 100) {
    return this.prisma.notification.findMany({
      where: { whatsappStatus: { not: 'SKIPPED' } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      select: {
        id: true,
        title: true,
        createdAt: true,
        whatsappStatus: true,
        whatsappTo: true,
        whatsappSentAt: true,
        whatsappAttempts: true,
        whatsappError: true,
      },
    });
  }
}
