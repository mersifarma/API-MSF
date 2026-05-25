import { pgTable, integer, varchar, uniqueIndex } from 'drizzle-orm/pg-core';

export const data_spec_dr = pgTable(
  'data_spec_dr',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    spec: varchar('spec', { length: 50 }).notNull(),
    gelar: varchar('gelar', { length: 20 }),
    keterangan: varchar('keterangan', { length: 50 }),
  },
  (t) => ({
    spec_unique: uniqueIndex('data_spec_dr_unique').on(t.spec),
  }),
);
