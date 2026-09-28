import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import type { LoginDto } from './dto/login.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });

    // Verify against a dummy hash when the user is missing so a wrong username
    // and a wrong password take the same time to fail.
    const hash = user?.passwordHash ?? (await argonHash('__no_such_user__'));
    const valid = await argonVerify(hash, dto.password).catch(() => false);

    if (!user || !valid || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');
    }

    const tokens = await this.issueTokens(user.id, user.username, user.role);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: await argonHash(tokens.refreshToken),
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

  async logout(userId: string, ipAddress?: string): Promise<void> {
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

  private async issueTokens(sub: string, username: string, role: string): Promise<AuthTokens> {
    const payload = { sub, username, role };

    // jsonwebtoken types `expiresIn` as a narrow template literal union, so a
    // value read from the environment has to be widened for it.
    const ttl = (value: string | undefined, fallback: string) =>
      (value ?? fallback) as unknown as number;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: ttl(this.config.get<string>('JWT_ACCESS_TTL'), '30m'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: ttl(this.config.get<string>('JWT_REFRESH_TTL'), '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
