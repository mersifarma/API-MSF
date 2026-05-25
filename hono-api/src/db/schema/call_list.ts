import {
  pgTable,
  integer,
  varchar,
  date,
  timestamp,
  uuid,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { data_pegawai } from './data_pegawai';
import { list_dokter_visit_new } from './list_dokter_visit_new';

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
