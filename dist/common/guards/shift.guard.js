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
exports.ShiftGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const prisma_service_1 = require("../../prisma/prisma.service");
const business_day_service_1 = require("../services/business-day.service");
const requires_shift_decorator_1 = require("../decorators/requires-shift.decorator");
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
let ShiftGuard = class ShiftGuard {
    reflector;
    prisma;
    businessDay;
    constructor(reflector, prisma, businessDay) {
        this.reflector = reflector;
        this.prisma = prisma;
        this.businessDay = businessDay;
    }
    async canActivate(context) {
        const requiresShift = this.reflector.getAllAndOverride(requires_shift_decorator_1.REQUIRES_SHIFT_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!requiresShift)
            return true;
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user || !SHIFT_BOUND_ROLES.has(user.role))
            return true;
        const day = await this.businessDay.current();
        const shift = await this.prisma.shift.findUnique({
            where: { userId_businessDayId: { userId: user.id, businessDayId: day.id } },
        });
        if (!shift) {
            throw new common_1.ConflictException('ກະລຸນາກົດ "ເປີດກະ" ກ່ອນເຮັດທຸລະກຳ');
        }
        if (shift.status !== 'OPEN') {
            throw new common_1.ConflictException('ກະຖືກປິດແລ້ວ ບໍ່ສາມາດເຮັດທຸລະກຳໄດ້ຈົນກວ່າຈະເປັນມື້ໃໝ່');
        }
        request.shift = shift;
        return true;
    }
};
exports.ShiftGuard = ShiftGuard;
exports.ShiftGuard = ShiftGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        prisma_service_1.PrismaService,
        business_day_service_1.BusinessDayService])
], ShiftGuard);
//# sourceMappingURL=shift.guard.js.map