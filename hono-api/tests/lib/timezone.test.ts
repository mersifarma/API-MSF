import { describe, expect, it } from 'bun:test';
import { sudahLewatJamWIB, todayWIB } from '../../src/lib/timezone';

describe('sudahLewatJamWIB', () => {
  it('false ketika WIB time tepat 09:00 (sebelum batas 10)', () => {
    // 09:00 WIB = 02:00 UTC
    const now = new Date('2026-05-22T02:00:00Z');
    expect(sudahLewatJamWIB(10, now)).toBe(false);
  });

  it('false ketika WIB time tepat 10:00:00 (jam pas, menit 0 — match legacy "menit > 0")', () => {
    // 10:00 WIB = 03:00 UTC
    const now = new Date('2026-05-22T03:00:00Z');
    expect(sudahLewatJamWIB(10, now)).toBe(false);
  });

  it('true ketika WIB time 10:00:01 (menit masih 0 tapi detik > 0?)', () => {
    // Note: legacy "menit > 0" tidak considers seconds. Kita pakai menit only.
    // 10:00:30 WIB = 03:00:30 UTC → menit=0 → masih BELUM lewat
    const now = new Date('2026-05-22T03:00:30Z');
    expect(sudahLewatJamWIB(10, now)).toBe(false);
  });

  it('true ketika WIB time 10:01 (menit > 0 di jam batas)', () => {
    // 10:01 WIB = 03:01 UTC
    const now = new Date('2026-05-22T03:01:00Z');
    expect(sudahLewatJamWIB(10, now)).toBe(true);
  });

  it('true ketika WIB time 11:00 (jam > batas)', () => {
    // 11:00 WIB = 04:00 UTC
    const now = new Date('2026-05-22T04:00:00Z');
    expect(sudahLewatJamWIB(10, now)).toBe(true);
  });

  it('false ketika WIB time 00:30 (lewat tengah malam, jam << batas)', () => {
    // 00:30 WIB = 17:30 UTC sehari sebelumnya
    const now = new Date('2026-05-21T17:30:00Z');
    expect(sudahLewatJamWIB(10, now)).toBe(false);
  });
});

describe('todayWIB', () => {
  it('returns date sesuai zona WIB (UTC+7) — rollover di 17:00 UTC', () => {
    // 16:59 UTC = 23:59 WIB hari yang sama
    expect(todayWIB(new Date('2026-05-22T16:59:00Z'))).toBe('2026-05-22');
    // 17:00 UTC = 00:00 WIB keesokan hari
    expect(todayWIB(new Date('2026-05-22T17:00:00Z'))).toBe('2026-05-23');
  });
});
