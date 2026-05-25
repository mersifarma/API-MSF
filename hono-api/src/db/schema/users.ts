import { pgTable, bigint, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    name: varchar('name', { length: 255 }).notNull(),
    username: varchar('username', { length: 150 }).notNull(),
    status: varchar('status', { length: 15 }),
    email: varchar('email', { length: 255 }),
    email_verified_at: timestamp('email_verified_at'),
    password: varchar('password', { length: 255 }).notNull(),
    password_view: varchar('password_view', { length: 100 }),
    remember_token: varchar('remember_token', { length: 100 }),
    created_at: timestamp('created_at'),
    updated_at: timestamp('updated_at'),
  },
  (t) => ({
    username_unique: uniqueIndex('users_username_unique').on(t.username),
  }),
);
