import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './whatsapp.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    WhatsAppService,
    NotificationDispatcherService,
  ],
  exports: [NotificationsService, NotificationsGateway, WhatsAppService],
})
export class NotificationsModule {}
