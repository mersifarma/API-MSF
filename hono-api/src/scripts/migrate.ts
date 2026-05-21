/**
 * Programmatic migration runner.
 *
 * Pakai ini di production / CI:
 *   bun run db:migrate
 *
 * Untuk dev sehari-hari boleh tetap `bun run db:push` (cepat, skip file migration).
 *
 * Migration files digenerate dari schema TS via:
 *   bun run db:generate
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Migration butuh koneksi terpisah (max:1, no pooling) supaya advisory lock konsisten.
const migrationClient = postgres(connectionString, { max: 1 });

const start = Date.now();
console.info('⏳ Running migrations from ./drizzle/migrations ...');

await migrate(drizzle(migrationClient), {
  migrationsFolder: './drizzle/migrations',
});

console.info(`✅ Migrations applied in ${Date.now() - start}ms`);
await migrationClient.end();
process.exit(0);
