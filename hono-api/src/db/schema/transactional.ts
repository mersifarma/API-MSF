/**
 * TRANSACTIONAL TABLES — pure rewrite, fresh schema.
 *
 * Strategi:
 * - PK pakai UUID (uuid_generate_v4 / gen_random_uuid).
 * - Kolom + nullability + tipe mirror legacy MariaDB (clean port).
 * - FK ke MASTER tables (data_pegawai, list_dokter_visit_new) tetap INTEGER
 *   karena master mirror exact legacy IDs.
 * - Self-FK call_plan_actual.join_visit_id → UUID.
 * - Tambahan: created_at + updated_at sebagai timestamptz proper.
 * - Tidak ada sync dari MariaDB ke tabel ini — new mobile insert langsung.
 *
 * Catatan migrasi awal: pastikan extension `pgcrypto` aktif untuk
 * gen_random_uuid(). Drizzle akan emit `CREATE EXTENSION IF NOT EXISTS pgcrypto`
 * di migration kalau pakai defaultRandom().
 */

import {
  pgTable,
  integer,
  smallint,
  varchar,
  text,
  date,
  time,
  timestamp,
  uuid,
  boolean,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { data_pegawai, list_dokter_visit_new } from './master';

// ============================================================================
// call_list — daftar customer yang akan dikunjungi (planning awal bulan)
// ============================================================================
export const call_list = pgTable(
  'call_list',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    id_mcl: integer('id_mcl')
      .notNull()
      .references(() => list_dokter_visit_new.ID),
    periode: date('periode'),
    is_visited: boolean('is_visited').notNull().default(false),
    nama_dokter: varchar('nama_dokter', { length: 255 }).notNull(),
    spec: varchar('spec', { length: 255 }).notNull(),
    segmen: varchar('segmen', { length: 50 }).notNull(),
    class: varchar('class', { length: 5 }),
    target_visit: integer('target_visit'),
    wilayah: varchar('wilayah', { length: 30 }),
    id_peg: integer('id_peg')
      .notNull()
      .references(() => data_pegawai.rowid),
    id_ff: varchar('id_ff', { length: 15 }).notNull(),
    approval: varchar('approval', { length: 15 }),
    approval_by: integer('approval_by'),
    approval_date: timestamp('approval_date'),
    approval_comment: varchar('approval_comment', { length: 100 }),
    keterangan: varchar('keterangan', { length: 30 }),
    note: varchar('note', { length: 150 }),
    created_by: integer('created_by'),
    updated_by: integer('updated_by'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idx_call_list_unique: uniqueIndex('call_list_idx').on(t.id_mcl, t.periode, t.id_ff),
    idx_call_list_peg_periode: index('call_list_peg_periode_idx').on(t.id_peg, t.periode),
    idx_call_list_approval: index('call_list_approval_idx').on(t.id_peg, t.periode, t.approval),
  }),
);

// ============================================================================
// call_list_history — audit trail untuk update call_list
// ============================================================================
export const call_list_history = pgTable(
  'call_list_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    call_list_id: uuid('call_list_id')
      .notNull()
      .references(() => call_list.id, { onDelete: 'cascade' }),
    id_peg: integer('id_peg')
      .notNull()
      .references(() => data_pegawai.rowid),
    action_type: varchar('action_type', { length: 20 }).notNull(),
    action_date: timestamp('action_date', { withTimezone: true }).notNull().defaultNow(),
    old_id_mcl: integer('old_id_mcl'),
    new_id_mcl: integer('new_id_mcl'),
    old_nama_dokter: varchar('old_nama_dokter', { length: 255 }),
    new_nama_dokter: varchar('new_nama_dokter', { length: 255 }),
    old_spec: varchar('old_spec', { length: 255 }),
    new_spec: varchar('new_spec', { length: 255 }),
    old_class: varchar('old_class', { length: 5 }),
    new_class: varchar('new_class', { length: 5 }),
    old_segmen: varchar('old_segmen', { length: 50 }),
    new_segmen: varchar('new_segmen', { length: 50 }),
    old_wilayah: varchar('old_wilayah', { length: 30 }),
    new_wilayah: varchar('new_wilayah', { length: 30 }),
    old_target_visit: integer('old_target_visit'),
    new_target_visit: integer('new_target_visit'),
    reason: varchar('reason', { length: 255 }),
    ip_address: varchar('ip_address', { length: 45 }),
    user_agent: varchar('user_agent', { length: 255 }),
  },
  (t) => ({
    idx_clh_call_list: index('clh_call_list_idx').on(t.call_list_id),
    idx_clh_peg: index('clh_peg_idx').on(t.id_peg),
    idx_clh_date: index('clh_date_idx').on(t.action_date),
  }),
);

