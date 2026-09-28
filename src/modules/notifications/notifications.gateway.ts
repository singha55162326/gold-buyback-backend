import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { Notification, UserRole } from '@prisma/client';

/**
 * TOR §10 — Real-time notifications along the approval chain:
 *   Valuer -> Payment -> Financial Controller / Warehouse / Admin
 *
 * Each client joins two rooms: one for their user id (direct messages) and
 * one for their role (broadcasts such as "a Valuer created a Buyback"), so a
 * notification can target either without the gateway tracking sockets itself.
 */
@WebSocketGateway({ namespace: '/ws', cors: { origin: true, credentials: true } })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: UserRole }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      await client.join(`user:${payload.sub}`);
      await client.join(`role:${payload.role}`);
      client.data.userId = payload.sub;
      client.data.role = payload.role;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`socket disconnected: ${client.id}`);
  }

  /** Push to one person. */
  emitToUser(userId: string, notification: Notification): void {
    this.server?.to(`user:${userId}`).emit('notification', notification);
  }

  /** Push to everyone holding a role (e.g. all Financial Controllers). */
  emitToRole(role: UserRole, notification: Notification): void {
    this.server?.to(`role:${role}`).emit('notification', notification);
  }
}
