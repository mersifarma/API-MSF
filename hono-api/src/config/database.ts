import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { env } from './env';

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;

// Dipakai oleh tests/setup.ts untuk menutup pool sebelum DROP DATABASE.
// Di runtime normal (server) tidak perlu dipanggil — postgres.js auto-cleans on exit.
export async function closeDb() {
  await queryClient.end({ timeout: 5 });
}
