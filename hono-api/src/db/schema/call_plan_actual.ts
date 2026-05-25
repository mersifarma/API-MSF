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
  uniqueIndex,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { data_pegawai } from './data_pegawai';
import { list_dokter_visit_new } from './list_dokter_visit_new';

export const call_plan_actual = pgTable(
  'call_plan_actual',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    id_peg: integer('id_peg')
      .notNull()
      .references(() => data_pegawai.rowid),
    id_ff: varchar('id_ff', { length: 15 }).notNull(),
    nama_ff: varchar('nama_ff', { length: 200 }).notNull(),
    divisi: varchar('divisi', { length: 30 }),

    id_mcl: integer('id_mcl').references(() => list_dokter_visit_new.ID),
    nama_dokter: varchar('nama_dokter', { length: 150 }),
    spec: varchar('spec', { length: 50 }),
    segmen_md: integer('segmen_md'),
    class: varchar('class', { length: 5 }),
    institusi: varchar('institusi', { length: 200 }),
    alamat_praktek: varchar('alamat_praktek', { length: 250 }),
    koordinat_institusi: varchar('koordinat_institusi', { length: 100 }),

    tgl_plan: date('tgl_plan'),
    waktu: time('waktu'),
    product_list: text('product_list'),
    keterangan: varchar('keterangan', { length: 500 }),

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

    approval: varchar('approval', { length: 30 }),
    approval_by: integer('approval_by'),
    approval_date: timestamp('approval_date'),
    approval_comment: varchar('approval_comment', { length: 500 }),

    approval_actual: varchar('approval_actual', { length: 30 }),
    approval_actual_by: integer('approval_actual_by'),
    approval_actual_date: timestamp('approval_actual_date'),
    approval_actual_comment: varchar('approval_actual_comment', { length: 500 }),

    join_visit: smallint('join_visit').default(0),
    join_visit_ff: varchar('join_visit_ff', { length: 30 }),
    join_visit_id: uuid('join_visit_id').references((): AnyPgColumn => call_plan_actual.id),

    note: varchar('note', { length: 255 }),
    created_by: integer('created_by'),
    updated_by: integer('updated_by'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idx_cpa_unique: uniqueIndex('cpa_unique').on(t.id_peg, t.tgl_actual, t.id_mcl),
    idx_cpa_lookup: index('cpa_lookup_idx').on(
      t.id_peg,
      t.id_mcl,
      t.tgl_actual,
      t.approval_actual,
    ),
    idx_cpa_plan: index('cpa_plan_idx').on(t.id_peg, t.tgl_plan, t.approval),
    idx_cpa_join_window: index('cpa_join_window_idx').on(t.join_visit, t.updated_at),
  }),
);
