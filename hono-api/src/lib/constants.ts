/**
 * MSF business constants.
 *
 * Diisi on-demand saat feature relevan dibuat — sengaja sparse di awal.
 * Sumber referensi: legacy/app/Http/Controllers/api_server/Api/*.php
 *                   legacy/DOCS-BACKEND/06-business-logic.md
 */

// ---------- Call List deadline ----------

// Maksimal hari kerja awal bulan boleh add call_list.
// Sabtu/Minggu di-skip saat hitung. Set OVERRIDE_BULAN_LIST untuk bypass periode tertentu.
export const BATAS_HARI_KERJA_LIST = 5;

// Format 'YYYY-MM'. Jika di-set sama dengan periode, deadline di-bypass.
// Bisa di-override via env OVERRIDE_BULAN_LIST.
export const OVERRIDE_BULAN_LIST: string | null = process.env.OVERRIDE_BULAN_LIST?.trim() || null;

// ---------- Join visit ----------

// Radius GPS validasi atasan vs MR (meter).
export const JOIN_VISIT_RADIUS_METERS = 100;

// ---------- Call Actual offline window ----------

// Untuk visit dengan status mengandung 'offline': maksimum selisih waktu antara
// (tgl_actual + waktu_actual) dengan now() di TZ Asia/Jakarta, dalam menit.
// Lebih dari ini → tolak dengan VISIT_TIME_EXPIRED.
export const OFFLINE_VISIT_WINDOW_MINUTES = 60;

// ---------- Approval Call Plan ----------

// Batas jam (WIB) approval call plan untuk tgl_plan hari ini.
// tgl_plan > today    → boleh approve kapan saja
// tgl_plan === today  → boleh hanya sebelum jam BATAS_JAM_PLAN
// tgl_plan < today    → expired
export const BATAS_JAM_PLAN = 10;

// ---------- Approval Call Actual ----------

// Jumlah hari setelah tgl_actual yang masih boleh di-approve.
// jarak (today - tgl_actual) = 0      → kapan saja
// jarak = BATAS_HARI_ACTUAL (1)       → boleh hanya sebelum BATAS_JAM_ACTUAL
// jarak > BATAS_HARI_ACTUAL           → expired
// Catatan: jika today Sunday → +2 extraDays, Monday → +3 extraDays
// (skip-weekend supaya tidak ada window hilang).
export const BATAS_HARI_ACTUAL = 1;
export const BATAS_JAM_ACTUAL = 10;

// ---------- Konstanta yang akan ditambah saat cluster terkait diport ----------
// NOTIFICATION_INTERVAL_MINUTES  (Cluster 5 — polling notif; prod 30, testing 1)
