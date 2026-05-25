/**
 * MSF business constants — nilai dari legacy api_DEV controllers (BEDA dari production).
 * Source: legacy/app/Http/Controllers/api_DEV/*.php
 */

// Call List add: maksimum hari kerja awal bulan (Sat/Sun skip).
export const BATAS_HARI_KERJA_LIST = 30;

// Override periode bypass deadline. Format 'YYYY-MM'. Bisa via env.
export const OVERRIDE_BULAN_LIST: string | null = process.env.OVERRIDE_BULAN_LIST?.trim() || null;

// Approval Call Plan: batas jam (WIB) untuk approve plan dengan tgl_plan = hari ini.
export const BATAS_JAM_PLAN = 23;

// Approval Call Actual: jarak hari kerja maksimum dari tgl_actual.
export const BATAS_HARI_ACTUAL = 4;
export const BATAS_JAM_ACTUAL = 10;

// Notification polling interval (menit). api_DEV testing = 1; production = 30.
export const NOTIFICATION_INTERVAL_MINUTES = 1;

// Join visit: radius GPS validasi atasan vs MR (meter).
export const JOIN_VISIT_RADIUS_METERS = 120;
