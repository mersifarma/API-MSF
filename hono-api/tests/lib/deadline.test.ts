import { describe, expect, it } from 'bun:test';
import { hitungDeadlineHariKerja, isCallListDeadlinePassed } from '../../src/lib/deadline';
import { parsePeriode } from '../../src/utils/date';

describe('hitungDeadlineHariKerja', () => {
  it('returns 5th working day starting from Friday 2026-05-01', () => {
    // 2026-05-01 = Friday. Working days: Fri 1, Mon 4, Tue 5, Wed 6, Thu 7.
    const awal = parsePeriode('2026-05');
    const deadline = hitungDeadlineHariKerja(awal, 5);
    // 23:59:59.999 WIB = 16:59:59.999 UTC pada tanggal yang sama
    expect(deadline.toISOString()).toBe('2026-05-07T16:59:59.999Z');
  });

  it('skips Saturday and Sunday', () => {
    // 2026-02-01 = Sunday → working day 1 = Mon 2 Feb, day 5 = Fri 6 Feb
    const awal = parsePeriode('2026-02');
    const deadline = hitungDeadlineHariKerja(awal, 5);
    expect(deadline.toISOString()).toBe('2026-02-06T16:59:59.999Z');
  });

  it('handles starting on Thursday — same week', () => {
    // 2026-01-01 = Thursday → day 1 Thu 1, day 5 Wed 7 (skip Sat 3, Sun 4)
    const awal = parsePeriode('2026-01');
    const deadline = hitungDeadlineHariKerja(awal, 5);
    expect(deadline.toISOString()).toBe('2026-01-07T16:59:59.999Z');
  });

  it('supports n=1 (first working day)', () => {
    const awal = parsePeriode('2026-05'); // Friday
    const deadline = hitungDeadlineHariKerja(awal, 1);
    expect(deadline.toISOString()).toBe('2026-05-01T16:59:59.999Z');
  });

  it('throws on n < 1', () => {
    const awal = parsePeriode('2026-05');
    expect(() => hitungDeadlineHariKerja(awal, 0)).toThrow();
  });
});

describe('isCallListDeadlinePassed', () => {
  it('returns true when now > deadline within same periode', () => {
    // periode = 2026-05, deadline = 2026-05-07 23:59:59 WIB
    // simulate "now" = 2026-05-15 (jelas lewat)
    const now = new Date('2026-05-15T00:00:00Z');
    expect(isCallListDeadlinePassed('2026-05', now)).toBe(true);
  });

  it('returns false when now < deadline within same periode', () => {
    // simulate "now" = 2026-05-03 (Sunday, deadline jatuh 2026-05-07)
    const now = new Date('2026-05-03T00:00:00Z');
    expect(isCallListDeadlinePassed('2026-05', now)).toBe(false);
  });

  it('returns false for periode masa depan (deadline belum mulai)', () => {
    const now = new Date('2026-05-15T00:00:00Z');
    expect(isCallListDeadlinePassed('2026-12', now)).toBe(false);
  });

  it('returns true for periode bulan lalu', () => {
    const now = new Date('2026-05-15T00:00:00Z');
    expect(isCallListDeadlinePassed('2026-04', now)).toBe(true);
  });
});
