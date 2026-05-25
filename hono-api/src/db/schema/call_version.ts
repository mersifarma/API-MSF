import { pgTable, integer, varchar } from 'drizzle-orm/pg-core';

export const call_version = pgTable('call_version', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  version: varchar('version', { length: 20 }),
  link_apk: varchar('link_apk', { length: 100 }),
});
