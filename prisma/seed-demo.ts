/**
 * ຂໍ້ມູນຕົວຢ່າງ ສຳລັບ ແຫຼ່ງຮັບເຂົ້າ / ແຫຼ່ງສົ່ງອອກ (TOR §7.1, §7.2, §8).
 *
 *   npm run db:seed:demo            # ສ້າງຂໍ້ມູນຕົວຢ່າງ
 *   npm run db:seed:demo -- --clean # ລຶບສະເພາະຂໍ້ມູນຕົວຢ່າງ
 *
 * `prisma/seed.ts` ສ້າງ **ແຖວອ້າງອີງ** — ແຫຼ່ງທັງ 8 ມີຢູ່ແລ້ວແຕ່ບໍ່ມີທຸລະກຳ
 * ໃດອ້າງເຖິງມັນ ຈຶ່ງເປີດໜ້າ ສາງຄຳ / AP-AR (GOLD) / ຕິດຕາມ FACTORY ມາແລ້ວ
 * ຫວ່າງເປົ່າ. ອັນນີ້ເຕີມ **ການເຄື່ອນໄຫວ** ໃຫ້ແຕ່ລະແຫຼ່ງ ເພື່ອໃຫ້ເຫັນວ່າແຕ່ລະ
 * ແຖວຖືກໃຊ້ແນວໃດ.
 *
 * ເປັນຫຍັງຈຶ່ງຍິງຜ່ານ API ແທນທີ່ຈະຂຽນລົງຖານຂໍ້ມູນໂດຍກົງຄື `seed.ts`:
 * ທຸລະກຳສາງພາໃຫ້ເກີດ ledger, ຍອດຄົງຄ້າງ, ການລົງບັນຊີ AP-AR (GOLD) ແລະ
 * ສາຍອະນຸມັດ — ມັນຢູ່ໃນ service. ຂຽນລົງຕາຕະລາງເອງຈະໄດ້ຂໍ້ມູນທີ່ "ມີແຖວ"
 * ແຕ່ຍອດບໍ່ກົງ ເຊິ່ງຮ້າຍກວ່າບໍ່ມີຂໍ້ມູນເລີຍ. ຍິງຜ່ານ API = ເສັ້ນທາງດຽວກັນ
 * ກັບທີ່ພະນັກງານໃຊ້ ຈຶ່ງຖືກຕ້ອງໂດຍໂຄງສ້າງ.
 *
 * ລະຫັດຜ່ານ **ບໍ່ເຄີຍ** ມາຈາກ argv (ເຫັນໄດ້ຜ່ານ `ps` ແລະ ຄ້າງຢູ່ shell
 * history) — ອ່ານຈາກ prompt ທີ່ບໍ່ສະແດງຕົວອັກສອນ ຫຼື ຈາກ KPV_DEMO_PASSWORD.
 *
 * ຂໍ້ມູນທີ່ສ້າງທັງໝົດຕິດປ້າຍ DEMO_TAG ໄວ້ທີ່ ໝາຍເຫດ ຈຶ່ງລຶບຄືນໄດ້ຄົບ.
 */
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
});

const prisma = new PrismaClient();

/** ປ້າຍທີ່ຕິດໄວ້ກັບທຸກແຖວ ເພື່ອໃຫ້ `--clean` ຮູ້ວ່າອັນໃດເປັນຂອງຕົວຢ່າງ. */
const DEMO_TAG = '[DEMO]';

const API = (process.env.DEMO_API_URL ?? 'http://127.0.0.1:4000').replace(/\/+$/, '') + '/api';
const USERNAME = process.env.DEMO_USERNAME ?? 'admin';

const clean = process.argv.includes('--clean');
const assumeYes = process.argv.includes('--yes') || process.argv.includes('-y');

/* ------------------------------------------------------------------ *
 * ດ່ານຄວາມປອດໄພ
 * ------------------------------------------------------------------ */

