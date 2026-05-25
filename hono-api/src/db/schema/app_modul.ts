import { pgTable, integer, varchar, uniqueIndex } from 'drizzle-orm/pg-core';

export const app_modul = pgTable(
  'app_modul',
  {
    id_modul: integer('id_modul').primaryKey().generatedByDefaultAsIdentity(),
    nama_modul: varchar('nama_modul', { length: 25 }).notNull(),
    icons: varchar('icons', { length: 30 }).notNull(),
    icons2: varchar('icons2', { length: 30 }),
    color: varchar('color', { length: 20 }),
  },
  (t) => ({
    nama_modul_unique: uniqueIndex('app_modul_nama_unique').on(t.nama_modul),
  }),
);
