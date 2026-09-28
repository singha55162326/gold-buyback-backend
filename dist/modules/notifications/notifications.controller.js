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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const notifications_service_1 = require("./notifications.service");
const whatsapp_service_1 = require("./whatsapp.service");
const notification_dispatcher_service_1 = require("./notification-dispatcher.service");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
let NotificationsController = class NotificationsController {
    notifications;
    whatsapp;
    dispatcher;
    constructor(notifications, whatsapp, dispatcher) {
        this.notifications = notifications;
        this.whatsapp = whatsapp;
        this.dispatcher = dispatcher;
    }
    list(user, unread) {
        return this.notifications.listForUser(user.id, user.role, unread === 'true');
    }
    markRead(id, user) {
        return this.notifications.markRead(id, user.id, user.role);
    }
    /* ---- WhatsApp channel (TOR §10) ---- */
    /** Is the OpenWA gateway configured, reachable and its session live? */
    whatsappStatus() {
        return this.whatsapp.status();
    }
    /** Delivery log — what was sent, what failed and why. */
    whatsappLog() {
        return this.notifications.whatsappLog();
    }
    /** Flush the outbox now instead of waiting for the next poll. */
    drain() {
        return this.dispatcher.drain();
    }
    /**
     * Send a test message to one number, to prove the gateway works before
     * anyone relies on it. Deliberately does not touch the outbox.
     */
    async test(body, user) {
        const chatId = whatsapp_service_1.WhatsAppService.toChatId(body?.to);
        if (!chatId)
            throw new common_1.BadRequestException('ເບີ WhatsApp ບໍ່ຖືກຕ້ອງ');
        const result = await this.whatsapp.sendText(chatId, `🔔 ຮ້ານຄຳ KPV

ນີ້ແມ່ນຂໍ້ຄວາມທົດສອບຈາກ ${user.fullName}.
ຖ້າທ່ານໄດ້ຮັບຂໍ້ຄວາມນີ້ ແປວ່າການແຈ້ງເຕືອນ WhatsApp ໃຊ້ງານໄດ້ແລ້ວ.`);
        return { ...result, to: whatsapp_service_1.WhatsAppService.toNumber(chatId) };
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    openapi.ApiQuery({ name: "unread", required: false }),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('unread')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':id/read'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "markRead", null);
__decorate([
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Get)('whatsapp/status'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "whatsappStatus", null);
__decorate([
    openapi.ApiOperation({ summary: "Delivery log \u2014 what was sent, what failed and why." }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Get)('whatsapp/log'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "whatsappLog", null);
__decorate([
    openapi.ApiOperation({ summary: "Flush the outbox now instead of waiting for the next poll." }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('whatsapp/drain'),
    openapi.ApiResponse({ status: 201 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "drain", null);
__decorate([
    openapi.ApiOperation({ summary: "Send a test message to one number, to prove the gateway works before\nanyone relies on it. Deliberately does not touch the outbox." }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, common_1.Post)('whatsapp/test'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "test", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, swagger_1.ApiTags)('notifications'),
    (0, swagger_1.ApiBearerAuth)('bearer'),
    (0, common_1.Controller)('notifications'),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService,
        whatsapp_service_1.WhatsAppService,
        notification_dispatcher_service_1.NotificationDispatcherService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map