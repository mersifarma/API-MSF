/**
 * Global test setup — di-load oleh `bun test` lewat `bunfig.toml` (preload).
 *
 * Strategi: tiap run `bun test` membuat database PostgreSQL UNIK ber-suffix
 * `_test`, jalanin migration + seed minimal di sana, lalu drop di akhir run.
 *
 * Urutan kritikal (jangan dibalik):
 *   1. Load `.env.test` ke process.env (HARUS sebelum modul src/* di-import,
 *      karena src/config/env.ts memparse process.env saat module-init).
 *   2. Safety guard: tolak run kalau base DATABASE_URL bukan ber-suffix `_test`.
 *   3. CREATE unique DB lewat koneksi ke "postgres" admin DB.
 *   4. Override process.env.DATABASE_URL ke DB unik. Setelah baris ini, kapan pun
 *      src/* di-import (dynamic atau via test file), pool app akan otomatis
 *      menuju DB unik tsb.
 *   5. Apply migrations.
 *   6. Seed minimal master rows (users + data_pegawai + struktur).
 *   7. Register cleanup (afterAll + process exit / signal handlers).
 *
 * Untuk seed data master tambahan (app_modul, dokter, product, dll) test file
 * tinggal panggil helper di tests/helpers/seed.ts pada beforeAll.
 *
 * Run: `bun test`
 */

import { afterAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

// ---------------------------------------------------------------------------
// 1. Load .env.test
// ---------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '..', '.env.test');

function loadEnvFile(path: string) {
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // CI / shell env wins over file
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(envPath);

// ---------------------------------------------------------------------------
// 2. Parse base URL + safety guard
// ---------------------------------------------------------------------------
const baseDbUrl = process.env.DATABASE_URL;
if (!baseDbUrl) {
  console.error('[tests/setup] DATABASE_URL tidak ter-set setelah load .env.test');
  process.exit(1);
}

const baseUrl = new URL(baseDbUrl);
const baseDbName = baseUrl.pathname.replace(/^\//, '');

if (!baseDbName.endsWith('_test')) {
  console.error(
    `\n[tests/setup] refusing to run tests against non-test DB.\n` +
      `  Base DATABASE_URL must point to a database whose name ends with "_test"\n` +
      `  (ini hanya template — nama DB unik akan di-derive dari sini).\n` +
      `  Got DB name: "${baseDbName}" (from DATABASE_URL=${baseDbUrl})\n`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. CREATE unique DB
// ---------------------------------------------------------------------------
const uniqueDbName = `msf_test_${Date.now()}_${process.pid}`;

const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres'; // admin DB
const adminUrlStr = adminUrl.toString();

console.info(`[tests/setup] creating temp DB ${uniqueDbName}`);
{
  const admin = postgres(adminUrlStr, { max: 1 });
  try {
    // DB name di-quote — aman karena pattern `msf_test_${number}_${number}.
    await admin.unsafe(`CREATE DATABASE "${uniqueDbName}"`);
  } catch (err) {
    await admin.end().catch(() => {});
    console.error('[tests/setup] CREATE DATABASE gagal:', err);
    process.exit(1);
  }
  await admin.end();
}

// ---------------------------------------------------------------------------
// 4. Override DATABASE_URL → arahkan app + pool ke DB unik
// ---------------------------------------------------------------------------
const newUrl = new URL(baseUrl);
newUrl.pathname = '/' + uniqueDbName;
process.env.DATABASE_URL = newUrl.toString();

// ---------------------------------------------------------------------------
// 5. Migrate + 6. Seed (dynamic imports — setelah env di-override)
// ---------------------------------------------------------------------------
let setupFailed = false;
try {
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const migrationsFolder = resolve(here, '..', 'drizzle', 'migrations');

  const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });
  console.info('[tests/setup] applying migrations on test DB...');
  const t0 = Date.now();
  await migrate(drizzle(migrationClient), { migrationsFolder });
  await migrationClient.end();
  console.info(`[tests/setup] migrations applied in ${Date.now() - t0}ms`);

  const { seedMinimalMaster } = await import('./helpers/seed');
  const t1 = Date.now();
  await seedMinimalMaster(process.env.DATABASE_URL);
  console.info(`[tests/setup] minimal seed done in ${Date.now() - t1}ms`);
} catch (err) {
  setupFailed = true;
  console.error('[tests/setup] migrate/seed gagal:', err);
}

// ---------------------------------------------------------------------------
// 7. Cleanup — afterAll + signal handlers + beforeExit (semua idempotent)
// ---------------------------------------------------------------------------
let cleaned = false;

async function dropTempDb(reason: string) {
  if (cleaned) return;
  cleaned = true;

  // Tutup pool app supaya tidak menghalangi DROP DATABASE.
  // Hanya import kalau modul-nya sudah pernah dimuat oleh test — kalau belum,
  // tidak ada pool yang perlu ditutup.
  try {
    const mod = await import('../src/config/database');
    if (typeof mod.closeDb === 'function') await mod.closeDb();
  } catch {
    // ignore — modul belum di-load berarti pool belum dibuat
  }

  const admin = postgres(adminUrlStr, { max: 1 });
  try {
    // PG13+: WITH (FORCE) men-terminate koneksi yang masih nyangkut.
    await admin.unsafe(`DROP DATABASE IF EXISTS "${uniqueDbName}" WITH (FORCE)`);
  } catch {
    // Fallback PG<13: terminate backends manual lalu DROP biasa.
    try {
      await admin.unsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity ` +
          `WHERE datname = '${uniqueDbName}' AND pid <> pg_backend_pid()`,
      );
      await admin.unsafe(`DROP DATABASE IF EXISTS "${uniqueDbName}"`);
    } catch (err) {
      console.warn(`[tests/setup] drop DB gagal (${reason}):`, err);
    }
  } finally {
    await admin.end().catch(() => {});
  }
  console.info(`[tests/setup] dropped temp DB ${uniqueDbName} (${reason})`);
}

// Kalau setup gagal, langsung cleanup & exit — jangan biarkan tests jalan.
if (setupFailed) {
  await dropTempDb('setup-failed');
  process.exit(1);
}

// Bun preload script's afterAll = global hook (jalan setelah seluruh suite).
afterAll(async () => {
  await dropTempDb('afterAll');
});

// Safety net kalau proses keluar tanpa lewat afterAll (mis. error fatal).
process.on('beforeExit', () => {
  if (cleaned) return;
  // beforeExit boleh async — tapi process bisa langsung exit kalau gak ada
  // yang menahan. Best-effort saja.
  void dropTempDb('beforeExit');
});

// Best-effort kalau di-Ctrl+C / kill.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, async () => {
    await dropTempDb(sig);
    process.exit(130);
  });
}
