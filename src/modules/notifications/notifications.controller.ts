import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './whatsapp.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('notifications')
@ApiBearerAuth('bearer')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsAppService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('unread') unread?: string) {
    return this.notifications.listForUser(user.id, user.role, unread === 'true');
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(id, user.id, user.role);
  }

  /* ---- WhatsApp channel (TOR §10) ---- */

  /** Is the OpenWA gateway configured, reachable and its session live? */
  @Roles('ADMIN', 'MANAGER')
  @Get('whatsapp/status')
  whatsappStatus() {
    return this.whatsapp.status();
  }

  /** Delivery log — what was sent, what failed and why. */
  @Roles('ADMIN', 'MANAGER')
  @Get('whatsapp/log')
  whatsappLog() {
    return this.notifications.whatsappLog();
  }

  /** Flush the outbox now instead of waiting for the next poll. */
  @Roles('ADMIN', 'MANAGER')
  @Post('whatsapp/drain')
  drain() {
    return this.dispatcher.drain();
  }

  /**
   * Send a test message to one number, to prove the gateway works before
   * anyone relies on it. Deliberately does not touch the outbox.
   */
  @Roles('ADMIN', 'MANAGER')
  @Post('whatsapp/test')
  async test(@Body() body: { to?: string }, @CurrentUser() user: AuthenticatedUser) {
    const chatId = WhatsAppService.toChatId(body?.to);
    if (!chatId) throw new BadRequestException('ເບີ WhatsApp ບໍ່ຖືກຕ້ອງ');

    const result = await this.whatsapp.sendText(
      chatId,
      `🔔 ຮ້ານຄຳ KPV

ນີ້ແມ່ນຂໍ້ຄວາມທົດສອບຈາກ ${user.fullName}.
ຖ້າທ່ານໄດ້ຮັບຂໍ້ຄວາມນີ້ ແປວ່າການແຈ້ງເຕືອນ WhatsApp ໃຊ້ງານໄດ້ແລ້ວ.`,
    );

    return { ...result, to: WhatsAppService.toNumber(chatId) };
  }
}
