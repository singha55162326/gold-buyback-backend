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
var NotificationsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsGateway = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
/**
 * TOR §10 — Real-time notifications along the approval chain:
 *   Valuer -> Payment -> Financial Controller / Warehouse / Admin
 *
 * Each client joins two rooms: one for their user id (direct messages) and
 * one for their role (broadcasts such as "a Valuer created a Buyback"), so a
 * notification can target either without the gateway tracking sockets itself.
 */
let NotificationsGateway = NotificationsGateway_1 = class NotificationsGateway {
    jwt;
    config;
    logger = new common_1.Logger(NotificationsGateway_1.name);
    server;
    constructor(jwt, config) {
        this.jwt = jwt;
        this.config = config;
    }
    async handleConnection(client) {
        const token = client.handshake.auth?.token ??
            client.handshake.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            client.disconnect(true);
            return;
        }
        try {
            const payload = await this.jwt.verifyAsync(token, {
                secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
            });
            await client.join(`user:${payload.sub}`);
            await client.join(`role:${payload.role}`);
            client.data.userId = payload.sub;
            client.data.role = payload.role;
        }
        catch {
            client.disconnect(true);
        }
    }
    handleDisconnect(client) {
        this.logger.debug(`socket disconnected: ${client.id}`);
    }
    /** Push to one person. */
    emitToUser(userId, notification) {
        this.server?.to(`user:${userId}`).emit('notification', notification);
    }
    /** Push to everyone holding a role (e.g. all Financial Controllers). */
    emitToRole(role, notification) {
        this.server?.to(`role:${role}`).emit('notification', notification);
    }
};
exports.NotificationsGateway = NotificationsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], NotificationsGateway.prototype, "server", void 0);
exports.NotificationsGateway = NotificationsGateway = NotificationsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/ws', cors: { origin: true, credentials: true } }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], NotificationsGateway);
//# sourceMappingURL=notifications.gateway.js.map