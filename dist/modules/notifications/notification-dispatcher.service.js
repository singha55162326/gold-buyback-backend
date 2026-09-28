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
var NotificationDispatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const whatsapp_service_1 = require("./whatsapp.service");
/**
 * The WhatsApp outbox worker (TOR §10).
 *
 * Notifications are written inside the business transaction that caused them.
 * This worker delivers them afterwards, which is the whole point of the
 * design:
 *
 *  - A gateway timeout cannot roll back a buyback or a stock movement.
 *  - No HTTP call is made while a database transaction is open, so a slow
 *    gateway cannot hold row locks.
 *  - Undelivered rows survive an API restart, so an alert raised during a
 *    network outage still arrives once the link is back.
 *
 * Socket.IO delivery stays immediate and in-process — it is instant and
 * failure there costs nothing, because the bell also re-reads from the API.
 */
let NotificationDispatcherService = NotificationDispatcherService_1 = class NotificationDispatcherService {
    prisma;
    whatsapp;
    config;
    logger = new common_1.Logger(NotificationDispatcherService_1.name);
    timer = null;
    running = false;
    constructor(prisma, whatsapp, config) {
        this.prisma = prisma;
        this.whatsapp = whatsapp;
        this.config = config;
    }
    /** How many times to retry before marking a row FAILED. */
    get maxAttempts() {
        return Number(this.config.get('WHATSAPP_MAX_ATTEMPTS') ?? 3);
    }
    get intervalMs() {
        return Number(this.config.get('WHATSAPP_POLL_MS') ?? 15_000);
    }
    get batchSize() {
        return Number(this.config.get('WHATSAPP_BATCH_SIZE') ?? 20);
    }
    onModuleInit() {
        if (!this.whatsapp.enabled) {
            this.logger.log('WhatsApp notifications disabled (WHATSAPP_ENABLED != true)');
            return;
        }
        if (!this.whatsapp.configured) {
            this.logger.warn('WhatsApp enabled but not configured — dispatcher will idle');
        }
        this.timer = setInterval(() => void this.drain(), this.intervalMs);
        // Node should not be held open by the poll timer alone.
        this.timer.unref?.();
        this.logger.log(`WhatsApp dispatcher started (every ${this.intervalMs} ms)`);
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    /**
     * Send one batch of queued messages.
     *
     * Guarded against overlap: a slow gateway must not let a second tick start
     * while the first is still working, or a message could be sent twice.
     */
    async drain() {
        if (this.running)
            return { sent: 0, failed: 0, skipped: 0 };
        this.running = true;
        try {
            const pending = await this.prisma.notification.findMany({
                where: { whatsappStatus: 'PENDING', whatsappAttempts: { lt: this.maxAttempts } },
                orderBy: { createdAt: 'asc' },
                take: this.batchSize,
            });
            let sent = 0;
            let failed = 0;
            let skipped = 0;
            for (const row of pending) {
                const result = await this.deliver(row);
                if (result === 'sent')
                    sent += 1;
                else if (result === 'failed')
                    failed += 1;
                else
                    skipped += 1;
            }
            if (sent || failed) {
                this.logger.log(`WhatsApp batch: ${sent} sent, ${failed} failed, ${skipped} skipped`);
            }
            return { sent, failed, skipped };
        }
        catch (error) {
            this.logger.error(`WhatsApp dispatcher error: ${error instanceof Error ? error.message : String(error)}`);
            return { sent: 0, failed: 0, skipped: 0 };
        }
        finally {
            this.running = false;
        }
    }
    async deliver(row) {
        const chatId = row.whatsappTo ? `${row.whatsappTo}@c.us` : null;
        if (!chatId) {
            await this.prisma.notification.update({
                where: { id: row.id },
                data: { whatsappStatus: 'SKIPPED', whatsappError: 'ບໍ່ມີເບີ WhatsApp' },
            });
            return 'skipped';
        }
        const result = await this.whatsapp.sendText(chatId, this.format(row));
        const attempts = row.whatsappAttempts + 1;
        if (result.ok) {
            await this.prisma.notification.update({
                where: { id: row.id },
                data: {
                    whatsappStatus: 'SENT',
                    whatsappSentAt: new Date(),
                    whatsappAttempts: attempts,
                    whatsappError: null,
                },
            });
            return 'sent';
        }
        const giveUp = Boolean(result.permanent) || attempts >= this.maxAttempts;
        await this.prisma.notification.update({
            where: { id: row.id },
            data: {
                // Stay PENDING while retries remain, so the next tick picks it up.
                whatsappStatus: giveUp ? 'FAILED' : 'PENDING',
                whatsappAttempts: attempts,
                whatsappError: result.error ?? 'ບໍ່ຮູ້ສາເຫດ',
            },
        });
        return giveUp ? 'failed' : 'skipped';
    }
    /**
     * The message body.
     *
     * Deliberately terse and free of amounts where it can be: WhatsApp is not a
     * secure channel, and the alert only needs to get someone to open the
     * system. The title and reference are enough to act on.
     */
    format(row) {
        const lines = [`🔔 ຮ້ານຄຳ KPV`, '', row.title];
        if (row.body)
            lines.push(row.body);
        if (row.refType && row.refId)
            lines.push('', `ອ້າງອີງ: ${row.refType}`);
        lines.push('', 'ກະລຸນາເຂົ້າລະບົບເພື່ອດຳເນີນການ');
        return lines.join('\n');
    }
};
exports.NotificationDispatcherService = NotificationDispatcherService;
exports.NotificationDispatcherService = NotificationDispatcherService = NotificationDispatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        whatsapp_service_1.WhatsAppService,
        config_1.ConfigService])
], NotificationDispatcherService);
//# sourceMappingURL=notification-dispatcher.service.js.map