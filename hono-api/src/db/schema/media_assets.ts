import {
  pgTable,
  uuid,
  varchar,
  bigint,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { data_pegawai } from './data_pegawai';

export const media_assets = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    asset_type: varchar('asset_type', { length: 30 }).notNull(),
    original_name: varchar('original_name', { length: 255 }).notNull(),
    s3_key: varchar('s3_key', { length: 500 }).notNull(),
    url: varchar('url', { length: 1000 }).notNull(),
    mime_type: varchar('mime_type', { length: 100 }).notNull(),
    size_bytes: bigint('size_bytes', { mode: 'number' }),
    title: varchar('title', { length: 255 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    created_by: integer('created_by')
      .notNull()
      .references(() => data_pegawai.rowid),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    is_deleted: boolean('is_deleted').notNull().default(false),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    deleted_by: integer('deleted_by').references(() => data_pegawai.rowid),
  },
  (t) => ({
    idx_media_assets_created_by: index('media_assets_created_by_idx').on(t.created_by),
    idx_media_assets_status: index('media_assets_status_idx').on(t.status, t.is_deleted),
    idx_media_assets_type: index('media_assets_type_idx').on(t.asset_type, t.is_deleted),
  }),
);
