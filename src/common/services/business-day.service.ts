import { Injectable } from '@nestjs/common';
import { Prisma, type BusinessDay } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The business day is the spine of the whole system: it anchors every
 * "ມື້ໃໝ່ Balance ກາຍເປັນ ຈຳນວນຕັ້ງຕົ້ນ" rule (§7.1, §7.2) and the AP/AR
 * rollover of §9.2. Nothing should derive "today" on its own — everything
 * asks this service, so a single definition of the day governs the system.
 */
@Injectable()
export class BusinessDayService {
  constructor(private readonly prisma: PrismaService) {}

  /** Midnight of the given instant, in the server's local timezone. */
  static toDateOnly(at: Date = new Date()): Date {
    // Local time on purpose: a business day is the shop's day, and the shop
    // is in Vientiane. That makes the server's TZ a financial setting — on a
    // UTC host the day would roll at 07:00 Lao time, mid-morning, splitting a
    // single trading day across two BusinessDay rows. `assertShopTimezone`
    // below is what stops that shipping unnoticed.
    return new Date(at.getFullYear(), at.getMonth(), at.getDate());
  }

  /**
   * Returns today's BusinessDay, creating it on first use of the day.
   *
   * Concurrency matters here more than it looks. The first requests of a new
   * day arrive together — staff opening shifts at 8am, a dashboard polling —
   * and they all find no row and all try to create one. Prisma's `upsert` is
   * a read-then-write, not an atomic statement, so the losers of that race
   * got a P2002 unique-constraint error and a 500.
   *
   * The recovery is to treat P2002 as success: another request created the
   * row a moment ago, which is exactly the outcome we wanted, so re-read it.
   *
   * NOTE: callers must invoke this OUTSIDE a transaction. A constraint
   * violation aborts the surrounding transaction in Postgres, so the re-read
   * below could not run. Every current call site already resolves the day
   * before opening its `$transaction`.
   */
  async current(tx?: Prisma.TransactionClient): Promise<BusinessDay> {
    const client = tx ?? this.prisma;
    const date = BusinessDayService.toDateOnly();

    const existing = await client.businessDay.findUnique({ where: { date } });
    if (existing) return existing;

    try {
      return await client.businessDay.create({ data: { date } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Lost the race — the row exists now, which is what we wanted.
        return client.businessDay.findUniqueOrThrow({ where: { date } });
      }
      throw error;
    }
  }

  async findByDate(date: Date): Promise<BusinessDay | null> {
    return this.prisma.businessDay.findUnique({
      where: { date: BusinessDayService.toDateOnly(date) },
    });
  }
}