// ============================================================================
// call_plan_actual — tabel inti: plan + actual + approval (mirror struktur)
// ============================================================================
export const call_plan_actual = pgTable(
  'call_plan_actual',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Pemilik & target
    id_peg: integer('id_peg')
      .notNull()
      .references(() => data_pegawai.rowid),
    id_ff: varchar('id_ff', { length: 15 }).notNull(),
    nama_ff: varchar('nama_ff', { length: 200 }).notNull(),
    divisi: varchar('divisi', { length: 30 }),

    // Customer (snapshot dari list_dokter_visit_new)
    id_mcl: integer('id_mcl').references(() => list_dokter_visit_new.ID),
    nama_dokter: varchar('nama_dokter', { length: 150 }),
    spec: varchar('spec', { length: 50 }),
    segmen_md: integer('segmen_md'),
    class: varchar('class', { length: 5 }),
    institusi: varchar('institusi', { length: 200 }),
    alamat_praktek: varchar('alamat_praktek', { length: 250 }),
    koordinat_institusi: varchar('koordinat_institusi', { length: 100 }),

    // Plan
    tgl_plan: date('tgl_plan'),
    waktu: time('waktu'),
    product_list: text('product_list'), // JSON array — pertimbangkan ganti jsonb di iterasi berikut
    keterangan: varchar('keterangan', { length: 500 }),

    // Actual
    tgl_actual: date('tgl_actual'),
    waktu_actual: time('waktu_actual'),
    koor_visit: varchar('koor_visit', { length: 100 }),
    stt_koor: integer('stt_koor'),
    status: varchar('status', { length: 30 }),
    foto: varchar('foto', { length: 250 }),
    foto_link: varchar('foto_link', { length: 500 }),
    tanda_tangan: varchar('tanda_tangan', { length: 250 }),
    ttd_link: varchar('ttd_link', { length: 500 }),
    s3_upload_log: text('s3_upload_log'),

    // Approval Plan
    approval: varchar('approval', { length: 30 }),
    approval_by: integer('approval_by'),
    approval_date: timestamp('approval_date'),
    approval_comment: varchar('approval_comment', { length: 500 }),

    // Approval Actual
    approval_actual: varchar('approval_actual', { length: 30 }),
    approval_actual_by: integer('approval_actual_by'),
    approval_actual_date: timestamp('approval_actual_date'),
    approval_actual_comment: varchar('approval_actual_comment', { length: 500 }),

    // Join Visit
    join_visit: smallint('join_visit').default(0),
    join_visit_ff: varchar('join_visit_ff', { length: 30 }),
    join_visit_id: uuid('join_visit_id').references((): AnyPgColumn => call_plan_actual.id),

    // Audit
    note: varchar('note', { length: 255 }),
    created_by: integer('created_by'),
    updated_by: integer('updated_by'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idx_cpa_unique: uniqueIndex('cpa_unique').on(t.id_peg, t.tgl_actual, t.id_mcl),
    idx_cpa_lookup: index('cpa_lookup_idx').on(t.id_peg, t.id_mcl, t.tgl_actual, t.approval_actual),
    idx_cpa_plan: index('cpa_plan_idx').on(t.id_peg, t.tgl_plan, t.approval),
    idx_cpa_join_window: index('cpa_join_window_idx').on(t.join_visit, t.updated_at),
  }),
);

// ============================================================================
// visit_tidak_kunjungan — unvisit untuk non-MR
// ============================================================================
export const visit_tidak_kunjungan = pgTable(
  'visit_tidak_kunjungan',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    periode: varchar('periode', { length: 10 }).notNull(),
    week: varchar('week', { length: 10 }).notNull(),
    id_peg: integer('id_peg').references(() => data_pegawai.rowid),
    id_ff: varchar('id_ff', { length: 15 }),
    nama: varchar('nama', { length: 200 }),
    divisi: varchar('divisi', { length: 50 }),
    tanggal: date('tanggal'),
    alasan: varchar('alasan', { length: 50 }),
    keterangan: varchar('keterangan', { length: 500 }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idx_vtk_unique: uniqueIndex('vtk_peg_tanggal_unique').on(t.id_peg, t.tanggal),
  }),
);

// ============================================================================
// visit_tidak_kunjungan_mr — unvisit khusus MR/PS/KAE
// ============================================================================
export const visit_tidak_kunjungan_mr = pgTable(
  'visit_tidak_kunjungan_mr',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    periode: varchar('periode', { length: 10 }).notNull(),
    week: varchar('week', { length: 10 }).notNull(),
    id_peg: integer('id_peg').references(() => data_pegawai.rowid),
    id_ff: varchar('id_ff', { length: 15 }),
    nama: varchar('nama', { length: 200 }),
    divisi: varchar('divisi', { length: 50 }),
    tanggal: date('tanggal'),
    alasan: varchar('alasan', { length: 50 }),
    keterangan: varchar('keterangan', { length: 250 }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idx_vtk_mr_unique: uniqueIndex('vtk_mr_peg_tanggal_unique').on(t.id_peg, t.tanggal),
  }),
);

// Suppress unused warning for `sql` template (untuk reserved penggunaan masa depan)
export const _sql = sql;
