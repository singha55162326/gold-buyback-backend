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
exports.StockService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_1 = require("@kpv/domain");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/services/audit.service");
const approval_service_1 = require("../../common/services/approval.service");
const business_day_service_1 = require("../../common/services/business-day.service");
const history_range_service_1 = require("../../common/services/history-range.service");
const stock_ledger_service_1 = require("../../common/services/stock-ledger.service");
const apar_posting_service_1 = require("../../common/services/apar-posting.service");
const notifications_service_1 = require("../notifications/notifications.service");
const D = (value) => new client_1.Prisma.Decimal(value.toFixed());
const toDec = (value) => (0, domain_1.dec)(value?.toFixed() ?? 0);
/**
 * TOR §7.1 / §7.2 / §7.3 — the warehouse.
 *
 * Two rules shape this module:
 *
 *  1. A Stock OUT does not take effect when it is created. It waits for
 *     Admin/Manager approval, because an unapproved OUT that had already
 *     deducted stock would let anyone move gold out of the shop.
 *
 *  2. An OUT to FACTORY does not take effect even when approved. It parks in
 *     `FactoryOutTracking` until the factory reports the assessed weight
 *     (§7.3) — the shop does not know how much gold it has actually parted
 *     with until then.
 */
let StockService = class StockService {
    prisma;
    audit;
    approval;
    businessDay;
    stockLedger;
    apar;
    notifications;
    range;
    constructor(prisma, audit, approval, businessDay, stockLedger, apar, notifications, range) {
        this.prisma = prisma;
        this.audit = audit;
        this.approval = approval;
        this.businessDay = businessDay;
        this.stockLedger = stockLedger;
        this.apar = apar;
        this.notifications = notifications;
        this.range = range;
    }
    /* ---------------------------------------------------------------- *
     * Stock IN — §7.1 (NEW) and §7.2 (OLD)
     * ---------------------------------------------------------------- */
    /**
     * Stock IN takes effect immediately: the gold is physically in the shop, so
     * withholding it from the ledger would understate what the shop holds.
     */
    async stockIn(dto, user) {
        /*
         * ຄຳເກົ່າເຂົ້າສາງ ມາຈາກ Cashier ສະເໝີ (TOR §7.1 ຕາມທີ່ລູກຄ້າແຈ້ງ): ມັນຄື
         * ຄຳທີ່ຮັບຊື້ຄືນໜ້າຮ້ານ. ບັງຄັບຢູ່ server ບໍ່ແມ່ນແຕ່ຢູ່ຟອມ, ເພື່ອບໍ່ໃຫ້
         * ຄຳເກົ່າຖືກບັນທຶກເປັນໜີ້ຕ້ອງສົ່ງຄືນໃຫ້ຜູ້ສະໜອງໂດຍບັງເອີນ.
         */
        const partner = dto.scope === 'OLD'
            ? await this.prisma.partnerSource.findFirst({
                where: { code: 'CASHIER', deletedAt: null },
            })
            : dto.partnerId
                ? await this.prisma.partnerSource.findFirst({
                    where: { id: dto.partnerId, deletedAt: null },
                })
                : null;
        if (!partner)
            throw new common_1.NotFoundException('ບໍ່ພົບແຫຼ່ງທີ່ມາ');
        const partnerId = partner.id;
        const lines = dto.lines.map((line) => ({
            ...line,
            goldG: (0, domain_1.lineGoldWeight)(line.weightG, line.quantity),
        }));
        const totalGoldG = lines.reduce((sum, l) => sum.plus(l.goldG), (0, domain_1.dec)(0));
        const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
        const totalCost = (0, domain_1.dec)(dto.totalCost);
        if (totalGoldG.lte(0))
            throw new common_1.BadRequestException('ນ້ຳໜັກລວມຕ້ອງໃຫຍ່ກວ່າ 0');
        // ລາຄາ/g = ຕົ້ນທຶນຄໍາ / GOLD (g)
        const perG = totalCost.div(totalGoldG);
        const day = await this.businessDay.current();
        // ຄ່າແຮງ ມີແຕ່ຝັ່ງ Stock (NEW); ຖ້າ client ເກົ່າສົ່ງມາກັບ OLD ກໍຖິ້ມ.
        const laborFeeThb = dto.scope === 'NEW' ? (0, domain_1.dec)(dto.laborFeeThb ?? 0) : (0, domain_1.dec)(0);
        return this.prisma.$transaction(async (tx) => {
            const movement = await tx.stockMovement.create({
                data: {
                    code: await this.nextCode(tx, 'IN'),
                    scope: dto.scope,
                    type: 'IN',
                    partnerId,
                    totalQuantity,
                    totalGoldG: D(totalGoldG),
                    totalCost: D(totalCost),
                    pricePerG: D(perG),
                    pricePerBaht: D((0, domain_1.pricePerBaht)(perG)),
                    laborFeeThb: D(laborFeeThb),
                    status: 'COMPLETED',
                    note: dto.note ?? null,
                    createdById: user.id,
                    approvedById: user.id,
                    approvedAt: new Date(),
                    lines: {
                        create: lines.map((line) => ({
                            goldSkuId: line.goldSkuId ?? null,
                            goldTypeId: line.goldTypeId ?? null,
                            goldItemId: line.goldItemId ?? null,
                            oldCategory: dto.scope === 'OLD' ? (line.oldCategory ?? null) : null,
                            weightG: D((0, domain_1.dec)(line.weightG)),
                            quantity: line.quantity,
                            goldG: D(line.goldG),
                            cost: D(line.goldG.mul(perG)),
                        })),
                    },
                },
                include: { lines: true },
            });
            if (dto.scope === 'NEW') {
                await this.stockLedger.postNew(tx, {
                    businessDayId: day.id,
                    goldInG: totalGoldG,
                    priceIn: totalCost,
                    partnerLabel: partner.nameLo,
                    typeLabel: `IN — ${movement.code}`,
                    movementId: movement.id,
                    createdById: user.id,
                });
                await this.refreshSkuBalances(tx, day.id, lines, 'IN');
            }
            else {
                for (const line of lines) {
                    if (!line.goldTypeId)
                        continue;
                    await this.stockLedger.postOld(tx, {
                        goldTypeId: line.goldTypeId,
                        businessDayId: day.id,
                        goldInG: line.goldG,
                        priceIn: line.goldG.mul(perG),
                        partnerLabel: partner.nameLo,
                        typeLabel: `IN — ${movement.code}`,
                        movementId: movement.id,
                        createdById: user.id,
                    });
                }
            }
            // §8.3 — gold received creates or settles an obligation to the partner.
            await this.apar.postGold(tx, {
                scope: dto.scope,
                type: 'IN',
                partnerId,
                weightG: totalGoldG,
                cost: totalCost,
                movementId: movement.id,
                refType: 'STOCK_IN',
                createdById: user.id,
            });
            // §9.2 — ຄ່າແຮງຊ່າງ on a Stock IN is a cash payable until settled.
            if (laborFeeThb.gt(0)) {
                await this.apar.postCash(tx, {
                    reason: 'LABOR_PAYABLE',
                    currency: 'THB',
                    amount: laborFeeThb,
                    refId: movement.id,
                    note: `ຄ່າແຮງຊ່າງ ${movement.code}`,
                    createdById: user.id,
                });
            }
            await this.audit.record({
                actorId: user.id,
                action: 'CREATE',
                entity: 'StockMovement',
                entityId: movement.id,
                after: { code: movement.code, totalGoldG: totalGoldG.toFixed(), scope: dto.scope },
                summary: `Stock IN ${movement.code} — ${totalGoldG.toFixed()} g ຈາກ ${partner.nameLo}`,
            }, tx);
            return movement;
        });
    }
    /* ---------------------------------------------------------------- *
     * Stock OUT — requires Admin/Manager approval
     * ---------------------------------------------------------------- */
    async stockOut(dto, user) {
        const partner = await this.prisma.partnerSource.findFirst({
            where: { id: dto.partnerId, deletedAt: null },
        });
        if (!partner)
            throw new common_1.NotFoundException('ບໍ່ພົບແຫຼ່ງສົ່ງອອກ');
        const lines = dto.lines.map((line) => ({
            ...line,
            goldG: (0, domain_1.lineGoldWeight)(line.weightG, line.quantity),
        }));
        const totalGoldG = lines.reduce((sum, l) => sum.plus(l.goldG), (0, domain_1.dec)(0));
        const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
        if (totalGoldG.lte(0))
            throw new common_1.BadRequestException('ນ້ຳໜັກລວມຕ້ອງໃຫຍ່ກວ່າ 0');
        // ⚠ §7.2: never let an OUT exceed what the bucket actually holds.
        if (dto.scope === 'OLD') {
            const byType = new Map();
            for (const line of lines) {
                if (!line.goldTypeId)
                    continue;
                byType.set(line.goldTypeId, (byType.get(line.goldTypeId) ?? (0, domain_1.dec)(0)).plus(line.goldG));
            }
            for (const [goldTypeId, requested] of byType) {
                const available = await this.stockLedger.availableOldWeight(goldTypeId);
                const check = (0, domain_1.checkStockOut)(available, requested);
                if (!check.allowed)
                    throw new common_1.BadRequestException(check.messageLo);
            }
        }
        else {
            const position = await this.stockLedger.newPosition();
            const check = (0, domain_1.checkStockOut)(position.weightG, totalGoldG);
            if (!check.allowed)
                throw new common_1.BadRequestException(check.messageLo);
        }
        // OUT is costed at WAC, so the cost of goods sold reflects the blended
        // acquisition price rather than whatever the newest purchase happened to be.
        const wac = await this.stockLedger.currentWac();
        const perG = wac.pricePerG;
        const totalCost = totalGoldG.mul(perG);
        const goldPercent = dto.goldPercent ? (0, domain_1.dec)(dto.goldPercent) : null;
        const movement = await this.prisma.stockMovement.create({
            data: {
                code: await this.nextCode(this.prisma, 'OUT'),
                scope: dto.scope,
                type: 'OUT',
                partnerId: dto.partnerId,
                cabinetId: dto.cabinetId ?? null,
                transformType: dto.transformType ?? null,
                goldPercent: goldPercent ? D(goldPercent) : null,
                expectedReturnG: goldPercent ? D((0, domain_1.expectedReturnWeight)(totalGoldG, goldPercent)) : null,
                totalQuantity,
                totalGoldG: D(totalGoldG),
                totalCost: D(totalCost),
                pricePerG: D(perG),
                pricePerBaht: D((0, domain_1.pricePerBaht)(perG)),
                status: 'PENDING',
                note: dto.note ?? null,
                createdById: user.id,
                lines: {
                    create: lines.map((line) => ({
                        goldSkuId: line.goldSkuId ?? null,
                        goldTypeId: line.goldTypeId ?? null,
                        weightG: D((0, domain_1.dec)(line.weightG)),
                        quantity: line.quantity,
                        goldG: D(line.goldG),
                        cost: D(line.goldG.mul(perG)),
                    })),
                },
            },
            include: { lines: true },
        });
        await this.audit.record({
            actorId: user.id,
            action: 'CREATE',
            entity: 'StockMovement',
            entityId: movement.id,
            after: { code: movement.code, totalGoldG: totalGoldG.toFixed() },
            summary: `ຮ້ອງຂໍ Stock OUT ${movement.code} — ${totalGoldG.toFixed()} g ໄປ ${partner.nameLo}`,
        });
        /*
         * ທັງ Admin ແລະ Manager ອະນຸມັດ Stock OUT ໄດ້ (TOR §7.2) ແຕ່ການແຈ້ງເຕືອນ
         * ຮັບໄດ້ Role ດຽວຕໍ່ແຖວ — ສົ່ງສອງແຖວ, ບໍ່ດັ່ງນັ້ນ Manager ຈະບໍ່ເຫັນກະດິ່ງ
         * ແລະ ລາຍການຈະຄ້າງລໍຖ້າໂດຍບໍ່ມີໃຜຮູ້.
         */
        for (const recipientRole of ['ADMIN', 'MANAGER']) {
            await this.notifications.notify({
                kind: 'STOCK_OUT_APPROVAL',
                recipientRole,
                title: 'ມີ Stock OUT ລໍຖ້າອະນຸມັດ',
                body: `${movement.code} — ${totalGoldG.toFixed()} g ໄປ ${partner.nameLo}`,
                refType: 'StockMovement',
                refId: movement.id,
            });
        }
        return movement;
    }
    /**
     * Admin/Manager approves a Stock OUT.
     *
     * For every destination except FACTORY the stock moves here. For FACTORY it
     * does NOT: the row is parked in FactoryOutTracking until the assessed
     * weight comes back (§7.3).
     */
    async reviewOut(id, dto, user) {
        const movement = await this.prisma.stockMovement.findFirst({
            where: { id, deletedAt: null },
            include: { lines: true, partner: true },
        });
        if (!movement)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການ');
        if (!movement.partner)
            throw new common_1.BadRequestException('ລາຍການນີ້ບໍ່ມີແຫຼ່ງສົ່ງອອກ');
        const next = dto.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        this.approval.assertTransition(movement.status, next);
        const day = await this.businessDay.current();
        const isFactory = movement.partner.code === 'FACTORY';
        return this.prisma.$transaction(async (tx) => {
            if (dto.decision === 'APPROVED') {
                if (isFactory) {
                    // §7.3 — park it; nothing is deducted yet.
                    await tx.factoryOutTracking.create({
                        data: {
                            movementId: movement.id,
                            partnerId: movement.partnerId,
                            goldOutG: movement.totalGoldG,
                            cost: movement.totalCost,
                            status: 'AWAITING_ASSESSMENT',
                        },
                    });
                    await this.notifications.notify({
                        kind: 'FACTORY_ASSESSMENT',
                        recipientRole: 'WAREHOUSE',
                        title: 'ລໍຖ້າ FACTORY ປະເມີນນ້ຳໜັກ',
                        body: `${movement.code} — ${movement.totalGoldG.toFixed()} g`,
                        refType: 'StockMovement',
                        refId: movement.id,
                    }, tx);
                }
                else {
                    await this.applyOut(tx, movement, day.id, user.id);
                }
            }
            const updated = await tx.stockMovement.update({
                where: { id },
                data: {
                    // A FACTORY OUT stays APPROVED until §7.3 completes it.
                    status: dto.decision === 'APPROVED' ? (isFactory ? 'APPROVED' : 'COMPLETED') : 'REJECTED',
                    approvedById: user.id,
                    approvedAt: new Date(),
                    rejectReason: dto.decision === 'REJECTED' ? (dto.reason ?? null) : null,
                },
            });
            await this.audit.record({
                actorId: user.id,
                action: dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
                entity: 'StockMovement',
                entityId: id,
                before: { status: movement.status },
                after: { status: updated.status },
                summary: `${dto.decision === 'APPROVED' ? 'ອະນຸມັດ' : 'ປະຕິເສດ'} Stock OUT ${movement.code}`,
            }, tx);
            return updated;
        });
    }
    /** Deduct the stock and post the AP/AR (GOLD) side of an approved OUT. */
    async applyOut(tx, movement, businessDayId, userId) {
        const totalGoldG = toDec(movement.totalGoldG);
        const totalCost = toDec(movement.totalCost);
        if (movement.scope === 'NEW') {
            await this.stockLedger.postNew(tx, {
                businessDayId,
                goldOutG: totalGoldG,
                priceOut: totalCost,
                partnerLabel: movement.partner?.nameLo,
                typeLabel: `OUT — ${movement.code}`,
                movementId: movement.id,
                createdById: userId,
            });
            await this.refreshSkuBalances(tx, businessDayId, movement.lines.map((l) => ({
                goldSkuId: l.goldSkuId ?? undefined,
                quantity: l.quantity,
                weightG: l.weightG.toFixed(),
            })), 'OUT');
        }
        else {
            for (const line of movement.lines) {
                if (!line.goldTypeId)
                    continue;
                await this.stockLedger.postOld(tx, {
                    goldTypeId: line.goldTypeId,
                    businessDayId,
                    goldOutG: toDec(line.goldG),
                    priceOut: toDec(line.cost),
                    partnerLabel: movement.partner?.nameLo,
                    typeLabel: `OUT — ${movement.code}`,
                    movementId: movement.id,
                    createdById: userId,
                });
            }
        }
        if (movement.partnerId) {
            await this.apar.postGold(tx, {
                scope: movement.scope,
                type: 'OUT',
                partnerId: movement.partnerId,
                weightG: totalGoldG,
                cost: totalCost,
                movementId: movement.id,
                refType: 'STOCK_OUT',
                createdById: userId,
            });
        }
    }
    /* ---------------------------------------------------------------- *
     * §7.3 — ຕິດຕາມ Stock Out ໄປ FACTORY
     * ---------------------------------------------------------------- */
    /**
     * ລາຍການຕິດຕາມ FACTORY (TOR §7.3).
     *
     * ສົ່ງ ປະເພດຄຳ ແລະ ຜູ້ອັບເດດ ມານຳ: ແຖວໜຶ່ງອາດມີຫຼາຍປະເພດຄຳ (OUT ຮັບຫຼາຍ
     * ປະເພດໃນລາຍການດຽວ), ສະນັ້ນສົ່ງເປັນລາຍການ ບໍ່ແມ່ນຄ່າດຽວ. ຊື່ຜູ້ອັບເດດ
     * ດຶງເປັນ query ດຽວຕໍ່ໜ້າ ບໍ່ແມ່ນ join ຕໍ່ແຖວ.
     */
    async listFactoryTracking(query, user) {
        const range = this.range.resolve(query, user);
        const where = { createdAt: history_range_service_1.HistoryRangeService.window(range) };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.factoryOutTracking.findMany({
                where,
                include: {
                    movement: {
                        include: { lines: { include: { goldType: true } }, partner: true },
                    },
                    partner: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: range.skip,
                take: range.take,
            }),
            this.prisma.factoryOutTracking.count({ where }),
        ]);
        /*
         * ຜູ້ບັນທຶກ = ຜູ້ທີ່ສ້າງລາຍການສົ່ງຄຳອອກ FACTORY (ຢູ່ຕາຕະລາງ StockMovement),
         * ສ່ວນ ຜູ້ແກ້ໄຂ = ຜູ້ປ້ອນນ້ຳໜັກທີ່ FACTORY ປະເມີນ. ສອງຄົນນີ້ມັກຕ່າງກັນ
         * ຈຶ່ງສະແດງທັງສອງ.
         */
        const actorIds = [
            ...new Set(rows
                .flatMap((r) => [r.updatedById, r.movement.createdById])
                .filter((id) => Boolean(id))),
        ];
        const actors = actorIds.length
            ? await this.prisma.user.findMany({
                where: { id: { in: actorIds } },
                select: { id: true, fullName: true },
            })
            : [];
        const nameById = new Map(actors.map((u) => [u.id, u.fullName]));
        return this.range.page(rows.map((row) => ({
            ...row,
            createdBy: nameById.get(row.movement.createdById) ?? '—',
            updatedBy: row.updatedById ? (nameById.get(row.updatedById) ?? '—') : '—',
            goldTypesLo: [
                ...new Set(row.movement.lines
                    .map((l) => l.goldType?.nameLo)
                    .filter((n) => Boolean(n))),
            ].join(', '),
        })), total, range);
    }
    /**
     * ອັບເດດ ນໍ້າໜັກg FACTORY ປະເມີນ.
     *
     * This is where a FACTORY OUT finally takes effect: Stock (OLD) is deducted
     * at the weight KPV sent, and AP/AR (GOLD) is booked at the weight FACTORY
     * acknowledged. The two differ by the melt loss, which is precisely the
     * discrepancy the shop needs visible.
     *
     * Once COMPLETED only ADMIN/MANAGER may edit — enforced on the controller.
     */
    async recordFactoryAssessment(id, dto, user) {
        const tracking = await this.prisma.factoryOutTracking.findUnique({
            where: { id },
            include: { movement: { include: { lines: true, partner: true } } },
        });
        if (!tracking)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການຕິດຕາມ');
        const assessed = (0, domain_1.dec)(dto.factoryAssessedG);
        if (!assessed.isFinite() || assessed.lte(0)) {
            throw new common_1.BadRequestException('ນ້ຳໜັກທີ່ FACTORY ປະເມີນຕ້ອງໃຫຍ່ກວ່າ 0');
        }
        const wasCompleted = tracking.status === 'COMPLETED';
        const day = await this.businessDay.current();
        return this.prisma.$transaction(async (tx) => {
            // Only the first completion posts; later edits by Admin correct the
            // recorded figure without double-deducting the stock.
            if (!wasCompleted) {
                for (const line of tracking.movement.lines) {
                    if (!line.goldTypeId)
                        continue;
                    await this.stockLedger.postOld(tx, {
                        goldTypeId: line.goldTypeId,
                        businessDayId: day.id,
                        goldOutG: toDec(line.goldG),
                        priceOut: toDec(line.cost),
                        partnerLabel: tracking.movement.partner?.nameLo ?? 'FACTORY',
                        typeLabel: `OUT FACTORY — ${tracking.movement.code}`,
                        movementId: tracking.movementId,
                        createdById: user.id,
                    });
                }
                await this.apar.postGold(tx, {
                    scope: 'OLD',
                    type: 'OUT',
                    partnerId: tracking.partnerId,
                    weightG: assessed,
                    cost: toDec(tracking.cost),
                    movementId: tracking.movementId,
                    refType: 'FACTORY_ASSESSED',
                    note: `FACTORY ປະເມີນ ${assessed.toFixed()} g ຈາກ ${tracking.goldOutG.toFixed()} g`,
                    createdById: user.id,
                });
                await tx.stockMovement.update({
                    where: { id: tracking.movementId },
                    data: { status: 'COMPLETED' },
                });
            }
            const updated = await tx.factoryOutTracking.update({
                where: { id },
                data: {
                    factoryAssessedG: D(assessed),
                    status: 'COMPLETED',
                    completedAt: tracking.completedAt ?? new Date(),
                    updatedById: user.id,
                },
            });
            await this.audit.record({
                actorId: user.id,
                action: wasCompleted ? 'UPDATE' : 'COMPLETE',
                entity: 'FactoryOutTracking',
                entityId: id,
                before: { factoryAssessedG: tracking.factoryAssessedG?.toFixed() ?? null },
                after: { factoryAssessedG: assessed.toFixed() },
                summary: wasCompleted
                    ? `ແກ້ໄຂນ້ຳໜັກ FACTORY ປະເມີນ ${tracking.movement.code} = ${assessed.toFixed()} g`
                    : `FACTORY ປະເມີນ ${tracking.movement.code} = ${assessed.toFixed()} g`,
            }, tx);
            return updated;
        });
    }
    /* ---------------------------------------------------------------- *
     * Transfer NEW <-> OLD (§7.1, §7.2)
     * ---------------------------------------------------------------- */
    async transfer(dto, user) {
        const totalGoldG = dto.lines.reduce((sum, line) => sum.plus((0, domain_1.lineGoldWeight)(line.weightG, line.quantity)), (0, domain_1.dec)(0));
        if (totalGoldG.lte(0))
            throw new common_1.BadRequestException('ນ້ຳໜັກລວມຕ້ອງໃຫຍ່ກວ່າ 0');
        const from = dto.direction === 'NEW_TO_OLD' ? 'NEW' : 'OLD';
        if (from === 'OLD') {
            const available = await this.stockLedger.availableOldWeight(dto.goldTypeId);
            const check = (0, domain_1.checkStockOut)(available, totalGoldG);
            if (!check.allowed)
                throw new common_1.BadRequestException(check.messageLo);
        }
        else {
            const position = await this.stockLedger.newPosition();
            const check = (0, domain_1.checkStockOut)(position.weightG, totalGoldG);
            if (!check.allowed)
                throw new common_1.BadRequestException(check.messageLo);
        }
        const wac = await this.stockLedger.currentWac();
        const perG = wac.pricePerG;
        const totalCost = totalGoldG.mul(perG);
        const day = await this.businessDay.current();
        return this.prisma.$transaction(async (tx) => {
            const movement = await tx.stockMovement.create({
                data: {
                    code: await this.nextCode(tx, 'TR'),
                    scope: from,
                    type: 'TRANSFER',
                    totalQuantity: dto.lines.reduce((sum, l) => sum + l.quantity, 0),
                    totalGoldG: D(totalGoldG),
                    totalCost: D(totalCost),
                    pricePerG: D(perG),
                    pricePerBaht: D((0, domain_1.pricePerBaht)(perG)),
                    status: 'COMPLETED',
                    note: dto.note ?? null,
                    createdById: user.id,
                    approvedById: user.id,
                    approvedAt: new Date(),
                    lines: {
                        create: dto.lines.map((line) => ({
                            goldSkuId: line.goldSkuId ?? null,
                            goldTypeId: dto.goldTypeId,
                            weightG: D((0, domain_1.dec)(line.weightG)),
                            quantity: line.quantity,
                            goldG: D((0, domain_1.lineGoldWeight)(line.weightG, line.quantity)),
                            cost: D((0, domain_1.lineGoldWeight)(line.weightG, line.quantity).mul(perG)),
                        })),
                    },
                },
            });
            // A transfer is one movement with two legs: out of one warehouse and
            // into the other, at the same weight and cost, so total holdings are
            // unchanged.
            if (from === 'NEW') {
                await this.stockLedger.postNew(tx, {
                    businessDayId: day.id,
                    goldOutG: totalGoldG,
                    priceOut: totalCost,
                    typeLabel: `Transfer NEW→OLD — ${movement.code}`,
                    movementId: movement.id,
                    createdById: user.id,
                });
                await this.stockLedger.postOld(tx, {
                    goldTypeId: dto.goldTypeId,
                    businessDayId: day.id,
                    goldInG: totalGoldG,
                    priceIn: totalCost,
                    typeLabel: `Transfer NEW→OLD — ${movement.code}`,
                    movementId: movement.id,
                    createdById: user.id,
                });
            }
            else {
                await this.stockLedger.postOld(tx, {
                    goldTypeId: dto.goldTypeId,
                    businessDayId: day.id,
                    goldOutG: totalGoldG,
                    priceOut: totalCost,
                    typeLabel: `Transfer OLD→NEW — ${movement.code}`,
                    movementId: movement.id,
                    createdById: user.id,
                });
                await this.stockLedger.postNew(tx, {
                    businessDayId: day.id,
                    goldInG: totalGoldG,
                    priceIn: totalCost,
                    typeLabel: `Transfer OLD→NEW — ${movement.code}`,
                    movementId: movement.id,
                    createdById: user.id,
                });
            }
            await this.audit.record({
                actorId: user.id,
                action: 'CREATE',
                entity: 'StockMovement',
                entityId: movement.id,
                summary: `Transfer ${dto.direction} ${movement.code} — ${totalGoldG.toFixed()} g`,
            }, tx);
            return movement;
        });
    }
    /* ---------------------------------------------------------------- *
     * §4.3 — ມອບຄຳລະຫວ່າງມື້
     * ---------------------------------------------------------------- */
    /**
     * ມອບຄຳລະຫວ່າງມື້ — ສອງຮູບແບບ ຕາມທີ່ລູກຄ້າໃຊ້ຢູ່ໜ້າຮ້ານ:
     *
     *  ຄຳດີ / ຄຳຫຍຸບ / ແທ່ງ — ຊັ່ງເປັນຮອບ: ນ້ຳໜັກອອກ ແຍກເປັນ ເນື້ອລ້ວນ + ມີແກ້ວ,
     *  ສ່ວນທີ່ເຫຼືອເປັນ ຂາດດຸ. ຂາດດຸ ຄຳນວນຢູ່ server ບໍ່ແມ່ນຮັບມາຈາກຟອມ, ຈຶ່ງ
     *  ບໍ່ມີທາງທີ່ຕົວເລກໃນບິນຈະບໍ່ກົງກັບສູດ.
     *
     *  ຄຳຕົ້ມ — ມອບເປັນລາຍການ: ເລືອກ Buyback ຄຳຕົ້ມ ທີ່ຍັງບໍ່ໄດ້ມອບ ຫຼາຍລາຍການ
     *  ຕໍ່ຄັ້ງ ແລະ ບໍ່ໄລ່ເປັນຮອບ (ຕາມທີ່ລູກຄ້າແຈ້ງ).
     */
    async createHandover(dto, user, shiftId) {
        // ຮອບດຽວມອບ ຄຳດີ + ຄຳຫຍຸບ + ແທ່ງ ພ້ອມກັນໄດ້ (TOR §4.2 ຕາມແບບທີ່ລູກຄ້າໃຫ້).
        if (dto.lines?.length)
            return this.createHandoverRound(dto, user, shiftId);
        if (!dto.goldTypeId)
            throw new common_1.BadRequestException('ຕ້ອງເລືອກປະເພດຄຳ');
        const goldType = await this.prisma.goldType.findFirst({
            where: { id: dto.goldTypeId, deletedAt: null },
        });
        if (!goldType)
            throw new common_1.NotFoundException('ບໍ່ພົບປະເພດຄຳທີ່ເລືອກ');
        /*
         * ຮູບແບບເກົ່າ (ປະເພດດຽວ, ນ້ຳໜັກຢູ່ລະດັບເທິງ) ຖືກແປງເປັນຮອບທີ່ມີແຖວດຽວ —
         * ກົດການກວດ ແລະ ການຄິດຕົ້ນທຶນຈຶ່ງມີຊຸດດຽວ ບໍ່ແມ່ນສອງຊຸດທີ່ຂັດກັນ.
         */
        if (goldType.code !== 'BOILED') {
            return this.createHandoverRound({
                ...dto,
                lines: [
                    {
                        goldTypeId: goldType.id,
                        outWeightG: dto.grossWeightG ?? dto.weightG ?? '0',
                        pureWeightG: dto.pureWeightG,
                        glassWeightG: dto.glassWeightG,
                    },
                ],
            }, user, shiftId);
        }
        const day = await this.businessDay.current();
        // ── ຄຳຕົ້ມ: ນ້ຳໜັກມາຈາກລາຍການທີ່ເລືອກ, ບໍ່ແມ່ນຈາກຊ່ອງປ້ອນ
        let items = [];
        let weightG;
        {
            const ids = [...new Set(dto.buybackIds ?? [])];
            if (ids.length === 0) {
                throw new common_1.BadRequestException('ຄຳຕົ້ມ ຕ້ອງເລືອກລາຍການຄຳເກົ່າທີ່ຮັບຊື້ຄືນ');
            }
            const rows = await this.prisma.buyback.findMany({
                where: {
                    id: { in: ids },
                    deletedAt: null,
                    status: 'COMPLETED',
                    goldTypeId: goldType.id,
                    handoverItem: null,
                },
                select: {
                    id: true, weightG: true, quantity: true,
                    goldPercent: true, payableAmount: true,
                },
            });
            if (rows.length !== ids.length) {
                throw new common_1.BadRequestException('ມີລາຍການທີ່ມອບແລ້ວ ຫຼື ບໍ່ຢູ່ໃນເງື່ອນໄຂ — ກະລຸນາໂຫຼດລາຍການຄືນ');
            }
            items = rows.map((r) => ({
                buybackId: r.id,
                weightG: r.weightG,
                quantity: r.quantity,
                goldPercent: r.goldPercent,
                payableAmount: r.payableAmount,
            }));
            /*
             * `Buyback.weightG` ເປັນ "ຍອດລວມຂອງບິນ" ຢູ່ແລ້ວ (Σ ນ້ຳໜັກ × ຈຳນວນ
             * ຂອງທຸກແຖວ) ຕັ້ງແຕ່ບິນດຽວມີຫຼາຍແຖວໄດ້ — ຄູນດ້ວຍ `quantity` ຂອງຫົວບິນ
             * ອີກເທື່ອ ຈະນັບສອງເທື່ອ.
             */
            weightG = rows.reduce((sum, r) => sum.plus(toDec(r.weightG)), (0, domain_1.dec)(0));
        }
        // ຕົ້ນທຶນເຂົ້າສາງ ຂອງ ຄຳຕົ້ມ = ລາຄາທີ່ຈ່າຍຂອງລາຍການທີ່ເລືອກ (ບໍ່ແມ່ນສະເລ່ຍ).
        const warehouseCost = items.reduce((sum, i) => sum.plus(toDec(i.payableAmount)), (0, domain_1.dec)(0));
        const handover = await this.prisma.$transaction(async (tx) => 
        // ຄຳຕົ້ມ ບໍ່ໄລ່ເປັນຮອບ => roundNo ປະໄວ້ null.
        tx.goldHandover.create({
            data: {
                code: await this.nextCode(tx, 'HO'),
                shiftId,
                businessDayId: day.id,
                goldTypeId: goldType.id,
                roundNo: null,
                weightG: D(weightG),
                warehouseCost: D(warehouseCost),
                note: dto.note ?? null,
                status: 'PENDING',
                createdById: user.id,
                items: { create: items },
            },
            include: { items: true, goldType: true },
        }));
        await this.notifications.notify({
            kind: 'GOLD_HANDOVER',
            recipientRole: 'WAREHOUSE',
            title: 'ມີການມອບຄຳລະຫວ່າງມື້',
            body: `${handover.code} — ${goldType.nameLo} ${items.length} ລາຍການ — ${weightG.toFixed()} g`,
            refType: 'GoldHandover',
            refId: handover.id,
        });
        return handover;
    }
    /**
     * ສະເລ່ຍ ກີບ/g ທີ່ຮັບມາຈາກຜູ້ປະເມີນໃນມື້ການຄ້ານີ້ ແຍກຕາມປະເພດຄຳ.
     *
     * ອ່ານຈາກ `buyback_lines` ບ່ອນດຽວ ຄືກັນກັບຕາຕະລາງສະຫຼຸບ ສະນັ້ນ ຕົ້ນທຶນ
     * ເຂົ້າສາງ ກັບ ສະເລ່ຍ/g ທີ່ສະແດງຢູ່ໜ້າຈໍ ຈຶ່ງມາຈາກຕົວເລກຊຸດດຽວກັນ.
     */
    async receivedAverageByType() {
        const from = business_day_service_1.BusinessDayService.localMidnight();
        const to = new Date(from);
        to.setDate(to.getDate() + 1);
        const lines = await this.prisma.buybackLine.findMany({
            where: {
                buyback: { deletedAt: null, status: 'COMPLETED', createdAt: { gte: from, lt: to } },
            },
            select: { goldTypeId: true, weightG: true, quantity: true, payableAmount: true },
        });
        const weight = new Map();
        const paid = new Map();
        for (const line of lines) {
            const w = toDec(line.weightG).mul(line.quantity);
            weight.set(line.goldTypeId, (weight.get(line.goldTypeId) ?? (0, domain_1.dec)(0)).plus(w));
            paid.set(line.goldTypeId, (paid.get(line.goldTypeId) ?? (0, domain_1.dec)(0)).plus(toDec(line.payableAmount)));
        }
        const average = new Map();
        for (const [goldTypeId, w] of weight) {
            if (w.gt(0))
                average.set(goldTypeId, (paid.get(goldTypeId) ?? (0, domain_1.dec)(0)).div(w));
        }
        return average;
    }
    /** ຕົ້ນທຶນເຂົ້າສາງ ຂອງນ້ຳໜັກກ້ອນໜຶ່ງ. ຍັງບໍ່ມີການຮັບຊື້ໃນມື້ => null. */
    async warehouseCostFor(goldTypeId, weightG) {
        const average = (await this.receivedAverageByType()).get(goldTypeId);
        return average ? weightG.mul(average) : null;
    }
    /**
     * ມອບຄຳເປັນ "ຮອບ" — ຮອບດຽວມີໄດ້ຫຼາຍປະເພດຄຳ.
     *
     * ເກັບເປັນແຖວລະປະເພດຄຳ ແຕ່ແບ່ງ ຮອບທີ ອັນດຽວກັນ: ສາງຮັບ/ປະຕິເສດເປັນລາຍ
     * ປະເພດໄດ້ ແລະ ການລົງສາງກໍຍັງແຍກຕາມປະເພດຄຳຄືເກົ່າ, ແຕ່ໃບພິມ ແລະ ຕາຕະລາງ
     * ຍັງອ່ານເປັນຮອບດຽວ ຕາມແບບທີ່ລູກຄ້າໃຫ້ມາ.
     */
    async createHandoverRound(dto, user, shiftId) {
        const lines = dto.lines ?? [];
        const ids = lines.map((l) => l.goldTypeId);
        if (new Set(ids).size !== ids.length) {
            throw new common_1.BadRequestException('ປະເພດຄຳຊ້ຳກັນໃນຮອບດຽວບໍ່ໄດ້');
        }
        const goldTypes = await this.prisma.goldType.findMany({
            where: { id: { in: ids }, deletedAt: null },
        });
        if (goldTypes.length !== new Set(ids).size) {
            throw new common_1.NotFoundException('ບໍ່ພົບປະເພດຄຳທີ່ເລືອກ');
        }
        const byId = new Map(goldTypes.map((t) => [t.id, t]));
        const average = await this.receivedAverageByType();
        const prepared = lines.map((line) => {
            const goldType = byId.get(line.goldTypeId);
            if (goldType.code === 'BOILED') {
                throw new common_1.BadRequestException('ຄຳຕົ້ມ ມອບເປັນລາຍການ ບໍ່ແມ່ນເປັນຮອບ');
            }
            const out = (0, domain_1.dec)(line.outWeightG);
            if (!out.isFinite() || out.lte(0)) {
                throw new common_1.BadRequestException(`${goldType.nameLo}: ນ້ຳໜັກລວມອອກຕ້ອງໃຫຍ່ກວ່າ 0`);
            }
            const pure = (0, domain_1.dec)(line.pureWeightG ?? 0);
            const glass = (0, domain_1.dec)(line.glassWeightG ?? 0);
            if (!pure.isFinite() || pure.isNegative() || !glass.isFinite() || glass.isNegative()) {
                throw new common_1.BadRequestException(`${goldType.nameLo}: ເນື້ອລ້ວນ ແລະ ມີແກ້ວ ຕ້ອງບໍ່ຕິດລົບ`);
            }
            /*
             * ເນື້ອລ້ວນ + ມີແກ້ວ ຕ້ອງບໍ່ນ້ອຍກວ່າ ນ້ຳໜັກລວມອອກ (ຕາມແບບທີ່ລູກຄ້າໃຫ້):
             * ຫຼາຍກວ່າໄດ້ ເພາະຊັ່ງແຍກສ່ວນມັກໄດ້ເກີນ, ແຕ່ນ້ອຍກວ່າແປວ່າຊັ່ງຕົກ.
             * ສຳລັບ ຄຳແທ່ງ ບໍ່ແຍກເນື້ອລ້ວນ/ມີແກ້ວ ຈຶ່ງຂ້າມການກວດນີ້.
             */
            const split = pure.gt(0) || glass.gt(0);
            if (split && pure.plus(glass).lt(out)) {
                throw new common_1.BadRequestException(`${goldType.nameLo}: ເນື້ອລ້ວນ + ມີແກ້ວ (${pure.plus(glass).toFixed()} g) ນ້ອຍກວ່ານ້ຳໜັກລວມອອກ (${out.toFixed()} g)`);
            }
            const perGram = average.get(goldType.id);
            return {
                goldType,
                out,
                pure: split ? pure : null,
                glass: split ? glass : null,
                /** ຂາດດຸ = ນ້ຳໜັກລວມອອກ − (ເນື້ອລ້ວນ + ມີແກ້ວ) — ຄຳນວນຢູ່ server. */
                shortfall: split ? out.minus(pure).minus(glass) : null,
                cost: perGram ? out.mul(perGram) : null,
            };
        });
        const day = await this.businessDay.current();
        const created = await this.prisma.$transaction(async (tx) => {
            const last = await tx.goldHandover.aggregate({
                where: { businessDayId: day.id, roundNo: { not: null } },
                _max: { roundNo: true },
            });
            const roundNo = (last._max.roundNo ?? 0) + 1;
            const rows = [];
            for (const line of prepared) {
                rows.push(await tx.goldHandover.create({
                    data: {
                        code: await this.nextCode(tx, 'HO'),
                        shiftId,
                        businessDayId: day.id,
                        goldTypeId: line.goldType.id,
                        roundNo,
                        weightG: D(line.out),
                        grossWeightG: D(line.out),
                        pureWeightG: line.pure ? D(line.pure) : null,
                        glassWeightG: line.glass ? D(line.glass) : null,
                        shortfallG: line.shortfall ? D(line.shortfall) : null,
                        warehouseCost: line.cost ? D(line.cost) : null,
                        note: dto.note ?? null,
                        status: 'PENDING',
                        createdById: user.id,
                    },
                    include: { items: true, goldType: true },
                }));
            }
            return rows;
        });
        const totalG = prepared.reduce((sum, l) => sum.plus(l.out), (0, domain_1.dec)(0));
        await this.notifications.notify({
            kind: 'GOLD_HANDOVER',
            recipientRole: 'WAREHOUSE',
            title: 'ມີການມອບຄຳລະຫວ່າງມື້',
            body: `ຮອບທີ ${created[0].roundNo} — ${prepared.map((l) => l.goldType.nameLo).join(', ')} — ${totalG.toFixed()} g`,
            refType: 'GoldHandover',
            refId: created[0].id,
        });
        return { roundNo: created[0].roundNo, rows: created };
    }
    /** Warehouse approves; the gold enters Stock (OLD) at zero added cost —
     *  it was already paid for by the Buyback that brought it in. */
    async reviewHandover(id, dto, user) {
        const handover = await this.prisma.goldHandover.findFirst({
            where: { id, deletedAt: null },
        });
        if (!handover)
            throw new common_1.NotFoundException('ບໍ່ພົບລາຍການມອບຄຳ');
        const next = dto.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        this.approval.assertTransition(handover.status, next);
        const day = await this.businessDay.current();
        return this.prisma.$transaction(async (tx) => {
            /*
             * ປະຕິເສດແລ້ວ ລາຍການຄຳຕົ້ມຕ້ອງກັບໄປຢູ່ "ລໍຖ້າມອບ" ເພື່ອມອບໃໝ່ໄດ້.
             *
             * "ຍັງບໍ່ໄດ້ມອບ" ອ່ານຈາກການບໍ່ມີ GoldHandoverItem ແລະ `buybackId` ເປັນ
             * unique — ຖ້າປະແຖວນັ້ນໄວ້ ຄຳຈະຄ້າງ: ມອບຄືນບໍ່ໄດ້ຕະຫຼອດໄປ. ຫົວບິນການ
             * ມອບຍັງຢູ່ຄົບ (ລະຫັດ, ສະຖານະ, ເຫດຜົນ, ນ້ຳໜັກ) ສຳລັບການກວດສອບ.
             */
            if (dto.decision === 'REJECTED') {
                await tx.goldHandoverItem.deleteMany({ where: { handoverId: id } });
            }
            const updated = await tx.goldHandover.update({
                where: { id },
                data: {
                    status: next,
                    approvedById: user.id,
                    approvedAt: new Date(),
                    rejectReason: dto.decision === 'REJECTED' ? (dto.reason ?? null) : null,
                },
            });
            await this.audit.record({
                actorId: user.id,
                action: dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
                entity: 'GoldHandover',
                entityId: id,
                summary: `${dto.decision === 'APPROVED' ? 'ຮັບ' : 'ປະຕິເສດ'}ການມອບຄຳ ${handover.code}`,
            }, tx);
            await this.notifications.notify({
                kind: 'APPROVAL_RESULT',
                recipientUserId: handover.createdById,
                title: dto.decision === 'APPROVED'
                    ? `ການມອບຄຳ ${handover.code} ຖືກຮັບແລ້ວ`
                    : `ການມອບຄຳ ${handover.code} ຖືກປະຕິເສດ`,
                refType: 'GoldHandover',
                refId: id,
            }, tx);
            return updated;
        });
    }
    /* ---------------------------------------------------------------- *
     * Reads
     * ---------------------------------------------------------------- */
    /** ລາຍການເຂົ້າ-ອອກສາງ ພ້ອມຊື່ຜູ້ບັນທຶກ ແລະ ຜູ້ອະນຸມັດ. */
    async listMovements(scope, status) {
        const rows = await this.prisma.stockMovement.findMany({
            where: { deletedAt: null, ...(scope ? { scope } : {}), ...(status ? { status } : {}) },
            include: { lines: true, partner: true, cabinet: true },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        return this.audit.withActorNames(rows);
    }
    async newHistory(query, user) {
        const range = this.range.resolve(query, user);
        // businessDate is a DATE column, so the inclusive end is the day itself.
        const where = { deletedAt: null, businessDate: history_range_service_1.HistoryRangeService.dayWindow(range) };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.stockNewLedger.findMany({
                where,
                orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
                skip: range.skip,
                take: range.take,
            }),
            this.prisma.stockNewLedger.count({ where }),
        ]);
        // ຜູ້ບັນທຶກ — ລູກຄ້າຂໍໃຫ້ເຫັນທຸກ Module ທີ່ມີການລົງລາຍການ.
        return this.range.page(await this.audit.withCreatorNames(rows), total, range);
    }
    async oldHistory(query, user) {
        const range = this.range.resolve(query, user);
        const where = { deletedAt: null, businessDate: history_range_service_1.HistoryRangeService.dayWindow(range) };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.stockOldLedger.findMany({
                where,
                include: { goldType: true },
                orderBy: [{ businessDate: 'desc' }, { sequence: 'desc' }],
                skip: range.skip,
                take: range.take,
            }),
            this.prisma.stockOldLedger.count({ where }),
        ]);
        return this.range.page(await this.audit.withCreatorNames(rows), total, range);
    }
    async oldBalances() {
        const day = await this.businessDay.current();
        return this.prisma.stockOldTypeBalance.findMany({
            where: { businessDayId: day.id },
            include: { goldType: true },
            orderBy: { goldType: { sortOrder: 'asc' } },
        });
    }
    async newBalances() {
        const day = await this.businessDay.current();
        return this.prisma.stockNewSkuBalance.findMany({
            where: { businessDayId: day.id },
            include: { goldSku: { include: { goldItem: true } } },
            orderBy: { goldSku: { fullSkuName: 'asc' } },
        });
    }
    /**
     * TOR §4.2 — ສະຫຼຸບປະເພດຄຳ for the day.
     *
     * Groups the day's completed buybacks by ປະເພດຄຳ and applies the §4.2
     * averages. The ຄຳດີ/ຫຍຸບ/ແທ່ງ divisor is (old weight − new weight), which
     * is zero whenever an exchange balances — so `goldTypeAverage` returns null
     * with a Lao reason rather than Infinity, and the UI renders "—".
     */
    async oldGoldSummary() {
        // ທຽບກັບຖັນ timestamp ຈຶ່ງໃຊ້ທ່ຽງຄືນ "ທ້ອງຖິ່ນ" — ທ່ຽງຄືນ UTC ຈະຕັດເອົາ
        // ການຮັບຊື້ຊ່ວງ 00:00–07:00 ຂອງມື້ນີ້ໄປນັບເປັນມື້ວານ.
        const businessDate = business_day_service_1.BusinessDayService.localMidnight();
        const tomorrow = new Date(businessDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const [goldTypes, buybacks, exchanges, handovers] = await Promise.all([
            this.prisma.goldType.findMany({
                where: { isStockType: true, deletedAt: null },
                orderBy: { sortOrder: 'asc' },
            }),
            /*
             * ອ່ານເປັນ "ແຖວລາຍການ" ບໍ່ແມ່ນ "ບິນ": ບິນດຽວມີຫຼາຍປະເພດຄຳໄດ້ ແລະ
             * ສະຫຼຸບນີ້ແຍກຕາມປະເພດຄຳ. ບິນເກົ່າກ່ອນມີຕາຕະລາງແຖວ ຖືກຍ້າຍເຂົ້າ
             * `buyback_lines` ຕອນ migrate ແລ້ວ ຈຶ່ງອ່ານບ່ອນດຽວໄດ້ໝົດ.
             */
            this.prisma.buybackLine.findMany({
                where: {
                    buyback: {
                        deletedAt: null,
                        status: 'COMPLETED',
                        createdAt: { gte: businessDate, lt: tomorrow },
                    },
                },
                select: { goldTypeId: true, weightG: true, quantity: true, payableAmount: true },
            }),
            this.prisma.goldExchange.findMany({
                where: {
                    deletedAt: null,
                    status: { in: ['APPROVED', 'COMPLETED'] },
                    createdAt: { gte: businessDate, lt: tomorrow },
                },
                select: {
                    oldLines: { select: { goldTypeId: true, weightG: true, quantity: true } },
                    newLines: { select: { weightG: true, quantity: true } },
                },
            }),
            // ມອບແລ້ວ = ສິ່ງທີ່ອອກຈາກມືຜູ້ປະເມີນເຂົ້າສາງ. ນັບແຖວທີ່ຍັງບໍ່ຖືກ
            // ປະຕິເສດ: ລໍຖ້າສາງຮັບ ກໍຖືວ່າ ຄຳບໍ່ຢູ່ກັບຜູ້ປະເມີນອີກແລ້ວ.
            this.prisma.goldHandover.findMany({
                where: {
                    deletedAt: null,
                    status: { in: ['PENDING', 'APPROVED', 'COMPLETED'] },
                    createdAt: { gte: businessDate, lt: tomorrow },
                },
                select: { goldTypeId: true, weightG: true, items: { select: { payableAmount: true } } },
            }),
        ]);
        // New-gold weight is not attributable to one ປະເພດຄຳ, so it is spread
        // across the old lines of the same exchange in proportion to their weight.
        const newWeightByType = new Map();
        for (const exchange of exchanges) {
            const oldTotal = exchange.oldLines.reduce((sum, l) => sum.plus(toDec(l.weightG).mul(l.quantity)), (0, domain_1.dec)(0));
            if (oldTotal.lte(0))
                continue;
            const newTotal = exchange.newLines.reduce((sum, l) => sum.plus(toDec(l.weightG).mul(l.quantity)), (0, domain_1.dec)(0));
            for (const line of exchange.oldLines) {
                const share = toDec(line.weightG).mul(line.quantity).div(oldTotal).mul(newTotal);
                newWeightByType.set(line.goldTypeId, (newWeightByType.get(line.goldTypeId) ?? (0, domain_1.dec)(0)).plus(share));
            }
        }
        return goldTypes.map((goldType) => {
            const rows = buybacks.filter((b) => b.goldTypeId === goldType.id);
            const receivedG = rows.reduce((sum, r) => sum.plus(toDec(r.weightG).mul(r.quantity)), (0, domain_1.dec)(0));
            const quantity = rows.reduce((sum, r) => sum + r.quantity, 0);
            const receivedPaid = rows.reduce((sum, r) => sum.plus(toDec(r.payableAmount)), (0, domain_1.dec)(0));
            const newWeightG = newWeightByType.get(goldType.id) ?? (0, domain_1.dec)(0);
            // ມອບແລ້ວ ຂອງປະເພດຄຳນີ້ — ແລະ ສຳລັບ ຄຳຕົ້ມ ຍັງຮູ້ວ່າເງິນເທົ່າໃດອອກໄປ
            // ພ້ອມກັບລາຍການນັ້ນ, ເພາະມອບເປັນລາຍການ ບໍ່ແມ່ນເປັນນ້ຳໜັກກ້ອນ.
            const mine = handovers.filter((h) => h.goldTypeId === goldType.id);
            const handedG = mine.reduce((sum, h) => sum.plus(toDec(h.weightG)), (0, domain_1.dec)(0));
            const handedPaid = mine.reduce((sum, h) => sum.plus(h.items.reduce((s, i) => s.plus(toDec(i.payableAmount)), (0, domain_1.dec)(0))), (0, domain_1.dec)(0));
            /*
             * ຄົງເຫຼືອ = ຮັບຈາກຜູ້ປະເມີນ − ມອບເຂົ້າສາງ (TOR §4.2).
             *
             * ບໍ່ປ່ອຍໃຫ້ຕິດລົບ: ການຊັ່ງຄືນຢູ່ສາງບາງຄັ້ງໄດ້ຫຼາຍກວ່າທີ່ຮັບມາໃນມື້
             * (ຄຳຕົກມາຈາກມື້ກ່ອນ) — ສະແດງ 0 ແລ້ວໃຫ້ຜູ້ໃຊ້ເຫັນທັງສອງຕົວເລກ ດີກວ່າ
             * ສະແດງຍອດຕິດລົບທີ່ອ່ານຜິດໄດ້ງ່າຍ.
             */
            const remainingG = receivedG.minus(handedG);
            const shownRemainingG = remainingG.isNegative() ? (0, domain_1.dec)(0) : remainingG;
            /*
             * ເງິນທີ່ຈ່າຍຄົງເຫຼືອ = ເງິນທີ່ຈ່າຍທັງໝົດ (ສູດໃນຊີດຂອງລູກຄ້າ: L6 = E6).
             *
             * ການມອບເຂົ້າສາງ ຍ້າຍ "ນ້ຳໜັກ" ເທົ່ານັ້ນ ບໍ່ແມ່ນ "ເງິນ" — ເງິນຈ່າຍອອກ
             * ໄປແລ້ວຕອນຮັບຊື້ຄືນ. ສະນັ້ນ ສະເລ່ຍ/g ຂອງຕາຕະລາງ 2 ຈຶ່ງສູງຂຶ້ນເມື່ອມອບ
             * ຫຼາຍ — ເປັນຕາມທີ່ລູກຄ້າຕ້ອງການ ແລະ ອະທິບາຍໄວ້ໃນກ່ອງ "ວິທີຄິດໄລ່".
             */
            const remainingPaid = receivedPaid;
            // ສູດຂອງແບບນີ້ແມ່ນ ເງິນ ÷ ນ້ຳໜັກ ກົງໆ (ບໍ່ຫັກນ້ຳໜັກຄຳໃໝ່) —
            // ສົ່ງ 0 ເປັນນ້ຳໜັກຄຳໃໝ່ ເພື່ອໃຊ້ການຈັດການ "—" ຂອງ helper ດຽວກັນ.
            const receivedAverage = (0, domain_1.goldTypeAverage)(receivedPaid, receivedG, (0, domain_1.dec)(0), true);
            const average = (0, domain_1.goldTypeAverage)(remainingPaid, shownRemainingG, (0, domain_1.dec)(0), true);
            return {
                goldTypeId: goldType.id,
                goldTypeCode: goldType.code,
                goldTypeNameLo: goldType.nameLo,
                /** ຕາຕະລາງ 1 — ຮັບມາຈາກຜູ້ປະເມີນ (ກ່ອນມອບເຂົ້າສາງ). */
                receivedG: receivedG.toFixed(),
                receivedBahtWeight: (0, domain_1.gramsToBaht)(receivedG).toFixed(),
                receivedPaid: receivedPaid.toFixed(),
                receivedAveragePerGram: receivedAverage.perGram ? receivedAverage.perGram.toFixed() : null,
                receivedAveragePerBaht: receivedAverage.perBaht ? receivedAverage.perBaht.toFixed() : null,
                /** ຕາຕະລາງ 2 — ຫຼັງສົ່ງມອບເຂົ້າສາງແລ້ວ. */
                handedG: handedG.toFixed(),
                handedPaid: handedPaid.toFixed(),
                weightG: shownRemainingG.toFixed(),
                bahtWeight: (0, domain_1.gramsToBaht)(shownRemainingG).toFixed(),
                totalPaid: remainingPaid.toFixed(),
                averagePerGram: average.perGram ? average.perGram.toFixed() : null,
                averagePerBaht: average.perBaht ? average.perBaht.toFixed() : null,
                averageMessageLo: average.messageLo,
                quantity,
                /** ນ້ຳໜັກຄຳໃໝ່ທີ່ຈ່າຍອອກໃນການປ່ຽນ — ໄວ້ໃຫ້ລາຍງານອື່ນໃຊ້. */
                newWeightG: newWeightG.toFixed(),
            };
        });
    }
    /** History ມອບຄຳ — ຄ່າເລີ່ມຕົ້ນ = ມື້ນີ້, ກວ້າງອອກໄດ້ຕາມສິດ. */
    async listHandovers(status, query, user, filters) {
        const range = this.range.resolve(query, user);
        const q = filters?.q?.trim();
        const where = {
            deletedAt: null,
            createdAt: history_range_service_1.HistoryRangeService.window(range),
            ...(status ? { status } : {}),
            ...(filters?.goldTypeId ? { goldTypeId: filters.goldTypeId } : {}),
            // ຄົ້ນຫາ: ລະຫັດການມອບ · ລະຫັດ/ຊື່ລາຍການຄຳຕົ້ມ · ຊື່ຜູ້ມອບ.
            ...(q
                ? {
                    OR: [
                        { code: { contains: q, mode: 'insensitive' } },
                        { items: { some: { buyback: { code: { contains: q, mode: 'insensitive' } } } } },
                        {
                            items: {
                                some: { buyback: { goldItem: { nameLo: { contains: q, mode: 'insensitive' } } } },
                            },
                        },
                        { shift: { user: { fullName: { contains: q, mode: 'insensitive' } } } },
                    ],
                }
                : {}),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.goldHandover.findMany({
                where,
                include: {
                    goldType: true,
                    shift: { include: { user: true } },
                    items: { include: { buyback: { select: { code: true, goldItem: { select: { nameLo: true } } } } } },
                },
                orderBy: { createdAt: 'desc' },
                skip: range.skip,
                take: range.take,
            }),
            this.prisma.goldHandover.count({ where }),
        ]);
        return this.range.page(await this.audit.withActorNames(rows), total, range);
    }
    /**
     * ລາຍການຄຳເກົ່າ (ຄຳຕົ້ມ) ທີ່ຮັບຊື້ຄືນແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ມອບເຂົ້າສາງ.
     *
     * ອ່ານຈາກການບໍ່ມີ GoldHandoverItem — ບໍ່ແມ່ນ flag ຢູ່ Buyback — ສະນັ້ນ
     * ລາຍການຈະຫຼຸດອອກຈາກລາຍການເລືອກທັນທີທີ່ມອບ ແລະ ບໍ່ມີທາງມອບສອງຄັ້ງ.
     */
    async pendingOldGoldItems(goldTypeId) {
        const rows = await this.prisma.buyback.findMany({
            where: {
                deletedAt: null,
                status: 'COMPLETED',
                handoverItem: null,
                // ບິນທີ່ "ມີແຖວ" ເປັນຄຳຕົ້ມ — ບໍ່ແມ່ນອີງແຕ່ປະເພດຂອງຫົວບິນ,
                // ເພາະບິນດຽວປະສົມຫຼາຍປະເພດໄດ້ແລ້ວ.
                ...(goldTypeId
                    ? { lines: { some: { goldTypeId } } }
                    : { lines: { some: { goldType: { code: 'BOILED' } } } }),
            },
            select: {
                id: true, code: true, weightG: true, quantity: true,
                goldPercent: true, payableAmount: true, createdAt: true,
                goldItem: { select: { nameLo: true } },
                goldType: { select: { nameLo: true } },
                customer: { select: { phone: true } },
            },
            orderBy: { createdAt: 'asc' },
            take: 500,
        });
        return rows.map((r) => ({
            ...r,
            weightG: r.weightG.toFixed(),
            goldPercent: r.goldPercent ? r.goldPercent.toFixed() : null,
            payableAmount: r.payableAmount.toFixed(),
            /** ຄືກັນກັບ `weightG` — ຫົວບິນເກັບຍອດລວມຢູ່ແລ້ວ. ເກັບຊື່ໄວ້ໃຫ້ client ເກົ່າ. */
            totalWeightG: toDec(r.weightG).toFixed(),
        }));
    }
    /* ---------------------------------------------------------------- *
     * Helpers
     * ---------------------------------------------------------------- */
    /** Ready to Gold counts: Balance = ຕັ້ງຕົ້ນ + IN − OUT (§7.1). */
    async refreshSkuBalances(tx, businessDayId, lines, direction) {
        for (const line of lines) {
            if (!line.goldSkuId)
                continue;
            const key = { businessDayId_goldSkuId: { businessDayId, goldSkuId: line.goldSkuId } };
            const existing = await tx.stockNewSkuBalance.findUnique({ where: key });
            const openingQty = existing?.openingQty ?? 0;
            const inQty = (existing?.inQty ?? 0) + (direction === 'IN' ? line.quantity : 0);
            const outQty = (existing?.outQty ?? 0) + (direction === 'OUT' ? line.quantity : 0);
            const balanceQty = openingQty + inQty - outQty;
            const data = {
                inQty,
                outQty,
                balanceQty,
                totalWeightG: D((0, domain_1.dec)(line.weightG).mul(balanceQty)),
            };
            await tx.stockNewSkuBalance.upsert({
                where: key,
                update: data,
                create: { businessDayId, goldSkuId: line.goldSkuId, ...data },
            });
        }
    }
    async nextCode(client, kind) {
        const now = new Date();
        const prefix = `${kind}-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const count = kind === 'HO'
            ? await client.goldHandover.count({ where: { code: { startsWith: prefix } } })
            : await client.stockMovement.count({ where: { code: { startsWith: prefix } } });
        return `${prefix}-${String(count + 1).padStart(3, '0')}`;
    }
};
exports.StockService = StockService;
exports.StockService = StockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        approval_service_1.ApprovalService,
        business_day_service_1.BusinessDayService,
        stock_ledger_service_1.StockLedgerService,
        apar_posting_service_1.ApArPostingService,
        notifications_service_1.NotificationsService,
        history_range_service_1.HistoryRangeService])
], StockService);
//# sourceMappingURL=stock.service.js.map