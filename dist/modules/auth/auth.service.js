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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const argon2_1 = require("@node-rs/argon2");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    audit;
    constructor(prisma, jwt, config, audit) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.audit = audit;
    }
    async login(dto, ipAddress) {
        const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
        // Verify against a dummy hash when the user is missing so a wrong username
        // and a wrong password take the same time to fail.
        const hash = user?.passwordHash ?? (await (0, argon2_1.hash)('__no_such_user__'));
        const valid = await (0, argon2_1.verify)(hash, dto.password).catch(() => false);
        if (!user || !valid || !user.isActive || user.deletedAt) {
            throw new common_1.UnauthorizedException('ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');
        }
        const tokens = await this.issueTokens(user.id, user.username, user.role);
        await this.prisma.session.create({
            data: {
                userId: user.id,
                refreshTokenHash: await (0, argon2_1.hash)(tokens.refreshToken),
                ipAddress: ipAddress ?? null,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        await this.audit.record({
            actorId: user.id,
            action: 'LOGIN',
            entity: 'User',
            entityId: user.id,
            ipAddress: ipAddress ?? null,
        });
        return {
            ...tokens,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
            },
        };
    }
    async logout(userId, ipAddress) {
        await this.prisma.session.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        await this.audit.record({
            actorId: userId,
            action: 'LOGOUT',
            entity: 'User',
            entityId: userId,
            ipAddress: ipAddress ?? null,
        });
    }
    async issueTokens(sub, username, role) {
        const payload = { sub, username, role };
        // jsonwebtoken types `expiresIn` as a narrow template literal union, so a
        // value read from the environment has to be widened for it.
        const ttl = (value, fallback) => (value ?? fallback);
        const [accessToken, refreshToken] = await Promise.all([
            this.jwt.signAsync(payload, {
                secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
                expiresIn: ttl(this.config.get('JWT_ACCESS_TTL'), '30m'),
            }),
            this.jwt.signAsync(payload, {
                secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
                expiresIn: ttl(this.config.get('JWT_REFRESH_TTL'), '7d'),
            }),
        ]);
        return { accessToken, refreshToken };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        audit_service_1.AuditService])
], AuthService);
//# sourceMappingURL=auth.service.js.map