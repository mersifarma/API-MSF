import { z } from 'zod';

const envSchema = z.object({
  // Database (Postgres target)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Database legacy (MariaDB) — opsional, hanya dipakai oleh `src/scripts/sync-master.ts`.
  // Format: mysql://user:pass@host:port/dbname
  LEGACY_MARIADB_URL: z.string().min(1).optional(),

  // Auth — JWT signing
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars (dev: any random string)'),
  JWT_EXPIRES_IN: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7), // 7 hari

  // App
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // S3 — untuk upload media (foto kunjungan, tanda tangan, dokumen).
  // Default ke kosong string supaya environment test/dev tanpa S3 tidak crash.
  // Endpoint upload akan error keras kalau credentials tidak set di runtime.
  AWS_S3_ENDPOINT: z.string().min(1, 'AWS_S3_ENDPOINT is required').default(''),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required').default(''),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required').default(''),
  AWS_REGION: z.string().min(1, 'AWS_REGION is required').default('us-east-1'),
  AWS_S3_BUCKET: z.string().min(1, 'AWS_S3_BUCKET is required').default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
