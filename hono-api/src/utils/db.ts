/**
 * Database utility helpers — share-able antara seed.ts, restore-from-dump.ts,
 * dan sync-master.ts.
 */

import { sql } from 'drizzle-orm';
import { db } from '../config/database';

/**
 * Sinkronkan identity sequence ke MAX(column) supaya INSERT berikutnya
 * (tanpa ID eksplisit) tidak collision dengan ID yang sudah di-insert manual.
 *
 * Pakai setelah seed/restore yang menulis ID eksplisit ke kolom identity.
 */
export async function resetSequence(table: string, column: string): Promise<void> {
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence(${table}, ${column}),
      COALESCE((SELECT MAX(${sql.raw(`"${column}"`)}) FROM ${sql.raw(`"${table}"`)}), 1),
      true
    )
  `);
}
