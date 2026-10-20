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
exports.CodeGeneratorService = exports.CODE_SCOPES = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
/** The code families, with their prefix and how wide the number runs. */
exports.CODE_SCOPES = {
    GOLD_TYPE: { prefix: 'GT', width: 3 },
    GOLD_ITEM: { prefix: 'GI', width: 3 },
    BANK: { prefix: 'BK', width: 3 },
    CABINET: { prefix: 'CAB', width: 3 },
    PARTNER: { prefix: 'SUP', width: 3 },
    INCOME_EXPENSE_CATEGORY: { prefix: 'IE', width: 3 },
    APAR_CASH_CATEGORY: { prefix: 'APAR', width: 3 },
};
/** How many times to step past a code that is already taken. */
const MAX_ATTEMPTS = 50;
/**
 * Issues the auto-generated codes that replaced the hand-typed ones
 * (ລະຫັດເປັນ Auto-generate ID).
 *
 * The counter is bumped by a single atomic statement rather than a
 * read-modify-write. Two cashiers saving at the same instant is the normal
 * case at a counter, not an edge case, and `count() + 1` or a Prisma `upsert`
 * would hand both of them the same number — one save then dies on the unique
 * index, having already looked like it worked.
 *
 * `INSERT … ON CONFLICT DO UPDATE … RETURNING` is atomic in Postgres: the
 * second caller blocks on the row lock and comes back with the next number.
 */
let CodeGeneratorService = class CodeGeneratorService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Reserve the next free code for a family.
     *
     * `isTaken` exists because the seeded rows carry meaningful codes (BCEL,
     * BANGLE, CAB-01) that were never issued by this counter. Stepping over a
     * collision is cheaper than trying to reconcile the two schemes, and the
     * counter only ever moves forward.
     */
    async next(scope, isTaken, tx) {
        const { prefix, width } = exports.CODE_SCOPES[scope];
        const client = tx ?? this.prisma;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const rows = await client.$queryRaw `
        INSERT INTO code_sequences (scope, next, "updatedAt")
        VALUES (${scope}, 2, NOW())
        ON CONFLICT (scope)
        DO UPDATE SET next = code_sequences.next + 1, "updatedAt" = NOW()
        RETURNING code_sequences.next - 1 AS next
      `;
            const seq = rows[0]?.next;
            if (seq === undefined) {
                throw new common_1.InternalServerErrorException('ອອກລະຫັດອັດຕະໂນມັດບໍ່ສຳເລັດ');
            }
            const code = `${prefix}-${String(seq).padStart(width, '0')}`;
            if (!(await isTaken(code)))
                return code;
        }
        throw new common_1.InternalServerErrorException(`ອອກລະຫັດອັດຕະໂນມັດບໍ່ສຳເລັດ (${scope}) — ລອງ ${MAX_ATTEMPTS} ຄັ້ງແລ້ວຊ້ຳທັງໝົດ`);
    }
    /**
     * Convenience for the common case: a Prisma model with a unique `code`.
     * `delegate` is the model, e.g. `prisma.goldType`.
     */
    async nextFor(scope, delegate, tx) {
        return this.next(scope, async (code) => (await delegate.findUnique({ where: { code } })) !== null, tx);
    }
};
exports.CodeGeneratorService = CodeGeneratorService;
exports.CodeGeneratorService = CodeGeneratorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CodeGeneratorService);
//# sourceMappingURL=code-generator.service.js.map