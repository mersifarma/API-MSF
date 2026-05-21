/**
 * MSF business constants.
 *
 * Diisi on-demand saat feature relevan dibuat — sengaja sparse di awal.
 * Sumber referensi: legacy/app/Http/Controllers/api_server/Api/*.php
 *                   legacy/DOCS-BACKEND/06-business-logic.md
 */

// Deadline rules untuk Call Plan / Actual.
// Dipakai di lib/deadline.ts (TODO saat feature plan/actual diport).
//
// export const BATAS_HARI_KERJA_LIST = 5
// export const BATAS_JAM_PLAN = 10
// export const BATAS_HARI_ACTUAL = 1
// export const BATAS_JAM_ACTUAL = 10

// Polling notification interval.
// Catatan: legacy production = 1 menit (testing value), prod harus 30.
//
// export const NOTIFICATION_INTERVAL_MINUTES = 30

export {};
