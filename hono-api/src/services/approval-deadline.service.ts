/**
 * Helper deadline khusus untuk Approval Call List.
 *
 * Port dari legacy VisitApprovalController lines 137-159, 309-352, 395-448.
 * Mendukung **per-user override** via tabel `call_setting` (input_set
 * 'Approval Call List') dengan fallback ke konstanta global
 * `BATAS_HARI_KERJA_LIST`.
 *
 * Catatan: untuk Call List **create** flow (MR submit), pakai
 * `src/lib/deadline.ts` (global constant only). Endpoint approval boleh
 * punya deadline berbeda per approver — itulah alasannya helper terpisah.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '../config/database';
import { call_setting, data_pegawai } from '../db/schema/master';
import { BATAS_HARI_KERJA_LIST, OVERRIDE_BULAN_LIST } from '../lib/constants';
import { hitungDeadlineHariKerja } from '../lib/deadline';
import { formatPeriode, parsePeriode } from '../utils/date';

const APPROVAL_LIST_INPUT_SET = 'Approval Call List';

/**
 * Lookup `call_setting.jumlah` untuk approver tertentu.
 *
 * Match via: `data_pegawai.rowid = approverIdPeg`
 *        AND `call_setting.user = data_pegawai.id_user`
 *        AND `call_setting.input_set = 'Approval Call List'`
 *
 * Return `null` kalau tidak ada → caller pakai `BATAS_HARI_KERJA_LIST`.
 */
export async function getApprovalDaysSetting(approverIdPeg: number): Promise<number | null> {
  const [row] = await db
    .select({ jumlah: call_setting.jumlah })
    .from(call_setting)
    .innerJoin(data_pegawai, eq(data_pegawai.id_user, call_setting.user))
    .where(
      and(
        eq(data_pegawai.rowid, approverIdPeg),
        eq(call_setting.input_set, APPROVAL_LIST_INPUT_SET),
      ),
    )
    .limit(1);
  return row?.jumlah ?? null;
}

/**
 * Deadline approval untuk approver pada periode tertentu.
 *
 * - `OVERRIDE_BULAN_LIST === periode` → return `null` (no deadline, bypass).
 * - Lainnya → hitung deadline hari kerja ke-N (N = setting override atau global).
 */
export async function getApprovalListDeadline(
  approverIdPeg: number,
  periode: string,
): Promise<Date | null> {
  if (OVERRIDE_BULAN_LIST && OVERRIDE_BULAN_LIST === periode) {
    return null;
  }
  const n = (await getApprovalDaysSetting(approverIdPeg)) ?? BATAS_HARI_KERJA_LIST;
  const awal = parsePeriode(periode);
  return hitungDeadlineHariKerja(awal, n);
}

/**
 * Apakah deadline approval untuk approver+periode sudah lewat?
 *
 * - Periode di masa depan → `false` (belum mulai, jangan blokir).
 * - Periode di masa lalu → `true`.
 * - Periode bulan ini → bandingkan `now` dengan deadline.
 * - `OVERRIDE_BULAN_LIST === periode` → `false`.
 */
export async function isApprovalListDeadlinePassed(
  approverIdPeg: number,
  periode: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (OVERRIDE_BULAN_LIST && OVERRIDE_BULAN_LIST === periode) {
    return false;
  }
  const periodeNow = formatPeriode(now);
  if (periode > periodeNow) return false;
  if (periode < periodeNow) return true;

  const deadline = await getApprovalListDeadline(approverIdPeg, periode);
  if (deadline === null) return false;
  return now.getTime() > deadline.getTime();
}
