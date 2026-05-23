/**
 * Service untuk endpoint Call List.
 *
 * Cluster 1 — endpoint READ.
 * Cluster 2 — endpoint WRITE (create / update / delete) dengan business rules
 * deadline, kuota target, anti-duplikasi, luar-kota multiplier, dan audit
 * history. Port dari VisitController::{saveCallList, updateCallList,
 * deleteCallList} di legacy Laravel.
 *
 * Mapping legacy → Hono:
 *   /call-list-data         → listCallList
 *   /call-list-get          → listEligibleDokter
 *   /call-list-count        → getCallListCount
 *   /get-call-list-target   → getCallTarget
 *   /get-my-pending-…       → getPendingApprovalCount
 *   /call-list-history      → listCallListHistory
 *   /call-list-save         → createCallList
 *   /call-list-update       → updateCallList
 *   /call-list-delete       → deleteCallList
 */

import {
  and,
  asc,
  count as countSql,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { db } from '../config/database';
import {
  call_target_list,
  data_pegawai,
  list_dokter_visit_new,
  struktur,
} from '../db/schema/master';
import { call_list, call_list_history, call_plan_actual } from '../db/schema/transactional';
import { ConflictError, DeadlinePassedError, ForbiddenError, NotFoundError } from '../lib/errors';
import { hitungDeadlineHariKerja, isCallListDeadlinePassed } from '../lib/deadline';
import { parsePeriode } from '../utils/date';
import { getAllIdPegOfSameUser, getVisibleIdPeg } from './struktur.service';

function periodeToIsoDate(periode: string): string {
  // 'YYYY-MM' → 'YYYY-MM-01'. Tidak boleh pakai parsePeriode().toISOString()
  // karena akan jatuh ke tanggal sebelumnya (UTC = WIB − 7h, jadi midnight WIB
  // tgl-1 = 17:00 UTC tgl sebelumnya).
  return `${periode}-01`;
}

// ---------------------------------------------------------------------------
// List call_list per periode untuk user yang sedang login
// ---------------------------------------------------------------------------

export async function listCallList(idPeg: number, periode: string) {
  const periodeIso = periodeToIsoDate(periode);
  return db
    .select({
      id: call_list.id,
      id_mcl: call_list.id_mcl,
      periode: call_list.periode,
      is_visited: call_list.is_visited,
      nama_dokter: call_list.nama_dokter,
      spec: call_list.spec,
      segmen: call_list.segmen,
      class: call_list.class,
      target_visit: call_list.target_visit,
      wilayah: call_list.wilayah,
      id_peg: call_list.id_peg,
      id_ff: call_list.id_ff,
      approval: call_list.approval,
      approval_by: call_list.approval_by,
      approval_date: call_list.approval_date,
      approval_comment: call_list.approval_comment,
      keterangan: call_list.keterangan,
      note: call_list.note,
      created_at: call_list.created_at,
      updated_at: call_list.updated_at,
    })
    .from(call_list)
    .where(and(eq(call_list.id_peg, idPeg), eq(call_list.periode, periodeIso)))
    .orderBy(asc(call_list.nama_dokter));
}

// ---------------------------------------------------------------------------
// Eligible dokter — yang belum ada di call_list user pada periode ini
// ---------------------------------------------------------------------------

export type EligibleDokterOpts = {
  viewerIdPeg: number;
  viewerJabatan: string;
  periode: string;
  search?: string;
  limit: number;
};

export async function listEligibleDokter(opts: EligibleDokterOpts) {
  const periodeIso = periodeToIsoDate(opts.periode);
  const visibleIds = await getVisibleIdPeg(opts.viewerIdPeg, opts.viewerJabatan);

  const alreadyListed = db
    .select({ id_mcl: call_list.id_mcl })
    .from(call_list)
    .where(and(eq(call_list.id_peg, opts.viewerIdPeg), eq(call_list.periode, periodeIso)));

  const conds: SQL[] = [
    inArray(list_dokter_visit_new.ID_PEG, visibleIds),
    eq(list_dokter_visit_new.STATUS_MD, 'ACTIVE'),
    notInArray(list_dokter_visit_new.ID, alreadyListed),
  ];
  if (opts.search) {
    const pat = `%${opts.search}%`;
    const orCond = or(
      ilike(list_dokter_visit_new.NAMA_DOKTER, pat),
      ilike(list_dokter_visit_new.INSTITUSI, pat),
    );
    if (orCond) conds.push(orCond);
  }

  return db
    .select({
      id: list_dokter_visit_new.ID,
      id_mcl: list_dokter_visit_new.ID_MCL,
      id_peg: list_dokter_visit_new.ID_PEG,
      nama_dokter: list_dokter_visit_new.NAMA_DOKTER,
      spec: list_dokter_visit_new.SPEC,
      class: list_dokter_visit_new.CLASS,
      segmen_md: list_dokter_visit_new.SEGMEN_MD,
      institusi: list_dokter_visit_new.INSTITUSI,
      alamat_praktek: list_dokter_visit_new.ALAMAT_PRAKTEK,
      kota: list_dokter_visit_new.KOTA,
      wilayah: list_dokter_visit_new.WILAYAH,
    })
    .from(list_dokter_visit_new)
    .where(and(...conds))
    .orderBy(asc(list_dokter_visit_new.NAMA_DOKTER))
    .limit(opts.limit);
}

// ---------------------------------------------------------------------------
// Target lookup
// ---------------------------------------------------------------------------

export type CallListTarget = {
  dokter: number;
  non_dokter: number;
};

export async function getCallTarget(
  jabatan: string,
  divisi: string,
  periode: string,
): Promise<CallListTarget | null> {
  const awalIso = periodeToIsoDate(periode);
  const [row] = await db
    .select({
      dokter: call_target_list.dokter,
      non_dokter: call_target_list.non_dokter,
    })
    .from(call_target_list)
    .where(
      and(
        eq(call_target_list.jabatan, jabatan),
        eq(call_target_list.divisi, divisi),
        // target row aktif kalau periode_awal..periode_akhir mencakup tgl_awal periode
        or(isNull(call_target_list.periode_awal), lte(call_target_list.periode_awal, awalIso))!,
        or(isNull(call_target_list.periode_akhir), gte(call_target_list.periode_akhir, awalIso))!,
      ),
    )
    .limit(1);
  if (!row) return null;
  return { dokter: row.dokter, non_dokter: row.non_dokter ?? 0 };
}

// ---------------------------------------------------------------------------
// Count + target gabungan
// ---------------------------------------------------------------------------

export async function getCallListCount(
  jabatan: string,
  divisi: string,
  idPeg: number,
  periode: string,
) {
  const periodeIso = periodeToIsoDate(periode);
  const rows = await db
    .select({ segmen: call_list.segmen })
    .from(call_list)
    .where(and(eq(call_list.id_peg, idPeg), eq(call_list.periode, periodeIso)));

  const countDokter = rows.filter((r) => r.segmen === 'Doctor').length;
  const countNonDokter = rows.filter((r) => r.segmen === 'Non-Doctor').length;
  const target = await getCallTarget(jabatan, divisi, periode);

  return {
    periode,
    count_dokter: countDokter,
    count_non_dokter: countNonDokter,
    target_dokter: target?.dokter ?? null,
    target_non_dokter: target?.non_dokter ?? null,
    sisa_dokter: target ? Math.max(0, target.dokter - countDokter) : null,
    sisa_non_dokter: target ? Math.max(0, target.non_dokter - countNonDokter) : null,
  };
}

// ---------------------------------------------------------------------------
// Pending approval count (badge)
// ---------------------------------------------------------------------------

export async function getPendingApprovalCount(idPeg: number) {
  const rows = await db
    .select({ id: call_list.id })
    .from(call_list)
    .where(and(eq(call_list.id_peg, idPeg), isNull(call_list.approval)));
  return { pending: rows.length };
}

// ---------------------------------------------------------------------------
// History (audit trail per call_list row)
// ---------------------------------------------------------------------------

export async function listCallListHistory(callListId: string, viewerIdPeg: number) {
  const [parent] = await db
    .select({ id: call_list.id, id_peg: call_list.id_peg })
    .from(call_list)
    .where(eq(call_list.id, callListId))
    .limit(1);
  if (!parent) {
    throw new NotFoundError(`Call list ${callListId} tidak ditemukan`);
  }
  if (parent.id_peg !== viewerIdPeg) {
    throw new ForbiddenError('Tidak boleh melihat history call list milik pegawai lain');
  }

  return db
    .select()
    .from(call_list_history)
    .where(eq(call_list_history.call_list_id, callListId))
    .orderBy(desc(call_list_history.action_date));
}

// ---------------------------------------------------------------------------
// Helpers untuk WRITE — snapshot dokter & wilayah/target_visit derivation
// ---------------------------------------------------------------------------

type DokterSnapshot = {
  nama_dokter: string;
  spec: string;
  class: string | null;
  segmen: 'Doctor' | 'Non-Doctor';
};

async function fetchDokterSnapshot(idMcl: number): Promise<DokterSnapshot> {
  const [row] = await db
    .select({
      NAMA_DOKTER: list_dokter_visit_new.NAMA_DOKTER,
      SPEC: list_dokter_visit_new.SPEC,
      CLASS: list_dokter_visit_new.CLASS,
      SEGMEN_MD: list_dokter_visit_new.SEGMEN_MD,
    })
    .from(list_dokter_visit_new)
    .where(eq(list_dokter_visit_new.ID, idMcl))
    .limit(1);
  if (!row) {
    throw new NotFoundError(`Dokter id_mcl=${idMcl} tidak ditemukan`);
  }
  return {
    nama_dokter: row.NAMA_DOKTER,
    spec: row.SPEC,
    class: row.CLASS ?? null,
    // SEGMEN_MD = 1 → Doctor; selainnya (2, 3, …) → Non-Doctor.
    // Sesuai konvensi data master MSF: 1 = dokter, 2+ = nakes/non-dokter.
    segmen: row.SEGMEN_MD === 1 ? 'Doctor' : 'Non-Doctor',
  };
}

/**
 * Tentukan apakah customer ini "Luar Kota" relatif dengan jabatan user.
 *
 * Port dari VisitController.php:661-700. Aturan:
 * - MR/PS/KAE     → cek kolom WILAYAH
 * - DM/ACT. DM    → cek kolom WILAYAH_DM
 * - RSM           → cek kolom WILAYAH_RSM
 *
 * Lookup di master `list_dokter_visit_new` dengan join via `struktur` (semua
 * MR yang ada di struktur user untuk periode itu). Return null kalau bukan
 * Luar Kota → caller pakai default `target_visit=null, wilayah=null`.
 */
async function resolveLuarKotaTarget(
  idPeg: number,
  jabatan: string,
  idMcl: number,
  periode: string,
): Promise<{ target_visit: number; wilayah: string } | null> {
  const periodeIso = periodeToIsoDate(periode);

  const strukturRows = await db
    .select({ id_peg_mr: struktur.id_peg_mr })
    .from(struktur)
    .where(
      and(
        lte(struktur.periode_awal, periodeIso),
        gte(struktur.periode_akhir, periodeIso),
        or(
          eq(struktur.id_peg_mr, idPeg),
          eq(struktur.id_peg_dm, idPeg),
          eq(struktur.id_peg_rsm, idPeg),
        ),
      ),
    );

  const mrIds = strukturRows.map((r) => r.id_peg_mr).filter((v): v is number => v != null);
  if (mrIds.length === 0) return null;

  const [row] = await db
    .select({
      WILAYAH: sql<string | null>`max(${list_dokter_visit_new.WILAYAH})`,
      WILAYAH_DM: sql<string | null>`max(${list_dokter_visit_new.WILAYAH_DM})`,
      WILAYAH_RSM: sql<string | null>`max(${list_dokter_visit_new.WILAYAH_RSM})`,
    })
    .from(list_dokter_visit_new)
    .where(
      and(
        inArray(list_dokter_visit_new.ID_PEG, mrIds),
        eq(list_dokter_visit_new.ID, idMcl),
        eq(list_dokter_visit_new.STATUS_MD, 'ACTIVE'),
      ),
    );

  if (!row) return null;

  const upper = (jabatan ?? '').toUpperCase();
  const matches =
    ((upper === 'MR' || upper === 'PS' || upper === 'KAE') && row.WILAYAH === 'Luar Kota') ||
    ((upper === 'DM' || upper === 'ACT. DM') && row.WILAYAH_DM === 'Luar Kota') ||
    (upper === 'RSM' && row.WILAYAH_RSM === 'Luar Kota');

  return matches ? { target_visit: 1, wilayah: 'Luar Kota' } : null;
}

async function fetchIdFf(idPeg: number): Promise<string> {
  const [row] = await db
    .select({ id: data_pegawai.id })
    .from(data_pegawai)
    .where(eq(data_pegawai.rowid, idPeg))
    .limit(1);
  if (!row) {
    throw new NotFoundError(`Pegawai id_peg=${idPeg} tidak ditemukan`);
  }
  return row.id;
}

async function countSegmenForUser(
  idPegs: number[],
  periodeIso: string,
  segmen: 'Doctor' | 'Non-Doctor',
  excludeCallListId?: string,
): Promise<number> {
  const conds: SQL[] = [
    inArray(call_list.id_peg, idPegs),
    eq(call_list.periode, periodeIso),
    eq(call_list.segmen, segmen),
  ];
  if (excludeCallListId) conds.push(ne(call_list.id, excludeCallListId));
  const [row] = await db
    .select({ n: countSql() })
    .from(call_list)
    .where(and(...conds));
  return Number(row?.n ?? 0);
}

function formatDeadlineWIB(d: Date): string {
  const wib = new Date(d.getTime() + 7 * 3_600_000);
  return wib.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// CREATE — saveCallList port
// ---------------------------------------------------------------------------

export type CreateCallListInput = {
  idPeg: number;
  jabatan: string;
  divisi: string;
  idMcl: number;
  periode: string; // 'YYYY-MM'
};

export async function createCallList(opts: CreateCallListInput) {
  const periodeIso = periodeToIsoDate(opts.periode);

  // 1. Deadline (skip bulan masa depan; reject kalau lewat batas hari kerja).
  if (isCallListDeadlinePassed(opts.periode)) {
    const deadline = hitungDeadlineHariKerja(parsePeriode(opts.periode), 5);
    throw new DeadlinePassedError(
      `Penambahan call list tidak dapat dilakukan. Batas waktu 5 hari kerja awal bulan sudah terlewat (deadline: ${formatDeadlineWIB(deadline)}).`,
      'ADD_CALL_LIST_EXPIRED',
      { deadline: deadline.toISOString(), periode: opts.periode },
    );
  }

  // 2. Anti-duplikasi (id_peg, id_mcl, periode).
  const [dup] = await db
    .select({ id: call_list.id })
    .from(call_list)
    .where(
      and(
        eq(call_list.id_peg, opts.idPeg),
        eq(call_list.id_mcl, opts.idMcl),
        eq(call_list.periode, periodeIso),
      ),
    )
    .limit(1);
  if (dup) {
    throw new ConflictError('Dokter sudah ada di call list bulan ini.', 'DUPLICATE_DOCTOR');
  }

  // 3. Snapshot dokter dari master.
  const snap = await fetchDokterSnapshot(opts.idMcl);

  // 4. Target quota (gabung semua id_peg milik user yang sama).
  const target = await getCallTarget(opts.jabatan, opts.divisi, opts.periode);
  if (target) {
    const idPegs = await getAllIdPegOfSameUser(opts.idPeg);
    const current = await countSegmenForUser(idPegs, periodeIso, snap.segmen);
    const cap = snap.segmen === 'Doctor' ? target.dokter : target.non_dokter;
    if (current >= cap) {
      const label = snap.segmen === 'Doctor' ? 'Dokter' : 'Non-Dokter';
      const code = snap.segmen === 'Doctor' ? 'TARGET_DOKTER_FULL' : 'TARGET_NON_DOKTER_FULL';
      throw new ConflictError(`Target ${label} sudah penuh (maks. ${cap}).`, code);
    }
  }

  // 5. Luar kota multiplier.
  const luarKota = await resolveLuarKotaTarget(opts.idPeg, opts.jabatan, opts.idMcl, opts.periode);

  // 6. id_ff dari data_pegawai (token-derived).
  const idFf = await fetchIdFf(opts.idPeg);

  // 7. Insert.
  const [inserted] = await db
    .insert(call_list)
    .values({
      id_mcl: opts.idMcl,
      periode: periodeIso,
      nama_dokter: snap.nama_dokter,
      spec: snap.spec,
      segmen: snap.segmen,
      class: snap.class,
      target_visit: luarKota?.target_visit ?? null,
      wilayah: luarKota?.wilayah ?? null,
      id_peg: opts.idPeg,
      id_ff: idFf,
      created_by: opts.idPeg,
      updated_by: opts.idPeg,
    })
    .returning({
      id: call_list.id,
      id_mcl: call_list.id_mcl,
      periode: call_list.periode,
      segmen: call_list.segmen,
      target_visit: call_list.target_visit,
      wilayah: call_list.wilayah,
    });

  return inserted;
}

// ---------------------------------------------------------------------------
// UPDATE — updateCallList port (hanya untuk row dengan approval='Reject')
// ---------------------------------------------------------------------------

export type UpdateCallListInput = {
  callListId: string;
  viewerIdPeg: number;
  viewerJabatan: string;
  viewerDivisi: string;
  idMcl: number;
  reason?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function updateCallList(opts: UpdateCallListInput) {
  // 1. Fetch row + ownership + status guard.
  const [row] = await db.select().from(call_list).where(eq(call_list.id, opts.callListId)).limit(1);
  if (!row) {
    throw new NotFoundError(`Call list ${opts.callListId} tidak ditemukan`);
  }
  if (row.id_peg !== opts.viewerIdPeg) {
    throw new ForbiddenError('Tidak boleh edit call list milik pegawai lain');
  }
  if (row.approval !== 'Reject') {
    throw new ForbiddenError(
      `Cannot edit! Only Rejected call list can be edited. Current status: ${row.approval ?? '-'}`,
    );
  }

  // 2. Re-derive snapshot + target check kalau id_mcl berubah.
  const periodeIso = row.periode ?? periodeToIsoDate(`${new Date().getFullYear()}-01`);
  const idMclChanged = opts.idMcl !== row.id_mcl;
  const snap = idMclChanged
    ? await fetchDokterSnapshot(opts.idMcl)
    : {
        nama_dokter: row.nama_dokter,
        spec: row.spec,
        class: row.class ?? null,
        segmen: row.segmen as 'Doctor' | 'Non-Doctor',
      };

  if (idMclChanged) {
    const periode = `${periodeIso.slice(0, 7)}`;
    const target = await getCallTarget(opts.viewerJabatan, opts.viewerDivisi, periode);
    if (target) {
      const idPegs = await getAllIdPegOfSameUser(opts.viewerIdPeg);
      const current = await countSegmenForUser(idPegs, periodeIso, snap.segmen, opts.callListId);
      const cap = snap.segmen === 'Doctor' ? target.dokter : target.non_dokter;
      if (current >= cap) {
        const label = snap.segmen === 'Doctor' ? 'Dokter' : 'Non-Dokter';
        const code = snap.segmen === 'Doctor' ? 'TARGET_DOKTER_FULL' : 'TARGET_NON_DOKTER_FULL';
        throw new ConflictError(`Target ${label} sudah penuh (maks. ${cap}).`, code);
      }
    }
  }

  // 3. Wilayah/target_visit recompute.
  const luarKota = await resolveLuarKotaTarget(
    opts.viewerIdPeg,
    opts.viewerJabatan,
    opts.idMcl,
    periodeIso.slice(0, 7),
  );
  const newWilayah = luarKota?.wilayah ?? null;
  const newTargetVisit = luarKota?.target_visit ?? null;

  // 4. Hitung field yang berubah.
  const tracked: Array<{ field: string; old: unknown; nu: unknown }> = [
    { field: 'id_mcl', old: row.id_mcl, nu: opts.idMcl },
    { field: 'nama_dokter', old: row.nama_dokter, nu: snap.nama_dokter },
    { field: 'spec', old: row.spec, nu: snap.spec },
    { field: 'segmen', old: row.segmen, nu: snap.segmen },
    { field: 'class', old: row.class, nu: snap.class },
    { field: 'wilayah', old: row.wilayah, nu: newWilayah },
    { field: 'target_visit', old: row.target_visit, nu: newTargetVisit },
  ];
  const changes = tracked.filter((t) => t.old !== t.nu).length;

  // 5. UPDATE + INSERT history dalam satu transaksi.
  await db.transaction(async (tx) => {
    await tx
      .update(call_list)
      .set({
        id_mcl: opts.idMcl,
        nama_dokter: snap.nama_dokter,
        spec: snap.spec,
        segmen: snap.segmen,
        class: snap.class,
        target_visit: newTargetVisit,
        wilayah: newWilayah,
        approval: null,
        approval_by: null,
        approval_date: null,
        approval_comment: null,
        updated_by: opts.viewerIdPeg,
        updated_at: new Date(),
      })
      .where(eq(call_list.id, opts.callListId));

    await tx.insert(call_list_history).values({
      call_list_id: opts.callListId,
      id_peg: opts.viewerIdPeg,
      action_type: 'edit',
      old_id_mcl: row.id_mcl,
      new_id_mcl: opts.idMcl,
      old_nama_dokter: row.nama_dokter,
      new_nama_dokter: snap.nama_dokter,
      old_spec: row.spec,
      new_spec: snap.spec,
      old_class: row.class,
      new_class: snap.class,
      old_segmen: row.segmen,
      new_segmen: snap.segmen,
      old_wilayah: row.wilayah,
      new_wilayah: newWilayah,
      old_target_visit: row.target_visit,
      new_target_visit: newTargetVisit,
      reason: opts.reason ?? null,
      ip_address: opts.ipAddress ?? null,
      user_agent: opts.userAgent ?? null,
    });
  });

  return { id: opts.callListId, changes };
}

// ---------------------------------------------------------------------------
// DELETE — deleteCallList port (tolak kalau plan exists / status Reject)
// ---------------------------------------------------------------------------

export type DeleteCallListInput = {
  callListId: string;
  viewerIdPeg: number;
};

export async function deleteCallList(opts: DeleteCallListInput) {
  // 1. Fetch + ownership + status guard.
  const [row] = await db
    .select({
      id: call_list.id,
      id_peg: call_list.id_peg,
      id_mcl: call_list.id_mcl,
      periode: call_list.periode,
      approval: call_list.approval,
    })
    .from(call_list)
    .where(eq(call_list.id, opts.callListId))
    .limit(1);
  if (!row) {
    throw new NotFoundError(`Call list ${opts.callListId} tidak ditemukan`);
  }
  if (row.id_peg !== opts.viewerIdPeg) {
    throw new ForbiddenError('Tidak boleh delete call list milik pegawai lain');
  }
  if (row.approval === 'Reject') {
    throw new ConflictError(
      'Cannot delete! Status is Rejected. Please edit the data instead.',
      'CANNOT_DELETE_REJECTED',
    );
  }

  // 2. Plan existence guard.
  if (row.periode && row.id_mcl != null) {
    const [year, month] = row.periode.split('-').map(Number);
    const [planRow] = await db
      .select({ id: call_plan_actual.id })
      .from(call_plan_actual)
      .where(
        and(
          eq(call_plan_actual.id_mcl, row.id_mcl),
          eq(call_plan_actual.id_peg, row.id_peg),
          isNotNull(call_plan_actual.tgl_plan),
          sql`EXTRACT(YEAR FROM ${call_plan_actual.tgl_plan}) = ${year}`,
          sql`EXTRACT(MONTH FROM ${call_plan_actual.tgl_plan}) = ${month}`,
        ),
      )
      .limit(1);
    if (planRow) {
      const bulan = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('id-ID', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
      throw new ConflictError(
        `Cannot delete! This customer already has a Call Plan scheduled for ${bulan}.`,
        'CALL_PLAN_EXISTS',
      );
    }
  }

  // 3. Hard delete — history ikut cascade via FK onDelete cascade.
  await db.delete(call_list).where(eq(call_list.id, opts.callListId));

  return { id: opts.callListId, deleted: true };
}
