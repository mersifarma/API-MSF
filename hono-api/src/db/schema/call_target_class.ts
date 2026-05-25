import { pgTable, integer, varchar, index } from 'drizzle-orm/pg-core';

export const call_target_class = pgTable(
  'call_target_class',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    jabatan: varchar('jabatan', { length: 15 }).notNull(),
    class: varchar('class', { length: 5 }).notNull(),
    target: integer('target').notNull(),
  },
  (t) => ({
    idx_ctc: index('idx_call_target_class').on(t.jabatan, t.class),
  }),
);
