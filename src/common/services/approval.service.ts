import { BadRequestException, Injectable } from '@nestjs/common';
import type { ApprovalStatus } from '@prisma/client';

/**
 * The single approval state machine shared by every workflow in the TOR:
 * cash requests (§4.1), buyback (§5.1), exchange (§5.2), credit (§5.3),
 * stock OUT (§7.1), shift close (§4), and gold handover (§4.3).
 *
 * Seven near-identical implementations would be seven places for the rules to
 * drift, so the legal transitions live here once and each feature module calls
 * `assertTransition` before writing.
 */
const TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  // APPROVED -> COMPLETED is the second confirmation the TOR requires before
  // money or stock actually moves.
  APPROVED: ['COMPLETED', 'CANCELLED'],
  REJECTED: [],
  COMPLETED: [],
  CANCELLED: [],
};

const STATUS_LABEL_LO: Record<ApprovalStatus, string> = {
  DRAFT: 'ຮ່າງ',
  PENDING: 'ລໍຖ້າອະນຸມັດ',
  APPROVED: 'ອະນຸມັດແລ້ວ',
  REJECTED: 'ປະຕິເສດ',
  COMPLETED: 'ສຳເລັດ',
  CANCELLED: 'ຍົກເລີກ',
};

@Injectable()
export class ApprovalService {
  canTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
    return TRANSITIONS[from].includes(to);
  }

  /** Throws a Lao-language 400 when the requested transition is not allowed. */
  assertTransition(from: ApprovalStatus, to: ApprovalStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestException(
        `ບໍ່ສາມາດປ່ຽນສະຖານະຈາກ "${STATUS_LABEL_LO[from]}" ເປັນ "${STATUS_LABEL_LO[to]}" ໄດ້`,
      );
    }
  }

  label(status: ApprovalStatus): string {
    return STATUS_LABEL_LO[status];
  }
}
