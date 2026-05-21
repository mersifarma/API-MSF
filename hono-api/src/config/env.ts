import { z } from 'zod';

const envSchema = z.object({
  // Database (Postgres target)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
