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
var SystemService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const whatsapp_service_1 = require("../notifications/whatsapp.service");
/**
 * "Is the shop ready to open?" in one call.
 *
 * Every piece of setup this system needs is invisible until it silently fails
 * at the counter — an unset price board, an empty exchange rate, a WhatsApp
 * session that quietly scanned out. This gathers them into one list an Admin
 * can read in five seconds, each with the screen that fixes it.
 */
let SystemService = SystemService_1 = class SystemService {
    prisma;
    whatsapp;
    logger = new common_1.Logger(SystemService_1.name);
    constructor(prisma, whatsapp) {
        this.prisma = prisma;
        this.whatsapp = whatsapp;
    }
    /** Liveness + database reachability. Public: used by scripts and monitors. */
    async health() {
        let database = false;
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            database = true;
        }
        catch (error) {
            this.logger.warn(`health: database unreachable — ${String(error)}`);
        }
        return {
            status: database ? 'ok' : 'degraded',
            database,
            uptimeS: Math.round(process.uptime()),
        };
    }
    async readiness() {
        const checks = [];
        /* ---- Database ---- */
        const health = await this.health();
        checks.push({
            key: 'database',
            labelLo: 'ຖານຂໍ້ມູນ',
            level: health.database ? 'ok' : 'blocked',
            detailLo: health.database ? 'ເຊື່ອມຕໍ່ໄດ້' : 'ຕິດຕໍ່ຖານຂໍ້ມູນບໍ່ໄດ້',
            actionLo: health.database ? null : 'ກວດ DATABASE_URL ແລະ ເບິ່ງວ່າ PostgreSQL ແລ່ນຢູ່ບໍ່',
            href: null,
        });
        // Nothing else can be trusted without the database.
        if (!health.database) {
            return { level: 'blocked', checks, checkedAt: new Date().toISOString() };
        }
        /* ---- Price board (TOR §3.1) — without it nothing can be sold ---- */
        // Append-only by design (TOR §3.1 history), so there is no deletedAt to
        // filter — the newest row simply is the current board.
        const board = await this.prisma.priceSnapshot.findFirst({
            orderBy: { effectiveAt: 'desc' },
            include: { _count: { select: { lines: true } } },
        });
        checks.push({
            key: 'pricing',
            labelLo: 'ຕາຕະລາງລາຄາຄຳ (§3.1)',
            level: board ? 'ok' : 'blocked',
            detailLo: board
                ? `ຕັ້ງລ່າສຸດ ${formatLaoDateTime(board.effectiveAt)} — ${board._count.lines} ແຖວ`
                : 'ຍັງບໍ່ໄດ້ຕັ້ງລາຄາ 1 ບາດ',
            actionLo: board ? null : 'ໄປຕັ້ງລາຄາຂາຍ 1 ບາດ ເພື່ອສ້າງຕາຕະລາງ',
            href: '/admin/products',
        });
        /* ---- Exchange rates (TOR §3.3) ---- */
        const rate = await this.prisma.exchangeRateSnapshot.findFirst({
            orderBy: { effectiveAt: 'desc' },
        });
        checks.push({
            key: 'rates',
            labelLo: 'ອັດຕາແລກປ່ຽນ (§3.3)',
            level: rate ? 'ok' : 'blocked',
            detailLo: rate
                ? `ຕັ້ງລ່າສຸດ ${formatLaoDateTime(rate.effectiveAt)}`
                : 'ຍັງບໍ່ໄດ້ຕັ້ງອັດຕາ THB / USD',
            actionLo: rate ? null : 'ໄປຕັ້ງອັດຕາແລກປ່ຽນ',
            href: '/admin/rates',
        });
        /* ---- Gold catalogue — a sale needs something to sell ---- */
        const [goldTypes, skus] = await Promise.all([
            this.prisma.goldType.count({ where: { deletedAt: null, isActive: true } }),
            this.prisma.goldSku.count({ where: { deletedAt: null, isActive: true } }),
        ]);
        checks.push({
            key: 'catalog',
            labelLo: 'ປະເພດຄຳ ແລະ SKU (§3.5–3.6)',
            level: goldTypes > 0 && skus > 0 ? 'ok' : 'warn',
            detailLo: `ປະເພດຄຳ ${goldTypes} ລາຍການ · SKU ${skus} ລາຍການ`,
            actionLo: goldTypes > 0 && skus > 0 ? null : 'ເພີ່ມປະເພດຄຳ ແລະ SKU ກ່ອນເປີດຂາຍ',
            href: '/admin/skus',
        });
        /* ---- Bank accounts — needed the moment a transfer is taken ---- */
        const banks = await this.prisma.bankAccount.count({ where: { isActive: true } });
        checks.push({
            key: 'banks',
            labelLo: 'ບັນຊີທະນາຄານ',
            level: banks > 0 ? 'ok' : 'warn',
            detailLo: banks > 0 ? `${banks} ບັນຊີ` : 'ຍັງບໍ່ມີບັນຊີທະນາຄານ',
            actionLo: banks > 0 ? null : 'ເພີ່ມບັນຊີ ເພື່ອຮັບເງິນໂອນໄດ້',
            href: '/admin/banks',
        });
        /* ---- Staff accounts ---- */
        const activeUsers = await this.prisma.user.count({ where: { isActive: true, deletedAt: null } });
        checks.push({
            key: 'users',
            labelLo: 'ຜູ້ໃຊ້ທີ່ໃຊ້ງານໄດ້',
            level: activeUsers > 1 ? 'ok' : 'warn',
            detailLo: `${activeUsers} ບັນຊີ`,
            actionLo: activeUsers > 1 ? null : 'ສ້າງບັນຊີໃຫ້ພະນັກງານແຕ່ລະໜ້າທີ່',
            href: '/admin/users',
        });
        /* ---- WhatsApp channel (TOR §10) ---- */
        await this.addWhatsAppChecks(checks);
        // The worst single check decides the whole.
        const level = checks.some((c) => c.level === 'blocked')
            ? 'blocked'
            : checks.some((c) => c.level === 'warn')
                ? 'warn'
                : 'ok';
        return { level, checks, checkedAt: new Date().toISOString() };
    }
    /**
     * WhatsApp is optional, so nothing here ever blocks. But a half-configured
     * channel is worse than none — it looks connected and drops every message —
     * so each failure mode gets its own line and its own fix.
     */
    async addWhatsAppChecks(checks) {
        const status = await this.whatsapp.status();
        if (!status.enabled) {
            checks.push({
                key: 'whatsapp',
                labelLo: 'ແຈ້ງເຕືອນ WhatsApp (§10)',
                level: 'ok',
                detailLo: 'ປິດໄວ້ — ໃຊ້ກະດິ່ງໃນລະບົບຢ່າງດຽວ',
                actionLo: null,
                href: '/admin/notifications',
            });
            return;
        }
        checks.push({
            key: 'whatsapp',
            labelLo: 'ແຈ້ງເຕືອນ WhatsApp (§10)',
            level: status.live ? 'ok' : 'warn',
            detailLo: status.detail ?? 'ບໍ່ຮູ້ສະຖານະ',
            actionLo: status.live ? null : 'ໄປແກ້ໄຂການເຊື່ອມຕໍ່ gateway',
            href: '/admin/notifications',
        });
        // Enabled and linked, but nobody to send to — the silent failure this
        // whole panel exists to prevent.
        const [staff, withNumber] = await Promise.all([
            this.prisma.user.count({ where: { isActive: true, deletedAt: null } }),
            this.prisma.user.count({
                where: {
                    isActive: true,
                    deletedAt: null,
                    OR: [
                        { whatsappNumber: { not: null } },
                        { phone: { not: null } },
                    ],
                },
            }),
        ]);
        checks.push({
            key: 'whatsapp-recipients',
            labelLo: 'ເບີ WhatsApp ຂອງພະນັກງານ',
            level: withNumber > 0 ? 'ok' : 'warn',
            detailLo: withNumber > 0
                ? `${withNumber}/${staff} ຄົນມີເບີ`
                : `ຍັງບໍ່ມີໃຜມີເບີ (${staff} ຄົນ) — ຂໍ້ຄວາມຈະບໍ່ໄປຫາໃຜ`,
            actionLo: withNumber > 0 ? null : 'ໃສ່ເບີ WhatsApp ໃຫ້ພະນັກງານ',
            href: '/admin/users',
        });
    }
};
exports.SystemService = SystemService;
exports.SystemService = SystemService = SystemService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        whatsapp_service_1.WhatsAppService])
], SystemService);
/** dd/MM/yyyy HH:mm — the form used across the Lao UI. */
function formatLaoDateTime(value) {
    const pad = (n) => String(n).padStart(2, '0');
    return (`${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} ` +
        `${pad(value.getHours())}:${pad(value.getMinutes())}`);
}
//# sourceMappingURL=system.service.js.map