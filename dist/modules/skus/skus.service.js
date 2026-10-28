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
var SkusService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkusService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
const code_generator_service_1 = require("../../common/services/code-generator.service");
/**
 * TOR §3.6 — ລະບົບຈັດການ SKU ນ້ຳໜັກຂອງຄຳ.
 *
 *   ຜູ້ໃຊ້ປ້ອນ ຊື່ສິນຄ້າ + ນ້ຳໜັກ (g)
 *     -> ບາດຄຳ = weight_g / 15
 *     -> full_sku_name = [ຊື່ສິນຄ້າ] + [ບາດຄຳ] + " ບາດ"
 *
 * Worked example from the TOR: 'ສາຍແຂນ' at 15 g -> 1.00 ບາດ -> 'ສາຍແຂນ 1 ບາດ'.
 */
let SkusService = SkusService_1 = class SkusService {
    prisma;
    audit;
    codes;
    constructor(prisma, audit, codes) {
        this.prisma = prisma;
        this.audit = audit;
        this.codes = codes;
    }
    /**
     * ບາດຄຳ = g / 15, shown to two decimals but with trailing zeros trimmed so
     * 15 g reads "1 ບາດ" rather than "1.00 ບາດ" — matching the TOR example.
     */
    static bahtWeight(weightG) {
        return weightG.div(domain_1.GRAMS_PER_BAHT);
    }
    static formatBaht(baht) {
        return (0, domain_1.trimTrailingZeros)(baht.toDecimalPlaces(2).toFixed());
    }
    /**
     * ນ້ຳໜັກກຣາມ ຫຼັງຈຸດ 3 ຕົວ — always three places, zeros included.
     *
     * Trailing zeros are kept on purpose here, unlike ບາດ: a column of SKU
     * weights is read down, and 1.870 beside 1.875 lines up where "1.87" does
     * not. Three places is also where the ຄ່າອ່ອນ steps live (§5.2), so the
     * displayed weight and the weight the fee is computed from agree.
     */
    static formatGrams(weightG) {
        return weightG.toDecimalPlaces(3).toFixed(3);
    }
    /** The derived name — exported so the web client can preview it live. */
    static buildFullSkuName(nameLo, weightG) {
        const baht = SkusService_1.formatBaht(SkusService_1.bahtWeight(weightG));
        return `${nameLo.trim()} ${baht} ບາດ (${SkusService_1.formatGrams(weightG)} g)`;
    }
    parseWeight(raw) {
        const weight = (0, domain_1.dec)(raw);
        if (!weight.isFinite() || weight.lte(0)) {
            throw new common_1.BadRequestException('ນ້ຳໜັກຕ້ອງໃຫຍ່ກວ່າ 0');
        }
        return weight;
    }
    /** Real-time preview for the SKU builder — no write. */
    preview(nameLo, weightG) {
        const weight = this.parseWeight(weightG);
        const baht = SkusService_1.bahtWeight(weight);
        return {
            weightG: weight.toFixed(),
            weightDisplay: SkusService_1.formatGrams(weight),
            bahtWeight: baht.toFixed(),
            bahtWeightDisplay: SkusService_1.formatBaht(baht),
            fullSkuName: SkusService_1.buildFullSkuName(nameLo, weight),
        };
    }
    async list(includeInactive = false) {
        return this.prisma.goldSku.findMany({
            where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
            include: { goldItem: true },
            orderBy: [{ goldItem: { sortOrder: 'asc' } }, { weightG: 'desc' }],
        });
    }
    /** ລະຫັດ SKU ອັດຕະໂນມັດ — ຕົວນັບອະຕອມມິກ ບໍ່ແມ່ນ count()+1. */
    nextSkuCode() {
        return this.codes.nextFor('GOLD_SKU', this.prisma.goldSku);
    }
    async create(dto, actorId) {
        const weight = this.parseWeight(dto.weightG);
        const goldItem = await this.prisma.goldItem.findFirst({
            where: { id: dto.goldItemId, deletedAt: null },
        });
        if (!goldItem)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການຄຳທີ່ເລືອກ');
        /*
         * ໜຶ່ງລາຍການຄຳ + ໜຶ່ງນ້ຳໜັກ = ໜຶ່ງ SKU, ບັງຄັບດ້ວຍ unique index ທີ່ນັບ
         * ລວມແຖວທີ່ລຶບໄປແລ້ວນຳ. ສະນັ້ນ ຖ້າເຄີຍລຶບ SKU ນີ້ໄປ ແລ້ວສ້າງຄືນອັນເກົ່າ
         * ການ insert ຈະຕາຍຢູ່ຖານຂໍ້ມູນ (ແຕ່ກ່ອນອອກເປັນ error 500 ທີ່ອ່ານບໍ່ອອກ).
         *
         * ຟື້ນແຖວເກົ່າຄືນແທນການ insert ໃໝ່: ຍອດສາງ ແລະ ປະຫວັດທີ່ເຄີຍອ້າງ SKU
         * ນີ້ຍັງອ້າງແຖວເກົ່າຢູ່ ຈຶ່ງບໍ່ຂາດຕອນ ແລະ ລະຫັດ SKU ກໍຄົງເດີມ.
         */
        const weightValue = new client_1.Prisma.Decimal(weight.toFixed());
        const existing = await this.prisma.goldSku.findFirst({
            where: { goldItemId: dto.goldItemId, weightG: weightValue },
        });
        if (existing && existing.deletedAt === null) {
            throw new common_1.ConflictException('SKU ນ້ຳໜັກນີ້ມີຢູ່ແລ້ວ');
        }
        const data = {
            nameLo: dto.nameLo.trim(),
            bahtWeight: new client_1.Prisma.Decimal(SkusService_1.bahtWeight(weight).toFixed()),
            fullSkuName: SkusService_1.buildFullSkuName(dto.nameLo, weight),
        };
        const created = existing
            ? await this.prisma.goldSku.update({
                where: { id: existing.id },
                data: {
                    ...data,
                    deletedAt: null,
                    isActive: true,
                    createdById: actorId,
                    code: existing.code ?? (await this.nextSkuCode()),
                },
                include: { goldItem: true },
            })
            : await this.prisma.goldSku.create({
                data: {
                    ...data,
                    code: await this.nextSkuCode(),
                    goldItemId: dto.goldItemId,
                    weightG: weightValue,
                    createdById: actorId,
                },
                include: { goldItem: true },
            });
        await this.audit.record({
            actorId,
            action: 'CREATE',
            entity: 'GoldSku',
            entityId: created.id,
            after: { fullSkuName: created.fullSkuName, weightG: created.weightG.toFixed() },
            summary: `ເພີ່ມ SKU ${created.fullSkuName}`,
        });
        return created;
    }
    async update(id, dto, actorId) {
        const existing = await this.prisma.goldSku.findFirst({ where: { id, deletedAt: null } });
        if (!existing)
            throw new common_1.NotFoundException('ບໍ່ພົບ SKU');
        const weight = dto.weightG ? this.parseWeight(dto.weightG) : (0, domain_1.dec)(existing.weightG.toFixed());
        const nameLo = dto.nameLo?.trim() ?? existing.nameLo;
        const updated = await this.prisma.goldSku.update({
            where: { id },
            data: {
                nameLo,
                weightG: new client_1.Prisma.Decimal(weight.toFixed()),
                bahtWeight: new client_1.Prisma.Decimal(SkusService_1.bahtWeight(weight).toFixed()),
                fullSkuName: SkusService_1.buildFullSkuName(nameLo, weight),
                ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
            },
            include: { goldItem: true },
        });
        await this.audit.record({
            actorId,
            action: 'UPDATE',
            entity: 'GoldSku',
            entityId: id,
            before: { fullSkuName: existing.fullSkuName, weightG: existing.weightG.toFixed() },
            after: { fullSkuName: updated.fullSkuName, weightG: updated.weightG.toFixed() },
        });
        return updated;
    }
    async remove(id, actorId) {
        const existing = await this.prisma.goldSku.findFirst({ where: { id, deletedAt: null } });
        if (!existing)
            throw new common_1.NotFoundException('ບໍ່ພົບ SKU');
        // Soft delete so the row still resolves in historic stock movements and
        // surfaces in the Deleted List module.
        const removed = await this.prisma.goldSku.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        await this.audit.record({
            actorId,
            action: 'DELETE',
            entity: 'GoldSku',
            entityId: id,
            before: { fullSkuName: existing.fullSkuName },
            summary: `ລຶບ SKU ${existing.fullSkuName}`,
        });
        return removed;
    }
};
exports.SkusService = SkusService;
exports.SkusService = SkusService = SkusService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        code_generator_service_1.CodeGeneratorService])
], SkusService);
//# sourceMappingURL=skus.service.js.map