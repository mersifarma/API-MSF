import { pgTable, integer, varchar, date } from 'drizzle-orm/pg-core';

export const call_target_list = pgTable('call_target_list', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  jabatan: varchar('jabatan', { length: 20 }).notNull(),
  divisi: varchar('divisi', { length: 50 }).notNull(),
  dokter: integer('dokter').notNull(),
  non_dokter: integer('non_dokter'),
  periode_awal: date('periode_awal'),
  periode_akhir: date('periode_akhir'),
});
