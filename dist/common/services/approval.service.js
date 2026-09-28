"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const common_1 = require("@nestjs/common");
/**
 * The single approval state machine shared by every workflow in the TOR:
 * cash requests (§4.1), buyback (§5.1), exchange (§5.2), credit (§5.3),
 * stock OUT (§7.1), shift close (§4), and gold handover (§4.3).
 *
 * Seven near-identical implementations would be seven places for the rules to
 * drift, so the legal transitions live here once and each feature module calls
 * `assertTransition` before writing.
 */
const TRANSITIONS = {
    DRAFT: ['PENDING', 'CANCELLED'],
    PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
    // APPROVED -> COMPLETED is the second confirmation the TOR requires before
    // money or stock actually moves.
    APPROVED: ['COMPLETED', 'CANCELLED'],
    REJECTED: [],
    COMPLETED: [],
    CANCELLED: [],
};
const STATUS_LABEL_LO = {
    DRAFT: 'ຮ່າງ',
    PENDING: 'ລໍຖ້າອະນຸມັດ',
    APPROVED: 'ອະນຸມັດແລ້ວ',
    REJECTED: 'ປະຕິເສດ',
    COMPLETED: 'ສຳເລັດ',
    CANCELLED: 'ຍົກເລີກ',
};
let ApprovalService = class ApprovalService {
    canTransition(from, to) {
        return TRANSITIONS[from].includes(to);
    }
    /** Throws a Lao-language 400 when the requested transition is not allowed. */
    assertTransition(from, to) {
        if (!this.canTransition(from, to)) {
            throw new common_1.BadRequestException(`ບໍ່ສາມາດປ່ຽນສະຖານະຈາກ "${STATUS_LABEL_LO[from]}" ເປັນ "${STATUS_LABEL_LO[to]}" ໄດ້`);
        }
    }
    label(status) {
        return STATUS_LABEL_LO[status];
    }
};
exports.ApprovalService = ApprovalService;
exports.ApprovalService = ApprovalService = __decorate([
    (0, common_1.Injectable)()
], ApprovalService);
//# sourceMappingURL=approval.service.js.map