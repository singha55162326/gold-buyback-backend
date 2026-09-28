"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiresOpenShift = exports.REQUIRES_SHIFT_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRES_SHIFT_KEY = 'kpv:requiresShift';
/**
 * Marks a route as a transactional write that PAYMENT and VALUER may only
 * perform while they have an open shift (TOR §4, §5). Enforced centrally by
 * ShiftGuard so no controller can forget the check.
 */
const RequiresOpenShift = () => (0, common_1.SetMetadata)(exports.REQUIRES_SHIFT_KEY, true);
exports.RequiresOpenShift = RequiresOpenShift;
//# sourceMappingURL=requires-shift.decorator.js.map