/**
 * ຂໍ້ມູນຕົວຢ່າງບໍ່ຄວນລົງຖານຂໍ້ມູນຈິງ.
 *
 * ມັນສ້າງທຸລະກຳທີ່ຂຶ້ນບັນຊີ ແລະ ກະທົບຍອດສາງ — ຖ້າແລ່ນຜິດເຄື່ອງ ການແກ້ຄືນ
 * ບໍ່ແມ່ນແຕ່ລຶບແຖວ. ສະນັ້ນ host ທີ່ບໍ່ແມ່ນເຄື່ອງນີ້ ຕ້ອງຢືນຢັນເອງ.
 */
function assertSafeTarget(): void {
  const host = new URL(API).hostname;
  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  if (isLocal || assumeYes) return;

  console.error(
    `\n⚠ DEMO_API_URL ຊີ້ໄປທີ່ "${host}" ເຊິ່ງບໍ່ແມ່ນເຄື່ອງນີ້.\n` +
      '  ຂໍ້ມູນຕົວຢ່າງສ້າງທຸລະກຳທີ່ຂຶ້ນບັນຊີ ແລະ ກະທົບຍອດສາງ.\n' +
      '  ຖ້າຕັ້ງໃຈແທ້ ໃຫ້ເພີ່ມ --yes.\n',
  );
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * ລະຫັດຜ່ານ
 * ------------------------------------------------------------------ */

/** ຖາມລະຫັດຜ່ານໂດຍບໍ່ສະແດງຕົວອັກສອນ (Node ບໍ່ມີ built-in). */
function askHidden(question: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY) {
    console.error('ບໍ່ມີ tty — ຕັ້ງ KPV_DEMO_PASSWORD ແທນ');
    process.exit(1);
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output: process.stdout, terminal: true });
    const onData = (char: Buffer) => {
      // ປິດການສະທ້ອນ: ຂຽນທັບດ້ວຍຄຳຖາມເດີມທຸກປຸ່ມທີ່ກົດ.
      const c = char.toString();
      if (c === '\n' || c === '\r' || c === '\u0004') return;
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(question);
    };
    input.on('data', onData);
    rl.question(question, (answer) => {
      input.off('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function password(): Promise<string> {
  const fromEnv = process.env.KPV_DEMO_PASSWORD;
  if (fromEnv) return fromEnv;
  return askHidden(`ລະຫັດຜ່ານຂອງ ${USERNAME}: `);
}

/* ------------------------------------------------------------------ *
 * ລູກຄ້າ API
 * ------------------------------------------------------------------ */

let token = '';

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json: unknown = await res.json().catch(() => null);
  if (res.status >= 400) {
    const message =
      (json as { message?: unknown } | null)?.message ?? `HTTP ${res.status}`;
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(message)}`);
  }
  return json as Record<string, never> & { id: string; code: string };
}

async function login(): Promise<void> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: await password() }),
  });
  if (!res.ok) {
    console.error(`\nເຂົ້າສູ່ລະບົບບໍ່ໄດ້ (${res.status}) — ກວດ username / ລະຫັດຜ່ານ\n`);
    process.exit(1);
  }
  token = ((await res.json()) as { accessToken: string }).accessToken;
}

/* ------------------------------------------------------------------ *
 * ລຶບຂໍ້ມູນຕົວຢ່າງ
 * ------------------------------------------------------------------ */

async function removeDemo(): Promise<void> {
  const movements = await prisma.stockMovement.findMany({
    where: { note: { contains: DEMO_TAG } },
    select: { id: true },
  });
  const ids = movements.map((m) => m.id);
  if (ids.length === 0) {
    console.log('ບໍ່ມີຂໍ້ມູນຕົວຢ່າງໃຫ້ລຶບ');
    return;
  }

  /*
   * ມື້ທີ່ຂໍ້ມູນຕົວຢ່າງແຕະ. `StockMovement` ບໍ່ມີຖັນມື້ບັນຊີ — ມັນຢູ່ທີ່ ledger
   * ເປັນ `businessDate` (ຖັນ DATE) ສ່ວນຍອດຄົງຄ້າງຖືກ key ດ້ວຍ `businessDayId`
   * ຈຶ່ງຕ້ອງເກັບວັນທີໄວ້ກ່ອນລຶບ ແລ້ວຈຶ່ງແປເປັນ BusinessDay ພາຍຫຼັງ.
   */
  const ledgerDays = [
    ...(await prisma.stockOldLedger.findMany({
      where: { movementId: { in: ids } },
      select: { businessDate: true },
    })),
    ...(await prisma.stockNewLedger.findMany({
      where: { movementId: { in: ids } },
      select: { businessDate: true },
    })),
  ];
  const dates = [...new Map(ledgerDays.map((r) => [r.businessDate.getTime(), r.businessDate])).values()];

  /*
   * ລຽງຕາມລູກກ່ອນພໍ່: ledger ແລະ ແຖວຕິດຕາມອ້າງເຖິງ movement ດ້ວຍ FK ແລະ
   * ການລຶບບໍ່ໄດ້ຕັ້ງ cascade ໄວ້ທຸກບ່ອນ.
   */
  await prisma.factoryOutTracking.deleteMany({ where: { movementId: { in: ids } } });
  await prisma.goldApArLedger.deleteMany({ where: { movementId: { in: ids } } });
  await prisma.stockOldLedger.deleteMany({ where: { movementId: { in: ids } } });
  await prisma.stockNewLedger.deleteMany({ where: { movementId: { in: ids } } });
  await prisma.stockMovementLine.deleteMany({ where: { movementId: { in: ids } } });
  await prisma.stockMovement.deleteMany({ where: { id: { in: ids } } });

  /*
   * ຍອດຄົງຄ້າງເປັນຍອດສະສົມຕໍ່ມື້ ບໍ່ແມ່ນແຖວຂອງ movement ຈຶ່ງຄ້າງຢູ່.
   * ລຶບສະເພາະມື້ທີ່ **ບໍ່ເຫຼືອ** ການເຄື່ອນໄຫວອື່ນແລ້ວ — ຖ້າມື້ນັ້ນມີທຸລະກຳຈິງ
   * ປົນຢູ່ ການລຶບຍອດຈະທຳລາຍຂໍ້ມູນຈິງ ເຊິ່ງຮ້າຍກວ່າການປະຍອດຄ້າງໄວ້.
   */
  let clearedDays = 0;
  let keptDays = 0;
  for (const businessDate of dates) {
    const left =
      (await prisma.stockOldLedger.count({ where: { businessDate } })) +
      (await prisma.stockNewLedger.count({ where: { businessDate } }));
    if (left > 0) {
      keptDays++;
      continue;
    }
    const day = await prisma.businessDay.findFirst({ where: { date: businessDate } });
    if (!day) continue;
    await prisma.stockOldTypeBalance.deleteMany({ where: { businessDayId: day.id } });
    await prisma.stockNewSkuBalance.deleteMany({ where: { businessDayId: day.id } });
    clearedDays++;
  }

  console.log(`ລຶບຂໍ້ມູນຕົວຢ່າງແລ້ວ: ${ids.length} ລາຍການເຄື່ອນໄຫວ · ລ້າງຍອດ ${clearedDays} ມື້`);
  if (keptDays > 0) {
    console.log(
      `  ${keptDays} ມື້ຍັງມີທຸລະກຳອື່ນຢູ່ — ປະຍອດຄົງຄ້າງໄວ້ ເພື່ອບໍ່ໃຫ້ກະທົບຂໍ້ມູນຈິງ`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * ສ້າງຂໍ້ມູນຕົວຢ່າງ
 * ------------------------------------------------------------------ */

async function main(): Promise<void> {
  assertSafeTarget();

  if (clean) {
    await removeDemo();
    return;
  }

  const existing = await prisma.stockMovement.count({ where: { note: { contains: DEMO_TAG } } });
  if (existing > 0) {
    console.log(
      `ມີຂໍ້ມູນຕົວຢ່າງຢູ່ແລ້ວ ${existing} ລາຍການ — ແລ່ນ --clean ກ່ອນ ຖ້າຢາກສ້າງໃໝ່`,
    );
    return;
  }

  const partners = await prisma.partnerSource.findMany({ where: { deletedAt: null } });
  const partner = (code: string) => {
    const found = partners.find((p) => p.code === code);
    if (!found) throw new Error(`ບໍ່ພົບແຫຼ່ງ "${code}" — ແລ່ນ npm run db:seed ກ່ອນ`);
    return found;
  };

  const goldTypes = await prisma.goldType.findMany({ where: { deletedAt: null } });
  const goldType = (code: string) => {
    const found = goldTypes.find((g) => g.code === code);
    if (!found) throw new Error(`ບໍ່ພົບປະເພດຄຳ "${code}" — ແລ່ນ npm run db:seed ກ່ອນ`);
    return found;
  };

  /*
   * ຝັ່ງ Stock (NEW) ອ້າງ SKU ບໍ່ແມ່ນ ລາຍການຄຳ: `refreshSkuBalances` ຂຽນ
   * ຍອດຄົງຄ້າງໃຫ້ສະເພາະແຖວທີ່ມີ `goldSkuId` — ຖ້າສົ່ງແຕ່ `goldItemId`
   * ຈະໄດ້ ledger ແຕ່ໜ້າ ຍອດ Stock (NEW) ຍັງຫວ່າງເປົ່າ.
   */
  const skus = await prisma.goldSku.findMany({ orderBy: { createdAt: 'asc' }, take: 2 });
  if (skus.length === 0) throw new Error('ບໍ່ມີ SKU ຄຳໃໝ່ — ສ້າງຢູ່ໜ້າ Admin ກ່ອນ');
  const sku = (i: number) => skus[Math.min(i, skus.length - 1)]!;

  await login();

  // ຕ້ອງມີກະເປີດ ຈຶ່ງບັນທຶກທຸລະກຳໄດ້ (ShiftGuard).
  const me = await prisma.user.findFirst({ where: { username: USERNAME } });
  const open = await prisma.shift.findFirst({ where: { userId: me?.id, closedAt: null } });
  if (!open) await call('POST', '/shifts/open');

  /*
   * ລາຄາຕ້ອງເອົາມາຈາກກະດານລາຄາຈິງຂອງຮ້ານ ບໍ່ແມ່ນຕົວເລກທີ່ຄິດເອົາເອງ.
   *
   * Stock OUT ຄິດຕົ້ນທຶນດ້ວຍ **WAC** ທີ່ປະສົມ NEW ກັບ OLD ເຂົ້າກັນ: ຖ້າຕັ້ງ
   * ລາຄາເຂົ້າຂອງສອງຝັ່ງຫ່າງກັນ ຕົ້ນທຶນອອກຈະສູງກວ່າຕົ້ນທຶນເຂົ້າຂອງຝັ່ງທີ່ຖືກກວ່າ
   * ແລ້ວ "ຕົ້ນທຶນຄົງເຫຼືອ" ຈະຕິດລົບ — ເບິ່ງຄືລະບົບຄິດຜິດ ທັງທີ່ເປັນຂໍ້ມູນຕົວຢ່າງ
   * ທີ່ຕັ້ງລາຄາມາບໍ່ດີ.
   */
  const pricing = (await call('GET', '/pricing/current')) as unknown as {
    price1Baht: string;
    lines: Array<{ tierCode: string; buybackPrice: string }>;
  };
  const BAHT_G = 15;
  const sellPerG = Number(pricing.price1Baht) / BAHT_G;
  const buyback1Baht = pricing.lines.find((l) => l.tierCode === 'JW_BAHT_1')?.buybackPrice;
  const buybackPerG = Number(buyback1Baht ?? pricing.price1Baht) / BAHT_G;

  const cost = (grams: number, perG: number) => String(Math.round(grams * perG));

  const note = (what: string) => `${DEMO_TAG} ${what}`;
  const made: string[] = [];

  /* -- ① ຮັບເຂົ້າ ------------------------------------------------- *
   * ຄຳເກົ່າເຂົ້າສາງ ມາຈາກ Cashier ສະເໝີ (§7.1) ຈຶ່ງບໍ່ສົ່ງ partnerId;
   * ຄຳໃໝ່ຈຶ່ງເລືອກແຫຼ່ງໄດ້.
   */
  const oldIn = await call('POST', '/stock/in', {
    scope: 'OLD',
    // 45×3 + 22.5×2 + 30×2 = 240 g, ຄິດຕາມລາຄາຮັບຊື້ຄືນຂອງກະດານລາຄາ
    totalCost: cost(240, buybackPerG),
    note: note('ຄຳເກົ່າຮັບຊື້ຄືນໜ້າຮ້ານ → Cashier'),
    lines: [
      { goldTypeId: goldType('GOOD').id, oldCategory: 'JEWELRY', weightG: '45', quantity: 3 },
      { goldTypeId: goldType('HUMP').id, oldCategory: 'JEWELRY', weightG: '22.5', quantity: 2 },
      { goldTypeId: goldType('BAR').id, oldCategory: 'BAR', weightG: '30', quantity: 2 },
    ],
  });
  made.push(`${oldIn.code}  ເຂົ້າ OLD   CASHIER`);

  // ນ້ຳໜັກຂອງແຖວ = ນ້ຳໜັກຂອງ SKU ເອງ ເພື່ອໃຫ້ຍອດ ແລະ ລາຄາ/g ອ່ານແລ້ວສົມເຫດຜົນ.
  for (const [code, label, which, qty] of [
    ['EASY', 'ຊື້ຄຳໃໝ່ຈາກ EASY', 0, 5],
    ['FACTORY', 'ຮັບຄຳໃໝ່ຄືນຈາກ FACTORY', 1, 2],
    ['OUTSOURCE_SMITH', 'ຮັບຄຳໃໝ່ຄືນຈາກຊ່າງນອກ', 1, 1],
    ['OTHER', 'ຮັບຄຳໃໝ່ຈາກແຫຼ່ງອື່ນ', 0, 1],
  ] as const) {
    const s = sku(which);
    const grams = Number(s.weightG) * qty;
    const mv = await call('POST', '/stock/in', {
      scope: 'NEW',
      partnerId: partner(code).id,
      totalCost: cost(grams, sellPerG),
      laborFeeThb: '1200',
      note: note(label),
      lines: [{ goldSkuId: s.id, weightG: String(s.weightG), quantity: qty }],
    });
    made.push(`${mv.code}  ເຂົ້າ NEW   ${code.padEnd(16)} ${grams} g`);
  }

  /* -- ② ສົ່ງອອກ -------------------------------------------------- *
   * Stock OUT ສ້າງເປັນ PENDING ແລະ ຍັງບໍ່ຕັດຍອດຈົນກວ່າຈະອະນຸມັດ (§7.2).
   * ອະນຸມັດຢູ່ນີ້ເລີຍ ຍົກເວັ້ນ FACTORY ທີ່ຈະໄປລໍຖ້າການປະເມີນນ້ຳໜັກ (§7.3)
   * — ປະໄວ້ແບບນັ້ນ ເພື່ອໃຫ້ໜ້າ ຕິດຕາມ FACTORY ມີແຖວໃຫ້ເບິ່ງ.
   */
  for (const [code, label, weight, transform] of [
    ['FACTORY', 'ສົ່ງຄຳເກົ່າໄປ FACTORY ຫຼອມ', '18', 'MELT'],
    ['OUTSOURCE_SMITH', 'ສົ່ງຄຳເກົ່າໃຫ້ຊ່າງນອກ', '12', 'ETCH'],
    ['OTHER', 'ສົ່ງຄຳເກົ່າອອກ — ແຫຼ່ງອື່ນ', '9', 'DYE'],
    ['WHOLESALES', 'ຂາຍສົ່ງຄຳເກົ່າ', '15', 'MELT'],
  ] as const) {
    const mv = await call('POST', '/stock/out', {
      scope: 'OLD',
      partnerId: partner(code).id,
      transformType: transform,
      note: note(label),
      lines: [{ goldTypeId: goldType('GOOD').id, weightG: weight, quantity: 1 }],
    });
    await call('POST', `/stock/out/${mv.id}/review`, { decision: 'APPROVED' });
    const parked = code === 'FACTORY' ? '  → ລໍຖ້າ FACTORY ປະເມີນ (§7.3)' : '';
    made.push(`${mv.code}  ອອກ OLD    ${code}${parked}`);
  }

  // ຄຳໃໝ່ອອກໄປຕູ້ວາງສະແດງ — ແຫຼ່ງດຽວທີ່ເປັນ OUT ແລະ ບໍ່ຂຶ້ນ AP-AR.
  const toCabinet = await call('POST', '/stock/out', {
    scope: 'NEW',
    partnerId: partner('CABINET').id,
    note: note('ຈັດຄຳໃໝ່ເຂົ້າຕູ້ວາງສະແດງ'),
    lines: [{ goldSkuId: sku(0).id, weightG: String(sku(0).weightG), quantity: 2 }],
  });
  await call('POST', `/stock/out/${toCabinet.id}/review`, { decision: 'APPROVED' });
  made.push(`${toCabinet.code}  ອອກ NEW    CABINET`);

  /*
   * WITHDRAW ຄືການສົ່ງຄຳຄືນໃຫ້ EASY ຈຶ່ງເປັນ **NEW OUT** ບໍ່ແມ່ນ OLD:
   * ກົດລົງບັນຊີ §8.4 ຈັບຄູ່ມັນກັບການຮັບເຂົ້າຈາກ EASY ແລ້ວລົບລ້າງ AP ຂອງ EASY
   * (`counterpartyId`). ໃຊ້ scope ຜິດຈະບໍ່ມີກົດໃດກົງ ແລ້ວບໍ່ລົງບັນຊີເລີຍ.
   */
  const withdraw = await call('POST', '/stock/out', {
    scope: 'NEW',
    partnerId: partner('WITHDRAW').id,
    note: note('ສົ່ງຄຳຄືນ EASY — ລົບລ້າງ AP ຂອງ EASY (§8.4)'),
    lines: [{ goldSkuId: sku(0).id, weightG: String(sku(0).weightG), quantity: 2 }],
  });
  await call('POST', `/stock/out/${withdraw.id}/review`, { decision: 'APPROVED' });
  made.push(`${withdraw.code}  ອອກ NEW    WITHDRAW    → ລົບລ້າງ AP ຂອງ EASY (§8.4)`);

  // ປະໄວ້ 1 ລາຍການທີ່ຍັງ PENDING ເພື່ອໃຫ້ໜ້າ ອະນຸມັດ ມີວຽກໃຫ້ເຫັນ.
  const pending = await call('POST', '/stock/out', {
    scope: 'OLD',
    partnerId: partner('WHOLESALES').id,
    transformType: 'MELT',
    note: note('ລໍຖ້າອະນຸມັດ — ສຳລັບທົດລອງໜ້າ ອະນຸມັດ'),
    lines: [{ goldTypeId: goldType('HUMP').id, weightG: '6', quantity: 1 }],
  });
  made.push(`${pending.code}  ອອກ OLD    WHOLESALES  → ລໍຖ້າອະນຸມັດ (§7.2)`);

  console.log(`\n  ຂໍ້ມູນຕົວຢ່າງ........ ${made.length} ລາຍການ`);
  for (const line of made) console.log(`    ${line}`);
  console.log(`\n  ລຶບຄືນ: npm run db:seed:demo -- --clean\n`);
}

main()
  .catch((error: unknown) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
