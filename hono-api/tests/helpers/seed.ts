/**
 * Test seed helpers.
 *
 * Dua jenis fungsi:
 *
 *   1. seedMinimalMaster(dbUrl)
 *      Dipanggil oleh tests/setup.ts sekali per run. Pakai client postgres sendiri
 *      (bukan pool app) karena saat setup.ts berjalan kita belum tentu mau "warm up"
 *      pool app — biar bersih.
 *
 *   2. seedAppModuls(), seedDokterVisit(), seedCallTargets(), seedProduct(),
 *      seedCallVersion()
 *      Dipanggil on-demand dari test file (di beforeAll) kalau butuh data master
 *      tambahan. Pakai pool `db` global dari src/config/database — pool itu sudah
 *      diarahkan ke DB unik karena env.DATABASE_URL sudah di-override di setup.ts
 *      sebelum modul src/* di-import.
 *
 * Reuse semua data dari src/scripts/_fixtures.ts — jangan duplikat.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import {
  users,
  data_pegawai,
  struktur,
  app_modul,
  app_role_menu,
  call_version,
  list_dokter_visit_new,
  call_setting,
  call_target_list,
  call_target_hari,
  call_target_class,
  data_product,
  data_spec_dr,
} from '../../src/db/schema/master';
import {
  seed_users,
  seed_data_pegawai,
  seed_struktur,
  seed_app_modul,
  seed_app_role_menu,
  seed_call_version,
  seed_data_spec_dr,
  seed_list_dokter_visit_new,
  seed_call_setting,
  seed_call_target_list,
  seed_call_target_hari,
  seed_call_target_class,
  seed_data_product,
} from '../../src/scripts/_fixtures';

// ---------------------------------------------------------------------------
// Sequence reset helper — perlu setelah INSERT dengan ID eksplisit, kalau tidak
// INSERT berikutnya (tanpa ID) akan duplicate karena sequence masih di posisi 1.
// ---------------------------------------------------------------------------
type DrizzleLike = {
  execute: (q: ReturnType<typeof sql>) => Promise<unknown>;
};

async function resetSequence(d: DrizzleLike, table: string, column: string) {
  await d.execute(sql`
    SELECT setval(
      pg_get_serial_sequence(${table}, ${column}),
      COALESCE((SELECT MAX(${sql.raw(`"${column}"`)}) FROM ${sql.raw(`"${table}"`)}), 1),
      true
    )
  `);
}

// ---------------------------------------------------------------------------
// 1) Minimal master — dipanggil setup.ts sekali per run.
//    Self-contained: bikin client sendiri, close sendiri.
// ---------------------------------------------------------------------------
export async function seedMinimalMaster(dbUrl: string) {
  const client = postgres(dbUrl, { max: 1 });
  const db = drizzle(client);
  try {
    await db.insert(users).values([...seed_users]).onConflictDoNothing();
    await db.insert(data_pegawai).values([...seed_data_pegawai]).onConflictDoNothing();
    await db.insert(struktur).values([...seed_struktur]).onConflictDoNothing();

    await resetSequence(db, 'users', 'id');
    await resetSequence(db, 'data_pegawai', 'rowid');
    await resetSequence(db, 'struktur', 'id');
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// 2) On-demand seeders — dipanggil dari test file (beforeAll).
//    Pakai pool app yang sudah ada (DATABASE_URL sudah point ke DB unik).
// ---------------------------------------------------------------------------

export async function seedAppModuls() {
  const { db } = await import('../../src/config/database');
  await db.insert(app_modul).values([...seed_app_modul]).onConflictDoNothing();
  await db.insert(app_role_menu).values([...seed_app_role_menu]).onConflictDoNothing();
  await resetSequence(db, 'app_modul', 'id_modul');
  await resetSequence(db, 'app_role_menu', 'id_role');
}

export async function seedDokterVisit() {
  const { db } = await import('../../src/config/database');
  await db.insert(data_spec_dr).values([...seed_data_spec_dr]).onConflictDoNothing();
  await db
    .insert(list_dokter_visit_new)
    .values([...seed_list_dokter_visit_new])
    .onConflictDoNothing();
  await resetSequence(db, 'data_spec_dr', 'id');
  await resetSequence(db, 'list_dokter_visit_new', 'ID');
}

export async function seedCallTargets() {
  const { db } = await import('../../src/config/database');
  await db.insert(call_setting).values([...seed_call_setting]).onConflictDoNothing();
  await db.insert(call_target_list).values([...seed_call_target_list]).onConflictDoNothing();
  await db.insert(call_target_hari).values([...seed_call_target_hari]).onConflictDoNothing();
  await db.insert(call_target_class).values([...seed_call_target_class]).onConflictDoNothing();
  await resetSequence(db, 'call_setting', 'id');
  await resetSequence(db, 'call_target_list', 'id');
  await resetSequence(db, 'call_target_hari', 'id');
  await resetSequence(db, 'call_target_class', 'id');
}

export async function seedProduct() {
  const { db } = await import('../../src/config/database');
  await db.insert(data_product).values([...seed_data_product]).onConflictDoNothing();
  await resetSequence(db, 'data_product', 'id');
}

export async function seedCallVersion() {
  const { db } = await import('../../src/config/database');
  await db.insert(call_version).values([...seed_call_version]).onConflictDoNothing();
  await resetSequence(db, 'call_version', 'id');
}
