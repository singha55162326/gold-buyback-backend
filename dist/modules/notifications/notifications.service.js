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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const notifications_gateway_1 = require("./notifications.gateway");
const whatsapp_service_1 = require("./whatsapp.service");
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
let NotificationsService = class NotificationsService {
    prisma;
    gateway;
    whatsapp;
    constructor(prisma, gateway, whatsapp) {
        this.prisma = prisma;
        this.gateway = gateway;
        this.whatsapp = whatsapp;
    }
    async notify(input, tx) {
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
        if (input.recipientUserId)
            this.gateway.emitToUser(input.recipientUserId, notification);
        if (input.recipientRole)
            this.gateway.emitToRole(input.recipientRole, notification);
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
    async resolveWhatsAppTarget(client, input) {
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
        if (candidates.length !== 1)
            return { status: 'SKIPPED', to: null };
        const candidate = candidates[0];
        const chatId = whatsapp_service_1.WhatsAppService.toChatId(candidate.whatsappNumber ?? candidate.phone);
        if (!chatId)
            return { status: 'SKIPPED', to: null };
        return { status: 'PENDING', to: whatsapp_service_1.WhatsAppService.toNumber(chatId) };
    }
    async listForUser(userId, role, unreadOnly = false) {
        return this.prisma.notification.findMany({
            where: {
                OR: [{ recipientUserId: userId }, { recipientRole: role }],
                ...(unreadOnly ? { readAt: null } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async markRead(id, userId, role) {
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
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_gateway_1.NotificationsGateway,
        whatsapp_service_1.WhatsAppService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map