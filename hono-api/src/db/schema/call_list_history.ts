import { pgTable, integer, varchar, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { call_list } from './call_list';
import { data_pegawai } from './data_pegawai';

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
