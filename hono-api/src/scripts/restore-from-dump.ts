/**
 * Restore dev/local Postgres DB dari legacy MariaDB SQL dump files.
 *
 * Usage:
 *   ALLOW_LEGACY_RESTORE=true bun run db:restore-legacy
 *   ALLOW_LEGACY_RESTORE=true LEGACY_DUMP_DIR=../legacy/db-backup bun run db:restore-legacy
 *
 * Scope: master tables saja (13 tabel). Transactional tetap kosong — itu
 * diisi dari mobile insert. Lihat plan untuk detail.
 *
 * Safety:
 *   - Refuse jalan kalau NODE_ENV=production.
 *   - Refuse jalan tanpa ALLOW_LEGACY_RESTORE=true.
 *   - Refuse jalan kalau DB name endsWith _prod atau _test.
 *
 * Idempotent: pakai .onConflictDoNothing() — re-run aman.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getTableColumns, sql, type Column } from 'drizzle-orm';
import { type PgTable } from 'drizzle-orm/pg-core';
import { db } from '../config/database';
import { env } from '../config/env';
import {
  app_modul,
  app_role_menu,
  call_setting,
  call_target_class,
  call_target_hari,
  call_target_list,
  call_version,
  data_pegawai,
  data_product,
  data_spec_dr,
  list_dokter_visit_new,
  struktur,
  users,
} from '../db/schema';
import { parseDump, type Row } from './dump-parser';

async function resetSequence(table: string, column: string) {
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence(${table}, ${column}),
      COALESCE((SELECT MAX(${sql.raw(`"${column}"`)}) FROM ${sql.raw(`"${table}"`)}), 1),
      true
    )
  `);
}

const BATCH_SIZE = 500;

// ----------------------------------------------------------------------------
// Table specs — load order matters (FK-safe).
// ----------------------------------------------------------------------------

type TransformFn = (row: Row) => Row | null;

interface TableSpec {
  filename: string;
  // Use a generic PgTable type since each table has different column shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  pkColumn: string;
  /** Optional per-row transform. Return null to skip the row. */
  transform?: TransformFn;
}

const SPECS: TableSpec[] = [
  {
    filename: 'users.sql',
    table: users,
    pkColumn: 'id',
    transform: (row) => {
      // PHP $2y$ bcrypt → OpenBSD $2b$ (algoritma identik, hanya beda header).
      // Bun.password.verify hanya kenal $2b$.
      if (typeof row.password === 'string' && row.password.startsWith('$2y$')) {
        row.password = '$2b$' + (row.password as string).slice(4);
      }
      // NOT NULL fields — skip baris kalau hilang.
      if (row.name == null || row.username == null || row.password == null) return null;
      return row;
    },
  },
  { filename: 'data_pegawai.sql', table: data_pegawai, pkColumn: 'rowid' },
  {
    filename: 'struktur.sql',
    table: struktur,
    pkColumn: 'id',
    transform: (row) => {
      // periode_awal, periode_akhir NOT NULL — skip row kalau 0000-00-00 (parser → null).
      if (row.periode_awal == null || row.periode_akhir == null) return null;
      // Required text fields — kalau null, isi placeholder agar tidak gagal NOT NULL.
      row.rayon_mr ??= '';
      row.golongan ??= '';
      row.divisi ??= '';
      row.rayon_dm ??= '';
      row.region ??= '';
      return row;
    },
  },
  { filename: 'app_modul.sql', table: app_modul, pkColumn: 'id_modul' },
  { filename: 'app_role_menu.sql', table: app_role_menu, pkColumn: 'id_role' },
  { filename: 'call_version.sql', table: call_version, pkColumn: 'id' },
  { filename: 'data_spec_dr.sql', table: data_spec_dr, pkColumn: 'id' },
  {
    filename: 'list_dokter_visit_new.sql',
    table: list_dokter_visit_new,
    pkColumn: 'ID',
    transform: (row) => {
      // HUT NOT NULL — kalau null (0000-00-00 di legacy), pakai sentinel.
      if (row.HUT == null) row.HUT = '1900-01-01';
      return row;
    },
  },
  { filename: 'call_setting.sql', table: call_setting, pkColumn: 'id' },
  { filename: 'call_target_list.sql', table: call_target_list, pkColumn: 'id' },
  { filename: 'call_target_hari.sql', table: call_target_hari, pkColumn: 'id' },
  { filename: 'call_target_class.sql', table: call_target_class, pkColumn: 'id' },
  { filename: 'data_product.sql', table: data_product, pkColumn: 'id' },
];

// ----------------------------------------------------------------------------
// Guards
// ----------------------------------------------------------------------------

