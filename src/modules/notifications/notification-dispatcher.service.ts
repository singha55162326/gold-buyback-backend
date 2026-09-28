import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Notification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';

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
@Injectable()
export class NotificationDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly config: ConfigService,
  ) {}

  /** How many times to retry before marking a row FAILED. */
  private get maxAttempts(): number {
    return Number(this.config.get<string>('WHATSAPP_MAX_ATTEMPTS') ?? 3);
  }

  private get intervalMs(): number {
    return Number(this.config.get<string>('WHATSAPP_POLL_MS') ?? 15_000);
  }

  private get batchSize(): number {
    return Number(this.config.get<string>('WHATSAPP_BATCH_SIZE') ?? 20);
  }

  onModuleInit(): void {
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

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Send one batch of queued messages.
   *
   * Guarded against overlap: a slow gateway must not let a second tick start
   * while the first is still working, or a message could be sent twice.
   */
  async drain(): Promise<{ sent: number; failed: number; skipped: number }> {
    if (this.running) return { sent: 0, failed: 0, skipped: 0 };
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
        if (result === 'sent') sent += 1;
        else if (result === 'failed') failed += 1;
        else skipped += 1;
      }

      if (sent || failed) {
        this.logger.log(`WhatsApp batch: ${sent} sent, ${failed} failed, ${skipped} skipped`);
      }

      return { sent, failed, skipped };
    } catch (error) {
      this.logger.error(
        `WhatsApp dispatcher error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { sent: 0, failed: 0, skipped: 0 };
    } finally {
      this.running = false;
    }
  }

  private async deliver(row: Notification): Promise<'sent' | 'failed' | 'skipped'> {
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
  private format(row: Notification): string {
    const lines = [`🔔 ຮ້ານຄຳ KPV`, '', row.title];
    if (row.body) lines.push(row.body);
    if (row.refType && row.refId) lines.push('', `ອ້າງອີງ: ${row.refType}`);
    lines.push('', 'ກະລຸນາເຂົ້າລະບົບເພື່ອດຳເນີນການ');
    return lines.join('\n');
  }
}
