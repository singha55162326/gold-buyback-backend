import { SetMetadata } from '@nestjs/common';

export const REQUIRES_SHIFT_KEY = 'kpv:requiresShift';

/**
 * Marks a route as a transactional write that PAYMENT and VALUER may only
 * perform while they have an open shift (TOR §4, §5). Enforced centrally by
 * ShiftGuard so no controller can forget the check.
 */
export const RequiresOpenShift = () => SetMetadata(REQUIRES_SHIFT_KEY, true);
