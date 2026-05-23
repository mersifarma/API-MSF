/**
 * Service untuk Join Visit picker.
 *
 * Port dari JoinVisitController::callJoinVisit di legacy Laravel.
 *
 * Mapping legacy → Hono:
 *   POST /call-join-visit  → GET /api/join-visit/supervisors
 *
 * Scope reduksi vs legacy:
 *   Legacy juga punya `approvalJoinVisit`, `joinVisitDetails`, `copyJoinVisit`
 *   yang dibutuhkan karena di Laravel, atasan row TIDAK auto-create saat MR
 *   submit actual — atasan harus accept dulu via `copyJoinVisit`.
 *
 *   Di Hono, `call-actual.service.ts` saveActual SUDAH auto-create atasan rows
 *   (status='join_visit', join_visit_id=MR_record_uuid) untuk tiap id_peg di
 *   `joinVisitId` CSV. Konsekuensinya:
 *
 *   - "approvalJoinVisit" → atasan langsung lihat row di `/api/approval/call-actual`
 *     karena row sudah ada dengan approval_actual=NULL.
 *   - "joinVisitDetails" → details via `GET /api/call-actual/:id`.
 *   - "copyJoinVisit" → redundant; auto-done at MR-save time.
 *
 *   Yang TETAP dibutuhkan: picker MR (atau DM) saat input actual — untuk dapat
 *   daftar atasan yang bisa diundang sebagai join visit.
 */

import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../config/database';
import { data_pegawai, struktur } from '../db/schema/master';

export type Supervisor = {
  id_peg: number;
  nama: string;
  jabatan: string | null;
};

/**
 * Resolve daftar atasan ("supervisors") yang bisa diundang sebagai join visit
 * oleh user dengan (idPeg, jabatan):
 *
 * - **MR / PS / KAE** → DM + RSM dari struktur aktif (legacy `else` branch)
 * - **DM / ACT. DM** → RSM dari struktur aktif (legacy DM branch)
 * - **RSM** → MM dari struktur aktif (extension dari legacy — RSM bisa undang MM)
 * - **MM** → empty (highest level)
 *
 * Periode aktif: refDate ∈ [periode_awal, periode_akhir].
 */
export async function listSupervisors(
  userIdPeg: number,
  userJabatan: string,
  refDate: Date = new Date(),
): Promise<Supervisor[]> {
  const upper = (userJabatan ?? '').toUpperCase();
  const isMR = upper === 'MR' || upper === 'PS' || upper === 'KAE';
  const isDM = upper === 'DM' || upper === 'ACT. DM';
  const isRSM = upper === 'RSM';

  if (!isMR && !isDM && !isRSM) return [];

  const refIso = refDate.toISOString().slice(0, 10);
  const ownership = isMR
    ? eq(struktur.id_peg_mr, userIdPeg)
    : isDM
      ? eq(struktur.id_peg_dm, userIdPeg)
      : eq(struktur.id_peg_rsm, userIdPeg);

  const rows = await db
    .select({
      dm: struktur.id_peg_dm,
      rsm: struktur.id_peg_rsm,
      mm: struktur.id_peg_mm,
    })
    .from(struktur)
    .where(and(lte(struktur.periode_awal, refIso), gte(struktur.periode_akhir, refIso), ownership));

  const ids = new Set<number>();
  for (const r of rows) {
    if (isMR) {
      if (r.dm) ids.add(r.dm);
      if (r.rsm) ids.add(r.rsm);
    } else if (isDM) {
      if (r.rsm) ids.add(r.rsm);
    } else if (isRSM) {
      if (r.mm) ids.add(r.mm);
    }
  }

  const idList = [...ids];
  if (idList.length === 0) return [];

  const pegawaiRows = await db
    .select({
      id_peg: data_pegawai.rowid,
      nama: data_pegawai.nama,
      jabatan: data_pegawai.jabatan,
    })
    .from(data_pegawai)
    .where(inArray(data_pegawai.rowid, idList));

  // Preserve sort order by nama for deterministic output.
  return pegawaiRows.sort((a, b) => a.nama.localeCompare(b.nama));
}
