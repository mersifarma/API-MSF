/**
 * Deadline helper untuk Call List.
 *
 * Port dari legacy `VisitController::hitungDeadlineHariKerja()`. Lihat
 * legacy/DOCS-BACKEND/06-business-logic.md §2.2 untuk aturan lengkapnya.
 *
 * Hari kerja = Senin–Jumat. Sabtu & Minggu di-skip saat menghitung.
 */

import { BATAS_HARI_KERJA_LIST, OVERRIDE_BULAN_LIST } from './constants';
import { dayOfWeek, endOfDayWIB, formatPeriode, parsePeriode } from '../utils/date';

/**
 * Hitung tanggal hari kerja ke-N (1-based) dimulai dari `periodeAwal` (inklusif).
 * Mengembalikan Date pada akhir hari WIB (23:59:59.999 WIB) — pas untuk dipakai
 * sebagai cutoff "deadline".
 *
 * Contoh:
 *   periodeAwal = 2026-05-01 (Jumat), n = 5
 *   → working days: Fri 1, Mon 4, Tue 5, Wed 6, Thu 7
 *   → return 2026-05-07T23:59:59.999 WIB
 */
export function hitungDeadlineHariKerja(periodeAwal: Date, n: number): Date {
  if (n < 1) {
    throw new RangeError(`n must be >= 1, got ${n}`);
  }

  // Pisahkan ke kalender WIB
  const wibStart = new Date(periodeAwal.getTime() + 7 * 3_600_000);
  let year = wibStart.getUTCFullYear();
  let monthZeroBased = wibStart.getUTCMonth();
  let day = wibStart.getUTCDate();

  let count = 0;
  // Safety: max iterasi 60 hari (cukup untuk n <= ~40 hari kerja).
  for (let i = 0; i < 60; i++) {
    const dow = dayOfWeek(year, monthZeroBased, day);
    if (dow !== 0 && dow !== 6) {
      count++;
      if (count >= n) {
        return endOfDayWIB(year, monthZeroBased, day);
      }
    }
    // Increment day; biarkan Date normalisasi rollover bulan/tahun
    const next = new Date(Date.UTC(year, monthZeroBased, day + 1));
    year = next.getUTCFullYear();
    monthZeroBased = next.getUTCMonth();
    day = next.getUTCDate();
  }
  throw new Error(`Deadline calc overflow: n=${n} terlalu besar`);
}

/**
 * Apakah deadline add call_list untuk `periode` ('YYYY-MM') sudah lewat?
 *
 * - Override aktif (OVERRIDE_BULAN_LIST === periode) → return false.
 * - Lainnya → bandingkan now() dengan deadline hari kerja ke-BATAS_HARI_KERJA_LIST.
 */
export function isCallListDeadlinePassed(periode: string, now: Date = new Date()): boolean {
  if (OVERRIDE_BULAN_LIST && OVERRIDE_BULAN_LIST === periode) {
    return false;
  }
  const awal = parsePeriode(periode);
  // Deadline hanya berlaku untuk periode "bulan ini". Untuk bulan masa depan
  // selalu boleh (deadline belum mulai); untuk bulan lalu selalu lewat.
  const periodeNow = formatPeriode(now);
  if (periode > periodeNow) return false;
  if (periode < periodeNow) return true;
  const deadline = hitungDeadlineHariKerja(awal, BATAS_HARI_KERJA_LIST);
  return now.getTime() > deadline.getTime();
}
