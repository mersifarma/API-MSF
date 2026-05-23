/**
 * Service untuk resolve hierarki organisasi via tabel `struktur`.
 *
 * Tabel `struktur` menyimpan satu row per (MR × periode). Tiap row punya
 * referensi id_peg_mr / id_peg_dm / id_peg_rsm / id_peg_mm. Untuk lihat data
 * "milik bawahan", supervisor (DM/RSM/MM) butuh kumpulan id_peg downstream-nya.
 *
 * Helper yang reusable di banyak feature (master dokter list, approval list, dll.).
 */

import { and, eq, gte, isNotNull, lte, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../config/database';
import { data_pegawai, struktur } from '../db/schema/master';

/**
 * Return list id_peg yang "boleh dilihat" oleh user dengan (idPeg, jabatan).
 *
 * - MR / staff lain → return [idPeg]
 * - DM → idPeg + semua id_peg_mr di bawah DM ini pada periode aktif
 * - RSM → idPeg + semua id_peg_dm + id_peg_mr di bawah pada periode aktif
 * - MM → idPeg + semua id_peg_rsm + id_peg_dm + id_peg_mr di bawah pada periode aktif
 *
 * Periode aktif = `refDate` berada di antara periode_awal..periode_akhir.
 */
export async function getVisibleIdPeg(
  idPeg: number,
  jabatan: string,
  refDate: Date = new Date(),
): Promise<number[]> {
  const upper = (jabatan ?? '').toUpperCase();
  if (upper !== 'DM' && upper !== 'RSM' && upper !== 'MM') {
    return [idPeg];
  }

  const refIso = refDate.toISOString().slice(0, 10);
  const ownership =
    upper === 'DM'
      ? eq(struktur.id_peg_dm, idPeg)
      : upper === 'RSM'
        ? eq(struktur.id_peg_rsm, idPeg)
        : or(eq(struktur.id_peg_mm, idPeg), eq(struktur.id_peg_rsm, idPeg));

  const rows = await db
    .select({
      mr: struktur.id_peg_mr,
      dm: struktur.id_peg_dm,
      rsm: struktur.id_peg_rsm,
    })
    .from(struktur)
    .where(and(lte(struktur.periode_awal, refIso), gte(struktur.periode_akhir, refIso), ownership));

  const out = new Set<number>([idPeg]);
  for (const r of rows) {
    if (r.mr) out.add(r.mr);
    if (upper === 'RSM' || upper === 'MM') {
      if (r.dm) out.add(r.dm);
    }
    if (upper === 'MM') {
      if (r.rsm) out.add(r.rsm);
    }
  }
  return [...out];
}

/**
 * Return semua `data_pegawai.rowid` yang dimiliki oleh `id_user` yang sama
 * dengan `idPeg`. Status pegawai non-null harus tidak 'inactive'/'keluar' —
 * legacy pakai `IFNULL(status,'exist') = 'exist'`. Kita filter `status` IS NULL
 * OR status NOT IN ('keluar','inactive') tapi karena varian banyak, paling
 * aman: include semua kecuali yang eksplisit di-mark keluar.
 *
 * Tujuan: untuk hitung kuota target call_list yang gabungan dari semua pegawai
 * milik satu user (kasus combo MR + PS).
 *
 * Fallback: kalau idPeg tidak punya `id_user` → return [idPeg].
 */
export async function getAllIdPegOfSameUser(idPeg: number): Promise<number[]> {
  const [own] = await db
    .select({ id_user: data_pegawai.id_user })
    .from(data_pegawai)
    .where(eq(data_pegawai.rowid, idPeg))
    .limit(1);

  if (!own?.id_user) return [idPeg];

  const rows = await db
    .select({ rowid: data_pegawai.rowid })
    .from(data_pegawai)
    .where(and(eq(data_pegawai.id_user, own.id_user), isNotNull(data_pegawai.rowid)));

  const out = new Set<number>([idPeg]);
  for (const r of rows) out.add(r.rowid);
  return [...out];
}

/**
 * Resolve list `id_peg` bawahan yang call_list-nya boleh di-approve oleh
 * approver (DM/ACT. DM/RSM/MM), termasuk **vacancy/dummy escalation**.
 *
 * Port dari VisitApprovalController lines 164-282 (legacy). Logic per jabatan:
 *
 * - DM/ACT. DM:
 *   - approve MR bawahan langsung (cl.id_peg = struktur.id_peg_mr)
 *   - + DM-self (cl.id_peg = struktur.id_peg_dm) JIKA `rsm.status` ∈ {Vacant,Dummy}
 *     AND `mm.status` ∈ {Vacant,Dummy}
 *
 * - RSM:
 *   - approve DM bawahan langsung
 *   - + MR JIKA `dm.status` ∈ {Vacant,Dummy}
 *   - + RSM-self JIKA `mm.status` ∈ {Vacant,Dummy}
 *
 * - MM:
 *   - approve RSM bawahan langsung
 *   - + DM JIKA `rsm.status` ∈ {Vacant,Dummy}
 *   - + MR JIKA `dm.status` ∈ {Vacant,Dummy} AND `rsm.status` ∈ {Vacant,Dummy}
 *
 * - Jabatan lain → return [].
 *
 * Catatan: `data_pegawai.status` NULL (atau row tidak ada via LEFT JOIN) berarti
 * **bukan** Vacant/Dummy → no escalation. Konsisten dengan legacy `whereIn` semantik.
 */
export async function getApprovableCallListIdPegs(
  approverIdPeg: number,
  approverJabatan: string,
  refDate: Date = new Date(),
): Promise<number[]> {
  const upper = (approverJabatan ?? '').toUpperCase();
  const isDM = upper === 'DM' || upper === 'ACT. DM';
  const isRSM = upper === 'RSM';
  const isMM = upper === 'MM';
  if (!isDM && !isRSM && !isMM) return [];

  const refIso = refDate.toISOString().slice(0, 10);
  const ownership = isDM
    ? eq(struktur.id_peg_dm, approverIdPeg)
    : isRSM
      ? eq(struktur.id_peg_rsm, approverIdPeg)
      : eq(struktur.id_peg_mm, approverIdPeg);

  const dpDm = alias(data_pegawai, 'dp_dm');
  const dpRsm = alias(data_pegawai, 'dp_rsm');
  const dpMm = alias(data_pegawai, 'dp_mm');

  const rows = await db
    .select({
      mr: struktur.id_peg_mr,
      dm: struktur.id_peg_dm,
      rsm: struktur.id_peg_rsm,
      mm: struktur.id_peg_mm,
      dm_status: dpDm.status,
      rsm_status: dpRsm.status,
      mm_status: dpMm.status,
    })
    .from(struktur)
    .leftJoin(dpDm, eq(dpDm.rowid, struktur.id_peg_dm))
    .leftJoin(dpRsm, eq(dpRsm.rowid, struktur.id_peg_rsm))
    .leftJoin(dpMm, eq(dpMm.rowid, struktur.id_peg_mm))
    .where(and(lte(struktur.periode_awal, refIso), gte(struktur.periode_akhir, refIso), ownership));

  const isVD = (s: string | null | undefined): boolean => s === 'Vacant' || s === 'Dummy';
  const out = new Set<number>();

  for (const r of rows) {
    if (isDM) {
      if (r.mr) out.add(r.mr);
      if (isVD(r.rsm_status) && isVD(r.mm_status) && r.dm) out.add(r.dm);
    } else if (isRSM) {
      if (r.dm) out.add(r.dm);
      if (isVD(r.dm_status) && r.mr) out.add(r.mr);
      if (isVD(r.mm_status) && r.rsm) out.add(r.rsm);
    } else if (isMM) {
      if (r.rsm) out.add(r.rsm);
      if (isVD(r.rsm_status) && r.dm) out.add(r.dm);
      if (isVD(r.dm_status) && isVD(r.rsm_status) && r.mr) out.add(r.mr);
    }
  }

  return [...out];
}
