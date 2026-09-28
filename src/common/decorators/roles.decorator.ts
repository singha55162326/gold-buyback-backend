import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export const ROLES_KEY = 'kpv:roles';

/**
 * Restrict a route to the given roles (TOR §2).
 *
 * @example
 *   @Roles('ADMIN', 'MANAGER')
 *   @Post('set-pricing')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
