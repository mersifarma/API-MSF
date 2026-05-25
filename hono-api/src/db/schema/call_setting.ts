import { pgTable, integer, varchar, timestamp } from 'drizzle-orm/pg-core';

export const call_setting = pgTable('call_setting', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  user: integer('user'),
  nama: varchar('nama', { length: 75 }),
  bulan: varchar('bulan', { length: 20 }),
  input_set: varchar('input_set', { length: 50 }),
  jumlah: integer('jumlah'),
  created_date: timestamp('created_date'),
  created_by: integer('created_by'),
  updated_date: timestamp('updated_date'),
  updated_by: integer('updated_by'),
});
