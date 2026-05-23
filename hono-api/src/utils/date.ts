/**
 * Utility tanggal untuk MSF.
 *
 * Konvensi: semua periode dan deadline dihitung dalam zona Asia/Jakarta (WIB, UTC+7).
 * Kita tidak pakai library timezone — cukup arithmetic UTC karena MSF hanya operasi
 * di satu zona waktu.
 */

const WIB_OFFSET_HOURS = 7;

const PERIODE_RE = /^(\d{4})-(\d{2})$/;

/**
 * Parse periode 'YYYY-MM' menjadi Date yang merepresentasikan midnight WIB
 * pada tanggal 1 bulan tersebut.
 *
 * Throw RangeError kalau format invalid atau bulan di luar 1-12.
 */
export function parsePeriode(s: string): Date {
  const match = PERIODE_RE.exec(s);
  if (!match) {
    throw new RangeError(`Invalid periode format: '${s}'. Expected 'YYYY-MM'.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new RangeError(`Invalid month in periode: '${s}'.`);
  }
  // Midnight WIB on first of month = (0 - 7) UTC = -7h UTC, which Date.UTC normalizes
  // to the previous day at 17:00 UTC. Both representations are equivalent.
  return new Date(Date.UTC(year, month - 1, 1, -WIB_OFFSET_HOURS, 0, 0, 0));
}

/**
 * Format Date menjadi periode 'YYYY-MM' (berdasarkan WIB).
 */
export function formatPeriode(d: Date): string {
  const wib = new Date(d.getTime() + WIB_OFFSET_HOURS * 3_600_000);
  const year = wib.getUTCFullYear();
  const month = String(wib.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Periode WIB sekarang.
 */
export function currentPeriode(now: Date = new Date()): string {
  return formatPeriode(now);
}

/**
 * Day-of-week (0=Sunday, 6=Saturday) untuk tanggal kalender Y/M/D (WIB).
 * Tidak terpengaruh timezone — pure date math.
 */
export function dayOfWeek(year: number, monthZeroBased: number, day: number): number {
  return new Date(Date.UTC(year, monthZeroBased, day)).getUTCDay();
}

/**
 * Akhir hari WIB (23:59:59.999 WIB) untuk tanggal Y/M/D, dikembalikan sebagai Date UTC.
 */
export function endOfDayWIB(year: number, monthZeroBased: number, day: number): Date {
  // 23:59:59.999 WIB = (23-7=16):59:59.999 UTC pada hari yang sama.
  return new Date(Date.UTC(year, monthZeroBased, day, 23 - WIB_OFFSET_HOURS, 59, 59, 999));
}
