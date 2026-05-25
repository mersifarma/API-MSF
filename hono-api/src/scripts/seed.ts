/**
 * Seeder master tables — idempotent (re-run aman).
 *
 * Jalankan via:
 *   bun run db:seed
 *
 * Strategi:
 *   1. Insert pakai .onConflictDoNothing() — record yang sudah ada di-skip.
 *   2. Setelah insert, sinkronkan sequence identity ke MAX(id) supaya
 *      INSERT berikutnya (tanpa ID eksplisit) tidak collision.
 *
 * NOTE:
 *   - Hanya seed MASTER tables. Transactional dibiarkan kosong — itu nanti
 *     diisi oleh new mobile saat user beneran insert call_list / call_plan_actual.
 *   - Untuk production master sync, lihat src/scripts/sync-master.ts (TODO).
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../config/database';
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
} from '../db/schema';
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
} from './_fixtures';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function resetSequence(table: string, column: string) {
  // SELECT setval(pg_get_serial_sequence('"table"', 'col'),
  //               COALESCE((SELECT MAX("col") FROM "table"), 1))
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence(${table}, ${column}),
      COALESCE((SELECT MAX(${sql.raw(`"${column}"`)}) FROM ${sql.raw(`"${table}"`)}), 1),
      true
    )
  `);
}

async function seedTable<T>(
  label: string,
  rows: readonly T[],
  fn: (rows: readonly T[]) => Promise<unknown>,
) {
  const start = Date.now();
  await fn(rows);
  console.info(`  ✓ ${label.padEnd(25)} ${rows.length} rows (${Date.now() - start}ms)`);
}

// ----------------------------------------------------------------------------
// Seed
// ----------------------------------------------------------------------------

console.info('🌱 Seeding master tables ...');
const start = Date.now();

// Urutan penting: yang di-reference duluan.
//   users → data_pegawai → struktur (FK ke pegawai)
//   app_modul → app_role_menu (FK ke user + modul)
//   data_spec_dr → list_dokter_visit_new (FK ke spec)

await seedTable('users', seed_users, (rows) =>
  db
    .insert(users)
    .values([...rows])
    .onConflictDoNothing(),
);

// Refresh password dev (self-heal kalau DB sebelumnya punya hash $2y$ lama
// yang tidak compatible dengan Bun.password.verify).
await Promise.all(
  seed_users.map((u) => db.update(users).set({ password: u.password }).where(eq(users.id, u.id))),
);

await seedTable('data_pegawai', seed_data_pegawai, (rows) =>
  db
    .insert(data_pegawai)
    .values([...rows])
    .onConflictDoNothing(),
);

await seedTable('struktur', seed_struktur, (rows) =>
  db
    .insert(struktur)
    .values([...rows])
    .onConflictDoNothing(),
);

await seedTable('app_modul', seed_app_modul, (rows) =>
  db
    .insert(app_modul)
    .values([...rows])
    .onConflictDoNothing(),
);

await seedTable('app_role_menu', seed_app_role_menu, (rows) =>
  db
    .insert(app_role_menu)
    .values([...rows])
    .onConflictDoNothing(),
);

await seedTable('call_version', seed_call_version, (rows) =>
  db
    .insert(call_version)
    .values([...rows])
    .onConflictDoNothing(),
);

await seedTable('data_spec_dr', seed_data_spec_dr, (rows) =>
  db
    .insert(data_spec_dr)
    .values([...rows])
    .onConflictDoNothing(),
);

await seedTable('list_dokter_visit_new', seed_list_dokter_visit_new, (rows) =>
  db
    .insert(list_dokter_visit_new)
    .values([...rows])
    .onConflictDoNothing(),
);

await seedTable('call_setting', seed_call_setting, (rows) =>
  db
    .insert(call_setting)
    .values([...rows])
    .onConflictDoNothing(),
);

await seedTable('call_target_list', seed_call_target_list, (rows) =>
  db
    .insert(call_target_list)
    .values([...rows])
    .onConflictDoNothing(),
);

await seedTable('call_target_hari', seed_call_target_hari, (rows) =>
  db
    .insert(call_target_hari)
    .values([...rows])
    .onConflictDoNothing(),
);

await seedTable('call_target_class', seed_call_target_class, (rows) =>
  db
    .insert(call_target_class)
    .values([...rows])
    .onConflictDoNothing(),
);

await seedTable('data_product', seed_data_product, (rows) =>
  db
    .insert(data_product)
    .values([...rows])
    .onConflictDoNothing(),
);

// ----------------------------------------------------------------------------
// Reset sequences supaya INSERT berikutnya (tanpa ID eksplisit) tidak duplicate.
// ----------------------------------------------------------------------------
console.info('🔄 Syncing identity sequences ...');
await Promise.all([
  resetSequence('users', 'id'),
  resetSequence('data_pegawai', 'rowid'),
  resetSequence('struktur', 'id'),
  resetSequence('app_modul', 'id_modul'),
  resetSequence('app_role_menu', 'id_role'),
  resetSequence('call_version', 'id'),
  resetSequence('data_spec_dr', 'id'),
  resetSequence('list_dokter_visit_new', 'ID'),
  resetSequence('call_setting', 'id'),
  resetSequence('call_target_list', 'id'),
  resetSequence('call_target_hari', 'id'),
  resetSequence('call_target_class', 'id'),
  resetSequence('data_product', 'id'),
]);

console.info(`✅ Seed selesai dalam ${Date.now() - start}ms`);
console.info('\n📝 Login dev:');
console.info('   user: mr01 / dm01 / rsm01');
console.info('   pass: password');

process.exit(0);
