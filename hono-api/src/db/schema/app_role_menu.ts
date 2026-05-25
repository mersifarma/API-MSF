import { pgTable, integer, uniqueIndex } from 'drizzle-orm/pg-core';

export const app_role_menu = pgTable(
  'app_role_menu',
  {
    id_role: integer('id_role').primaryKey().generatedByDefaultAsIdentity(),
    id_menu: integer('id_menu').notNull(),
    id_modul: integer('id_modul').notNull(),
    id_user: integer('id_user').notNull(),
  },
  (t) => ({
    idx_role_unique: uniqueIndex('app_role_menu_unique').on(t.id_menu, t.id_modul, t.id_user),
  }),
);
