/**
 * Cross-checks the price board stored in the database against the printed
 * table in TOR §3.1, and exits non-zero on any mismatch.
 *
 * The golden unit tests prove the *engine* is right. This proves the engine's
 * output actually reached the *database* intact through Prisma's Decimal
 * mapping — a separate failure mode, and the one that would silently mis-price
 * every transaction in production.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { TIER_META, TierCode } from '@kpv/domain';
// DATABASE_URL lives in the ROOT .env so the Prisma CLI and the API can never
// drift onto different databases. `__dirname` is not defined in ESM, so it is
// derived from import.meta.url.
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
});

const prisma = new PrismaClient();

/** The TOR §3.1 product table, transcribed verbatim. */
const TOR_TABLE: Array<{ tier: string; sell: string; buyback: string }> = [
  { tier: TierCode.JW_BAHT_1, sell: '45859000', buyback: '44667000' },
  { tier: TierCode.JW_SALEUNG_2, sell: '22938000', buyback: '22296000' },
  { tier: TierCode.JW_SALEUNG_1, sell: '11469000', buyback: '11148000' },
  { tier: TierCode.JW_HUN_5, sell: '5739000', buyback: '5530000' },
  { tier: TierCode.JW_HUN_3, sell: '3479000', buyback: '3270000' },
  { tier: TierCode.JW_HUN_2, sell: '2329000', buyback: '2120000' },
  { tier: TierCode.JW_HUN_1, sell: '1194000', buyback: '985000' },
  { tier: TierCode.BAR_BAHT_1, sell: '45750000', buyback: '45220000' },
  { tier: TierCode.BAR_SALEUNG_2, sell: '22875000', buyback: '22610000' },
  { tier: TierCode.BAR_SALEUNG_1, sell: '11437500', buyback: '11305000' },
  { tier: TierCode.BAR_GRAM_1, sell: '3170000', buyback: '3014000' },
];

const money = (v: string) => Number(v).toLocaleString('en-US').padStart(14);

async function main() {
  const snapshot = await prisma.priceSnapshot.findFirst({
    orderBy: { effectiveAt: 'desc' },
    include: { lines: true },
  });

  if (!snapshot) {
    console.error('No PriceSnapshot found. Run `npm run db:seed` first.');
    process.exit(1);
  }

  if (!snapshot.price1Baht.equals('45859000')) {
    console.log(
      `Latest snapshot is ${snapshot.price1Baht.toFixed(0)} LAK, not the TOR sample ` +
        '45,859,000 — skipping the table comparison (this is expected once the shop ' +
        'sets its own daily price).',
    );
    process.exit(0);
  }

  const lines = new Map(snapshot.lines.map((l) => [l.tierCode, l]));

  console.log('\nຕາຕະລາງລາຄາ — database vs TOR §3.1\n');
  console.log(
    'ໝວດ / ລາຍການ'.padEnd(24) +
      'ລາຄາຂາຍ (DB)'.padStart(15) +
      'ລາຄາຂາຍ (TOR)'.padStart(15) +
      'ຊື້ຄືນ (DB)'.padStart(15) +
      'ຊື້ຄືນ (TOR)'.padStart(15) +
      '   ',
  );
  console.log('-'.repeat(90));

  let mismatches = 0;

  for (const row of TOR_TABLE) {
    const line = lines.get(row.tier);
    const meta = TIER_META[row.tier as keyof typeof TIER_META];

    if (!line) {
      console.log(`${meta.labelLo.padEnd(24)}${'MISSING'.padStart(60)}   FAIL`);
      mismatches += 1;
      continue;
    }

    const sellOk = line.sellPrice.equals(row.sell);
    const buybackOk = line.buybackPrice.equals(row.buyback);
    if (!sellOk || !buybackOk) mismatches += 1;

    console.log(
      meta.labelLo.padEnd(24) +
        money(line.sellPrice.toFixed(0)) +
        money(row.sell) +
        money(line.buybackPrice.toFixed(0)) +
        money(row.buyback) +
        (sellOk && buybackOk ? '   OK' : '   FAIL'),
    );
  }

  console.log('-'.repeat(90));

  if (mismatches > 0) {
    console.error(`\n${mismatches} row(s) do not match the TOR table.\n`);
    process.exit(1);
  }

  console.log(`\nAll ${TOR_TABLE.length} rows match the TOR §3.1 table.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
