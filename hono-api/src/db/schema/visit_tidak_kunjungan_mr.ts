import { pgTable, integer, varchar, date, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { data_pegawai } from './data_pegawai';

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
