import { CanActivate, ConflictException, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessDayService } from '../services/business-day.service';
import { REQUIRES_SHIFT_KEY } from '../decorators/requires-shift.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/** Roles that must open a shift before they can transact (TOR §4, §5). */
const SHIFT_BOUND_ROLES = new Set(['PAYMENT', 'VALUER']);

/**
 * Enforces the shift rules once, centrally:
 *   - ເມື່ອເຂົ້າລະບົບຕ້ອງກົດ 'ເປີດກະ' ກ່ອນເຮັດທຸລະກຳ
 *   - ເມື່ອ 'ປິດກະ' ແລ້ວບໍ່ສາມາດເຮັດທຸລະກຳໄດ້ຈົນກວ່າຈະເປັນມື້ໃໝ່
 *
 * The open shift is attached to the request as `request.shift` so handlers
 * never have to look it up again.
 */
@Injectable()
export class ShiftGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly businessDay: BusinessDayService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresShift = this.reflector.getAllAndOverride<boolean>(REQUIRES_SHIFT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiresShift) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user || !SHIFT_BOUND_ROLES.has(user.role)) return true;

    const day = await this.businessDay.current();
    const shift = await this.prisma.shift.findUnique({
      where: { userId_businessDayId: { userId: user.id, businessDayId: day.id } },
    });

    if (!shift) {
      throw new ConflictException('ກະລຸນາກົດ "ເປີດກະ" ກ່ອນເຮັດທຸລະກຳ');
    }
    if (shift.status !== 'OPEN') {
      throw new ConflictException('ກະຖືກປິດແລ້ວ ບໍ່ສາມາດເຮັດທຸລະກຳໄດ້ຈົນກວ່າຈະເປັນມື້ໃໝ່');
    }

    request.shift = shift;
    return true;
  }
}
