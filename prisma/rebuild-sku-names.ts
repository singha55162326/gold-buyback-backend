/**
 * Rebuild every SKU's `fullSkuName` in the new format.
 *
 *   npm run rebuild-sku-names -w @kpv/api
 *
 * The name is derived, not entered, so the only way to change its format is
 * to re-derive it for the rows that already exist. Safe to re-run: it writes
 * only the rows whose stored name differs from what the current rule
 * produces, and reports what it changed before changing it.
 *
 * Pass --dry to see the diff without writing.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { dec, trimTrailingZeros, GRAMS_PER_BAHT } from '@kpv/domain';

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
});

const prisma = new PrismaClient();
const dry = process.argv.includes('--dry');

/** Must stay in step with SkusService.buildFullSkuName. */
function buildFullSkuName(nameLo: string, weightG: string): string {
  const w = dec(weightG);
  const baht = trimTrailingZeros(w.div(GRAMS_PER_BAHT).toDecimalPlaces(2).toFixed());
  return `${nameLo.trim()} ${baht} ບາດ (${w.toDecimalPlaces(3).toFixed(3)} g)`;
}

async function main() {
  const skus = await prisma.goldSku.findMany({
    select: { id: true, nameLo: true, weightG: true, fullSkuName: true },
    orderBy: { createdAt: 'asc' },
  });

  const changes = skus
    .map((s) => ({ ...s, next: buildFullSkuName(s.nameLo, s.weightG.toFixed()) }))
    .filter((s) => s.next !== s.fullSkuName);

  console.log(`\n  SKU ທັງໝົດ ${skus.length} · ຕ້ອງປັບ ${changes.length}\n`);
  for (const c of changes) {
    console.log(`    ${c.fullSkuName}`);
    console.log(`  → ${c.next}\n`);
  }

  if (changes.length === 0) {
    console.log('  ບໍ່ມີຫຍັງຕ້ອງປັບ.\n');
    return;
  }
  if (dry) {
    console.log('  --dry: ບໍ່ໄດ້ຂຽນຫຍັງ.\n');
    return;
  }

  for (const c of changes) {
    await prisma.goldSku.update({ where: { id: c.id }, data: { fullSkuName: c.next } });
  }
  console.log(`  ປັບແລ້ວ ${changes.length} ແຖວ.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