function assertSafe(): void {
  if (env.NODE_ENV === 'production') {
    fail('NODE_ENV=production — restore disabled untuk safety.');
  }
  if (process.env.ALLOW_LEGACY_RESTORE !== 'true') {
    fail(
      'set ALLOW_LEGACY_RESTORE=true (env var atau .env) untuk opt-in. ' +
        'Script ini menulis data prod ke dev DB; konfirmasi eksplisit wajib.',
    );
  }
  let dbName = '';
  try {
    const url = new URL(env.DATABASE_URL);
    dbName = url.pathname.replace(/^\//, '');
  } catch {
    fail(`DATABASE_URL invalid: "${env.DATABASE_URL}"`);
  }
  if (dbName.endsWith('_prod') || dbName === 'msf_prod') {
    fail(`DB "${dbName}" looks like production — restore disabled.`);
  }
  if (dbName.endsWith('_test') || dbName.startsWith('msf_test_')) {
    fail(`DB "${dbName}" is the test DB pool — pakai dev DB (msf_dev / msf).`);
  }
}

function fail(msg: string): never {
  console.error(`❌ refuse: ${msg}`);
  process.exit(1);
}

// ----------------------------------------------------------------------------
// Column-aware type coercion
// ----------------------------------------------------------------------------

/**
 * Apply Drizzle column dataType info to coerce string→number for INT/BIGINT
 * columns. Parser keeps quoted-numeric values (e.g. `'2'`) as strings because
 * it cannot distinguish them from phone-number-like strings; we resolve that
 * here using schema introspection.
 */
function coerceRow(row: Row, columns: Record<string, Column>): Row {
  const out: Row = {};
  for (const [name, val] of Object.entries(row)) {
    if (val === null || val === undefined) {
      out[name] = val;
      continue;
    }
    const col = columns[name];
    if (!col) {
      out[name] = val;
      continue;
    }
    const dt = col.dataType; // 'string' | 'number' | 'bigint' | 'date' | ...
    if ((dt === 'number' || dt === 'bigint') && typeof val === 'string') {
      // Only coerce if it looks like a valid integer/decimal.
      if (/^-?\d+(\.\d+)?$/.test(val)) {
        out[name] = Number(val);
        continue;
      }
    }
    if (dt === 'date' && typeof val === 'string') {
      // Drizzle's default `timestamp()` mode is Date — it calls `.toISOString()`
      // on insert, so string values blow up. Convert datetime strings to Date.
      // Plain 'YYYY-MM-DD' date strings stay as string (date() column accepts).
      if (/^\d{4}-\d{2}-\d{2}[ T]/.test(val)) {
        const iso = val.replace(' ', 'T');
        const hasTz = /[Z+]|-\d{2}:\d{2}$/.test(iso);
        out[name] = new Date(hasTz ? iso : iso + 'Z');
        continue;
      }
    }
    out[name] = val;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Per-table importer
// ----------------------------------------------------------------------------

async function importTable(spec: TableSpec, dir: string): Promise<void> {
  const filepath = join(dir, spec.filename);
  if (!existsSync(filepath)) {
    console.warn(`  ⚠️  ${spec.filename.padEnd(28)} skipped (file not found)`);
    return;
  }

  const start = Date.now();
  const sizeMb = (statSync(filepath).size / 1024 / 1024).toFixed(1);
  const content = readFileSync(filepath, 'utf8');
  const { rows } = parseDump(content);

  const columns = getTableColumns(spec.table as PgTable);

  // Apply transform + type coercion.
  const transformed: Row[] = [];
  for (const r of rows) {
    const coerced = coerceRow(r, columns as Record<string, Column>);
    const after = spec.transform ? spec.transform(coerced) : coerced;
    if (after !== null) transformed.push(after);
  }

  const skipped = rows.length - transformed.length;

  // Batch insert.
  let inserted = 0;
  for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
    const batch = transformed.slice(i, i + BATCH_SIZE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.insert(spec.table) as any).values(batch).onConflictDoNothing();
    inserted += batch.length;
  }

  await resetSequence(spec.filename.replace(/\.sql$/, ''), spec.pkColumn);

  const elapsed = Date.now() - start;
  console.info(
    `  ✓ ${spec.filename.padEnd(28)} ${String(inserted).padStart(6)} rows ` +
      `(${sizeMb} MB, ${elapsed}ms${skipped > 0 ? `, ${skipped} skipped` : ''})`,
  );
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main(): Promise<void> {
  assertSafe();

  const dirArg = process.env.LEGACY_DUMP_DIR ?? '../legacy/db-backup';
  const dir = resolve(process.cwd(), dirArg);

  if (!existsSync(dir)) {
    fail(`LEGACY_DUMP_DIR not found: ${dir}`);
  }
  if (!existsSync(join(dir, 'users.sql'))) {
    fail(`users.sql tidak ada di ${dir} — folder dump salah?`);
  }

  console.info(`🔄 Restoring from ${dir} ...`);
  console.info(`   DB: ${maskDbUrl(env.DATABASE_URL)}\n`);

  const start = Date.now();
  for (const spec of SPECS) {
    await importTable(spec, dir);
  }
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.info(`\n✅ Restore selesai dalam ${elapsed}s`);
  console.info('\n📝 Catatan:');
  console.info('   - Dev login mr01/dm01/rsm01 (password "password") tetap work');
  console.info('     karena PK conflict di-skip (onConflictDoNothing).');
  console.info('   - Untuk login pakai user prod, cek `password_view` column:');
  console.info(
    '       SELECT username, password_view FROM users WHERE password_view IS NOT NULL LIMIT 5;',
  );

  process.exit(0);
}

function maskDbUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(invalid URL)';
  }
}

main().catch((err) => {
  console.error('\n❌ Restore failed:', err);
  process.exit(1);
});
