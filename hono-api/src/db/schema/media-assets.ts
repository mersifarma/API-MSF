/**
 * MEDIA ASSETS — generic file/image upload registry.
 *
 * Lifecycle:
 *   1. Mobile request POST /api/upload/presign → row INSERT dengan status='pending',
 *      server return presigned URL ke S3.
 *   2. Mobile PUT file langsung ke S3 via presigned URL.
 *   3. Mobile POST /api/upload/:id/confirm → status='active'.
 *   4. Asset URL bisa di-attach ke entity lain (call_plan_actual.foto, dst.).
 *
 * Catatan: PK uuid (konvensi transactional). `created_by` FK ke
 * `data_pegawai.rowid` (id_peg) — konsisten dengan tabel transactional lain.
 *
 * Soft delete via `is_deleted` + `deleted_at` + `deleted_by` supaya tidak
 * memutus reference dari row-row yang sudah pakai asset ini.
 */

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
import { data_pegawai } from './master';

export const media_assets = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Type bucket: 'image' | 'document' | 'presentation' | 'spreadsheet'.
    // Tidak pakai enum supaya bisa diperluas tanpa migration.
    asset_type: varchar('asset_type', { length: 30 }).notNull(),

    // Original filename (sebelum di-rename ke s3_key).
    original_name: varchar('original_name', { length: 255 }).notNull(),

    // S3 object key (path relatif di bucket): "uploads/{type}/{id_peg}/{ts}-{nanoid}.{ext}".
    s3_key: varchar('s3_key', { length: 500 }).notNull(),

    // Full URL (endpoint + bucket + key) — di-cache supaya client tidak perlu re-build.
    url: varchar('url', { length: 1000 }).notNull(),

    mime_type: varchar('mime_type', { length: 100 }).notNull(),

    // Optional: ukuran file dalam bytes. Bisa null kalau client tidak kirim.
    size_bytes: bigint('size_bytes', { mode: 'number' }),

    // Optional: judul/caption asset (mis. nama dokumen).
    title: varchar('title', { length: 255 }),

    // Lifecycle status: 'pending' (presigned, belum upload), 'active' (confirmed).
    status: varchar('status', { length: 20 }).notNull().default('pending'),

    // Audit
    created_by: integer('created_by')
      .notNull()
      .references(() => data_pegawai.rowid),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    // Soft delete
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

export type MediaAsset = typeof media_assets.$inferSelect;
export type NewMediaAsset = typeof media_assets.$inferInsert;
