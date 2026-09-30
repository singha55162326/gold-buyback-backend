/**
 * ສ້າງ / ແກ້ຜູ້ໃຊ້ງານ — create or reset a staff account.
 *
 *   npm run create-user                       # ຖາມທຸກຢ່າງ
 *   npm run create-user -- -u admin -r ADMIN  # ຖາມແຕ່ລະຫັດຜ່ານ
 *
 * The password is NEVER taken from argv: command-line arguments are visible to
 * every user on the box through `ps`, and they land in shell history. It is
 * read from a hidden prompt, or from KPV_NEW_PASSWORD for automation.
 *
 * Run it on the API box, from the deploy root:
 *
 *   cd /opt/gold-buyback-backend && sudo -u kpv npm run create-user
 *
 * This writes directly to the database and therefore leaves NO AuditLog row —
 * there is no signed-in actor to attribute it to. Day-to-day user management
 * belongs in the Admin UI (ຜູ້ໃຊ້ງານ), which does audit. Use this for the first
 * admin, and for the password nobody can remember any more.
 */
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaClient, UserRole } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';

// Same file the API and the Prisma CLI read, so this cannot end up writing to
// a different database than the one the app serves.
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
});

const prisma = new PrismaClient();

const ROLES: Record<UserRole, string> = {
  ADMIN: 'ຜູ້ດູແລລະບົບ',
  MANAGER: 'ຜູ້ຈັດການ',
  PAYMENT: 'ພະນັກງານການເງິນໜ້າຮ້ານ',
  VALUER: 'ຜູ້ປະເມີນລາຄາ',
  FINANCIAL_CONTROLLER: 'Financial Controller',
  WAREHOUSE: 'ຜູ້ຈັດການສາງ',
};

const MIN_PASSWORD = 8;

/** Read `--flag value` / `-f value` out of argv. */
function arg(long: string, short: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${long}` || a === `-${short}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a.trim()))));
}

/**
 * Prompt without echoing. Node has no built-in for this, so take the tty raw
 * and handle the three keys that matter; anything else and the password would
 * be sitting in the scrollback of a shared terminal.
 */
function askHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error(
      'ບໍ່ແມ່ນ terminal — ຕັ້ງ KPV_NEW_PASSWORD ແທນ.\n' +
        'Not a TTY, so the password cannot be prompted for. Set KPV_NEW_PASSWORD.',
    );
  }
  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (buf: Buffer) => {
      const ch = buf.toString('utf8');
      switch (ch) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl-D
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          break;
        case '\u0003': // Ctrl-C
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          reject(new Error('ຍົກເລີກ — cancelled'));
          break;
        case '\u007f': // Backspace
        case '\b':
          value = value.slice(0, -1);
          break;
        default:
          // Ignore the rest of the control range (arrow keys arrive as escape
          // sequences and would otherwise be typed into the password).
          if (ch >= ' ') value += ch;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  console.log('\n  ສ້າງ / ແກ້ຜູ້ໃຊ້ງານ — KPV\n');

  // ---- username --------------------------------------------------------
  let username = arg('username', 'u') ?? '';
  while (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    if (username) console.log('  ຕ້ອງເປັນ a-z 0-9 . _ - ຄວາມຍາວ 3–32 ຕົວ');
    username = (await ask('  ຊື່ຜູ້ໃຊ້ (username): ')).toLowerCase();
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`\n  ມີຢູ່ແລ້ວ: ${existing.fullName} · ${existing.role}`);
    console.log('  ຈະຕັ້ງລະຫັດຜ່ານໃໝ່ໃຫ້ບັນຊີນີ້.\n');
  }

  // ---- role ------------------------------------------------------------
  let role = (arg('role', 'r') ?? existing?.role ?? '').toUpperCase();
  while (!(role in ROLES)) {
    if (role) console.log(`  ສິດບໍ່ຖືກຕ້ອງ. ເລືອກຈາກ: ${Object.keys(ROLES).join(', ')}`);
    console.log('');
    Object.entries(ROLES).forEach(([k, lo], i) => console.log(`    ${i + 1}. ${k.padEnd(22)} ${lo}`));
    const pick = await ask('\n  ສິດ (ເລກ ຫຼື ຊື່): ');
    const byNumber = Object.keys(ROLES)[Number(pick) - 1];
    role = (byNumber ?? pick).toUpperCase();
  }

  // ---- full name -------------------------------------------------------
  const fullName =
    arg('name', 'n') ??
    existing?.fullName ??
    (await ask(`  ຊື່ເຕັມ [${ROLES[role as UserRole]}]: `)) ??
    '';

  // ---- password --------------------------------------------------------
  let password = process.env.KPV_NEW_PASSWORD ?? '';
  if (password) {
    console.log('  ລະຫັດຜ່ານ: ອ່ານຈາກ KPV_NEW_PASSWORD');
  } else {
    for (;;) {
      password = await askHidden('  ລະຫັດຜ່ານ: ');
      if (password.length < MIN_PASSWORD) {
        console.log(`  ສັ້ນເກີນໄປ — ຢ່າງໜ້ອຍ ${MIN_PASSWORD} ຕົວ`);
        continue;
      }
      if ((await askHidden('  ພິມອີກເທື່ອ: ')) !== password) {
        console.log('  ບໍ່ກົງກັນ — ລອງໃໝ່');
        continue;
      }
      break;
    }
  }
  if (password.length < MIN_PASSWORD) {
    throw new Error(`ລະຫັດຜ່ານສັ້ນເກີນໄປ — ຢ່າງໜ້ອຍ ${MIN_PASSWORD} ຕົວ`);
  }

  // Argon2id, the same hash the login route verifies against.
  const passwordHash = await argonHash(password);

  const user = await prisma.user.upsert({
    where: { username },
    // An account someone is recovering may have been deactivated or
    // soft-deleted; setting a password on one that still cannot log in would
    // look like the script had failed.
    update: { passwordHash, role: role as UserRole, fullName, isActive: true, deletedAt: null },
    create: { username, passwordHash, role: role as UserRole, fullName, isActive: true },
  });

  console.log('');
  console.log(`  ${existing ? 'ແກ້ໄຂແລ້ວ' : 'ສ້າງແລ້ວ'} ✓`);
  console.log(`    username  ${user.username}`);
  console.log(`    ຊື່        ${user.fullName}`);
  console.log(`    ສິດ        ${user.role}`);
  console.log('');
  console.log('  ລະຫັດຜ່ານບໍ່ຖືກສະແດງ ແລະ ບໍ່ຖືກບັນທຶກໄວ້ບ່ອນໃດ.');
  console.log('');
}

main()
  .catch((e) => {
    console.error(`\n  ຜິດພາດ: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
