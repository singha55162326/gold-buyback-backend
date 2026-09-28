import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildPriceBoard,
  dec,
  TIER_META,
  type DeductionRule,
  type PriceBoard,
} from '@kpv/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import type { SetPricingDto } from './dto/set-pricing.dto';

/** Serialise a domain price board into the shape the web client renders. */
function presentBoard(board: PriceBoard) {
  return {
    price1Baht: board.price1Baht.toFixed(),
    lines: board.lines.map((line) => {
      const meta = TIER_META[line.tier as keyof typeof TIER_META];
      return {
        tierCode: line.tier,
        labelLo: meta?.labelLo ?? line.tier,
        category: meta?.category ?? null,
        displayWeightG: meta?.displayWeightG.toFixed() ?? null,
        exchangeWeightG: meta?.exchangeWeightG.toFixed() ?? null,
        sellPrice: line.sellPrice.toFixed(),
        buybackPrice: line.buybackPrice.toFixed(),
        steps: line.steps
          ? {
              a: line.steps.a.toFixed(),
              b: line.steps.b.toFixed(),
              c: line.steps.c.toFixed(),
              d: line.steps.d.toFixed(),
            }
          : null,
      };
    }),
  };
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Load the current §3.2 deduction rules — the newest row per tier.
   * Passing them into the engine is what makes ຫັກອອກ (%) tunable without
   * a code change.
   */
  private async currentDeductions(): Promise<Record<string, DeductionRule>> {
    const rules = await this.prisma.buybackDeductionRule.findMany({
      orderBy: { effectiveAt: 'desc' },
    });
    const latest: Record<string, DeductionRule> = {};
    for (const rule of rules) {
      if (latest[rule.tierCode]) continue; // newest wins
      latest[rule.tierCode] = { kind: rule.kind, value: rule.value.toFixed() };
    }
    return latest;
  }

  private parsePrice(raw: string) {
    const value = dec(raw);
    if (!value.isFinite() || value.lte(0)) {
      throw new BadRequestException('ລາຄາຂາຍ 1 ບາດ ຕ້ອງໃຫຍ່ກວ່າ 0');
    }
    return value;
  }

  /**
   * Compute the full 11-row board WITHOUT saving. Backs the live preview on
   * the Set Pricing screen so the owner sees exactly what will be stored.
   */
  async preview(price1Baht: string) {
    const value = this.parsePrice(price1Baht);
    const deductions = await this.currentDeductions();
    return presentBoard(buildPriceBoard(value, { deductions }));
  }

  /** The current price board — the newest snapshot. */
  async current() {
    const snapshot = await this.prisma.priceSnapshot.findFirst({
      orderBy: { effectiveAt: 'desc' },
      include: { lines: { include: { tier: true } } },
    });
    if (!snapshot) throw new NotFoundException('ຍັງບໍ່ມີການຕັ້ງລາຄາ');

    return {
      id: snapshot.id,
      price1Baht: snapshot.price1Baht.toFixed(),
      effectiveAt: snapshot.effectiveAt,
      lines: snapshot.lines
        .sort((a, b) => a.tier.sortOrder - b.tier.sortOrder)
        .map((line) => ({
          tierCode: line.tierCode,
          labelLo: line.tier.labelLo,
          category: line.tier.category,
          displayWeightG: line.tier.displayWeightG.toFixed(),
          exchangeWeightG: line.tier.exchangeWeightG.toFixed(),
          sellPrice: line.sellPrice.toFixed(),
          buybackPrice: line.buybackPrice.toFixed(),
          steps: line.steps,
        })),
    };
  }

  /**
   * TOR §3.1 "Set Pricing".
   *
   * The board is recomputed server-side rather than trusting the numbers the
   * browser previewed, then written as a NEW snapshot. Snapshots are never
   * updated in place, so a transaction priced yesterday keeps yesterday's
   * numbers forever.
   */
  async setPricing(dto: SetPricingDto, actorId: string) {
    const price1Baht = this.parsePrice(dto.price1Baht);
    const deductions = await this.currentDeductions();
    const board = buildPriceBoard(price1Baht, { deductions });

    const snapshot = await this.prisma.$transaction(async (tx) => {
      const created = await tx.priceSnapshot.create({
        data: {
          price1Baht: new Prisma.Decimal(board.price1Baht.toFixed()),
          note: dto.note ?? null,
          createdById: actorId,
          lines: {
            create: board.lines.map((line) => ({
              tierCode: line.tier,
              sellPrice: new Prisma.Decimal(line.sellPrice.toFixed()),
              buybackPrice: new Prisma.Decimal(line.buybackPrice.toFixed()),
              steps: line.steps
                ? {
                    a: line.steps.a.toFixed(),
                    b: line.steps.b.toFixed(),
                    c: line.steps.c.toFixed(),
                    d: line.steps.d.toFixed(),
                  }
                : Prisma.JsonNull,
            })),
          },
        },
        include: { lines: true },
      });

      await this.audit.record(
        {
          actorId,
          action: 'CREATE',
          entity: 'PriceSnapshot',
          entityId: created.id,
          after: { price1Baht: created.price1Baht.toFixed() },
          summary: `ຕັ້ງລາຄາຂາຍ 1 ບາດ = ${created.price1Baht.toFixed(0)}`,
        },
        tx,
      );

      return created;
    });

    return { id: snapshot.id, ...presentBoard(board) };
  }

  /** History Products — TOR §3.1 specifies 30 rows. */
  async history(limit = 30) {
    const rows = await this.prisma.priceSnapshot.findMany({
      orderBy: { effectiveAt: 'desc' },
      take: Math.min(limit, 200),
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));

    return rows.map((row) => ({
      id: row.id,
      date: row.effectiveAt,
      price1Baht: row.price1Baht.toFixed(),
      updatedBy: nameById.get(row.createdById) ?? '—',
      note: row.note,
    }));
  }
}
