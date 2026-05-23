/**
 * Timezone helpers untuk MSF — semua waktu efektif dihitung di WIB (UTC+7).
 *
 * Tidak pakai library timezone. Kita pakai arithmetic UTC karena MSF hanya
 * beroperasi di satu zona waktu (Asia/Jakarta).
 *
 * Convention: `now` selalu opsional dengan default `new Date()` supaya
 * gampang di-inject untuk testing.
 */

const WIB_OFFSET_HOURS = 7;
const WIB_OFFSET_MS = WIB_OFFSET_HOURS * 3_600_000;

/**
 * Tanggal "today" di WIB, format 'YYYY-MM-DD'.
 */
export function todayWIB(now: Date = new Date()): string {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  return wib.toISOString().slice(0, 10);
}

/**
 * Combine 'YYYY-MM-DD' + 'HH:MM[:SS]' (di WIB) ke Date UTC.
 *
 * Throw RangeError kalau format invalid.
 */
export function parseDateTimeWIB(date: string, time: string): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dateMatch) {
    throw new RangeError(`Invalid date format: '${date}'. Expected 'YYYY-MM-DD'.`);
  }
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!timeMatch) {
    throw new RangeError(`Invalid time format: '${time}'. Expected 'HH:MM' or 'HH:MM:SS'.`);
  }
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = timeMatch[3] ? Number(timeMatch[3]) : 0;
  // Date.UTC normalisasi negative hour-offset jadi hari sebelumnya.
  return new Date(Date.UTC(year, month - 1, day, hour - WIB_OFFSET_HOURS, minute, second, 0));
}

/**
 * Selisih waktu (`a − b`) dalam menit, integer (floor).
 * Negatif kalau `a` lebih dulu dari `b`.
 */
export function diffMinutes(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 60_000);
}

/**
 * Cek apakah waktu sekarang (di WIB) sudah lewat jam `batasJam`.
 *
 * Match legacy `sudahLewatJam(int $batasJam)`:
 *   ($now->hour > $batasJam) || ($now->hour === $batasJam && $now->minute > 0)
 *
 * → strict-greater pada jam, tapi `> 0` pada menit (jadi tepat `HH:00:00`
 *   masih dianggap **belum** lewat).
 */
export function sudahLewatJamWIB(batasJam: number, now: Date = new Date()): boolean {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const hour = wib.getUTCHours();
  const minute = wib.getUTCMinutes();
  return hour > batasJam || (hour === batasJam && minute > 0);
}
