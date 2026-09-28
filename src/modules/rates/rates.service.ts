import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dec, round, RATE_DECIMALS } from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import type { UpdateRatesDto } from './dto/rate.dto';

/**
 * TOR §3.3 — Price Rate (ອັດຕາແລກປ່ຽນ).
 *
 * Sell rates apply when the shop TAKES foreign currency IN (Order, Credit);
 * buyback rates apply when it PAYS foreign currency OUT (Buyback, Exchange).
 * Snapshots are append-only so every transaction can point at the rate that
 * was live when it happened.
 */
@Injectable()
export class RatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async current() {
    const snapshot = await this.prisma.exchangeRateSnapshot.findFirst({
      orderBy: { effectiveAt: 'desc' },
    });
    if (!snapshot) throw new NotFoundException('ຍັງບໍ່ມີການຕັ້ງອັດຕາແລກປ່ຽນ');
    return snapshot;
  }

  async update(dto: UpdateRatesDto, actorId: string) {
    /*
     * TOR §3.3 — THB and USD rates are quoted to two decimals. Quantising on
     * the way in keeps the stored figure identical to the one on screen: a
     * third decimal accepted here would be invisible in every report yet still
     * move the LAK conversions in Wealth and COH.
     */
    const toRate = (raw: string) => round(dec(raw), RATE_DECIMALS);

    const values = {
      thbSellRate: toRate(dto.thbSellRate),
      usdSellRate: toRate(dto.usdSellRate),
      thbBuybackRate: toRate(dto.thbBuybackRate),
      usdBuybackRate: toRate(dto.usdBuybackRate),
    };

    for (const [key, value] of Object.entries(values)) {
      if (!value.isFinite() || value.lte(0)) {
        throw new BadRequestException(`${key} ຕ້ອງໃຫຍ່ກວ່າ 0`);
      }
    }

    const created = await this.prisma.exchangeRateSnapshot.create({
      data: {
        thbSellRate: new Prisma.Decimal(values.thbSellRate.toFixed()),
        usdSellRate: new Prisma.Decimal(values.usdSellRate.toFixed()),
        thbBuybackRate: new Prisma.Decimal(values.thbBuybackRate.toFixed()),
        usdBuybackRate: new Prisma.Decimal(values.usdBuybackRate.toFixed()),
        createdById: actorId,
      },
    });

    await this.audit.record({
      actorId,
      action: 'CREATE',
      entity: 'ExchangeRateSnapshot',
      entityId: created.id,
      after: created,
      summary: 'ອັບເດດ Price Rate',
    });

    return created;
  }

  /** History Price Rate Table — 30 rows (TOR §3.3). */
  async history(limit = 30) {
    const rows = await this.prisma.exchangeRateSnapshot.findMany({
      orderBy: { effectiveAt: 'desc' },
      take: Math.min(limit, 200),
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    return rows.map((row) => ({ ...row, updatedBy: nameById.get(row.createdById) ?? '—' }));
  }

  /**
   * Monthly series for the two history charts in §3.3. Each month reports the
   * last rate set in that month, which is what the shop treats as that month's
   * closing rate.
   */
  async monthlySeries(months = 12) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const rows = await this.prisma.exchangeRateSnapshot.findMany({
      where: { effectiveAt: { gte: since } },
      orderBy: { effectiveAt: 'asc' },
    });

    const byMonth = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = `${row.effectiveAt.getFullYear()}-${String(row.effectiveAt.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, row); // later rows overwrite, leaving the month's last
    }

    return [...byMonth.entries()].map(([month, row]) => ({
      month,
      thbSell: row.thbSellRate.toFixed(),
      thbBuyback: row.thbBuybackRate.toFixed(),
      usdSell: row.usdSellRate.toFixed(),
      usdBuyback: row.usdBuybackRate.toFixed(),
    }));
  }
}
