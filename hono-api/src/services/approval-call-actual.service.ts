/**
 * Service untuk Approval Call Actual.
 *
 * Port dari VisitApprovalController::{DmApprovalActualName, DmApprovalActualDetails,
 * DmApprovalActualSave, DmApprovalActualSingle} di legacy Laravel (lines 800-1500).
 *
 * Mapping legacy → Hono (RESTful):
 *   POST /dm-approval-actual-name    → GET  /api/approval/call-actual/pegawai
 *   POST /dm-approval-actual-details → GET  /api/approval/call-actual
 *   POST /dm-approval-actual-save    → POST /api/approval/call-actual/batch
 *
 * Deadline per-row (legacy lines 1183-1214):
 * - jarakHari = today − tgl_actual (calendar days, WIB)
 * - extraDays: Sunday → +2, Monday → +3 (skip-weekend correction)
 * - maxHari = BATAS_HARI_ACTUAL + extraDays
 * - jarakHari > maxHari                                 → APPROVAL_ACTUAL_EXPIRED
 * - jarakHari === maxHari && sudahLewatJam(BATAS_JAM_ACTUAL) → APPROVAL_ACTUAL_EXPIRED
 *
 * Photo guard (legacy lines 1174-1179): Approve dengan `foto IS NULL OR foto=''`
 * → 422 APPROVAL_ACTUAL_NO_FOTO.
 *
 * Cascade pada Approve (legacy lines 1235-1259): set `call_list.is_visited=true`
 * untuk (id_peg ∈ same_user_set, id_mcl, periode_first_of_month).
 *
 * Reuse `getApprovableCallListIdPegs` — vacancy/dummy escalation rule IDENTIK.
 */

import { and, asc, count as countSql, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { db } from '../config/database';
import { data_pegawai } from '../db/schema/master';
import { call_list, call_plan_actual } from '../db/schema/transactional';
import { BATAS_HARI_ACTUAL, BATAS_JAM_ACTUAL } from '../lib/constants';
import { DeadlinePassedError, DomainError, ValidationError } from '../lib/errors';
import { sudahLewatJamWIB, todayWIB } from '../lib/timezone';
import { getAllIdPegOfSameUser, getApprovableCallListIdPegs } from './struktur.service';

function lastDayOfMonth(periode: string): string {
  const [year, month] = periode.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${periode}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Day-of-week di WIB. 0 = Sunday … 6 = Saturday.
 */
function dayOfWeekWIB(now: Date = new Date()): number {
  const wib = new Date(now.getTime() + 7 * 3_600_000);
  return wib.getUTCDay();
}

/**
 * Hitung `extraDays` untuk weekend skip (legacy lines 1197-1201):
 *   Sunday → 2 (Sat di-skip dalam window)
 *   Monday → 3 (Sat + Sun di-skip)
 *   else   → 0
 */
function weekendExtraDays(now: Date = new Date()): number {
  const dow = dayOfWeekWIB(now);
  if (dow === 0) return 2;
  if (dow === 1) return 3;
  return 0;
}

/**
 * Hitung tanggal cutoff: `today - maxHari` (format 'YYYY-MM-DD').
 * Row dengan `tgl_actual < cutoff` → expired.
 */
function computeCutoffTglActual(now: Date = new Date()): string {
  const extra = weekendExtraDays(now);
  const lewatJam = sudahLewatJamWIB(BATAS_JAM_ACTUAL, now);
  // Lewat jam → maxHari yang valid berkurang 1 (legacy line 859).
  const subtractDays = lewatJam ? BATAS_HARI_ACTUAL - 1 + extra : BATAS_HARI_ACTUAL + extra;
  const cutoffMs = now.getTime() - subtractDays * 24 * 3_600_000;
  return todayWIB(new Date(cutoffMs));
}

function diffDaysWIB(tglActualIso: string, now: Date = new Date()): number {
  const today = todayWIB(now);
  const t0 = new Date(`${today}T00:00:00Z`).getTime();
  const t1 = new Date(`${tglActualIso}T00:00:00Z`).getTime();
  return Math.round((t0 - t1) / (24 * 3_600_000));
}

// ---------------------------------------------------------------------------
// 1) List pegawai bawahan yang punya pending actual di periode
// ---------------------------------------------------------------------------

export type ListPegawaiPendingActualInput = {
  approverIdPeg: number;
  approverJabatan: string;
  periode: string; // 'YYYY-MM'
};

export type PegawaiPendingActualRow = {
  id_peg: number;
  nama_pegawai: string;
  total_request: number;
};

export async function listPegawaiPendingActual(
  opts: ListPegawaiPendingActualInput,
): Promise<PegawaiPendingActualRow[]> {
  const approvableIds = await getApprovableCallListIdPegs(opts.approverIdPeg, opts.approverJabatan);
  if (approvableIds.length === 0) return [];

  const startDate = `${opts.periode}-01`;
  const endDate = lastDayOfMonth(opts.periode);
  const cutoff = computeCutoffTglActual();

  const rows = await db
    .select({
      id_peg: data_pegawai.rowid,
      nama_pegawai: data_pegawai.nama,
      total_request: countSql(call_plan_actual.id).as('total_request'),
    })
    .from(call_plan_actual)
    .innerJoin(data_pegawai, eq(data_pegawai.rowid, call_plan_actual.id_peg))
    .where(
      and(
        inArray(call_plan_actual.id_peg, approvableIds),
        isNull(call_plan_actual.approval_actual),
        isNotNull(call_plan_actual.tgl_actual),
        gte(call_plan_actual.tgl_actual, startDate),
        lte(call_plan_actual.tgl_actual, endDate),
        gte(call_plan_actual.tgl_actual, cutoff),
      ),
    )
    .groupBy(data_pegawai.rowid, data_pegawai.nama)
    .orderBy(asc(data_pegawai.nama));

  return rows.map((r) => ({
    id_peg: r.id_peg,
    nama_pegawai: r.nama_pegawai,
    total_request: Number(r.total_request),
  }));
}

// ---------------------------------------------------------------------------
// 2) Detail pending actuals milik pegawai tertentu
// ---------------------------------------------------------------------------

export type ListActualDetailsInput = {
  approverIdPeg: number;
  approverJabatan: string;
  targetIdPeg: number;
  periode: string;
};

export type CallActualDetailRow = {
  id: string;
  tgl_plan: string | null;
  waktu: string | null;
  tgl_actual: string | null;
  waktu_actual: string | null;
  id_mcl: number | null;
  nama_dokter: string | null;
  spec: string | null;
  segmen_md: number | null;
  class: string | null;
  institusi: string | null;
  alamat_praktek: string | null;
  keterangan: string | null;
  status: string | null;
  foto: string | null;
  join_visit: number | null;
  join_visit_ff: string | null;
};

export async function listCallActualDetailsForPegawai(
  opts: ListActualDetailsInput,
): Promise<CallActualDetailRow[]> {
  const approvableIds = await getApprovableCallListIdPegs(opts.approverIdPeg, opts.approverJabatan);
  if (!approvableIds.includes(opts.targetIdPeg)) {
    return [];
  }

  const startDate = `${opts.periode}-01`;
  const endDate = lastDayOfMonth(opts.periode);
  const cutoff = computeCutoffTglActual();

  return db
    .select({
      id: call_plan_actual.id,
      tgl_plan: call_plan_actual.tgl_plan,
      waktu: call_plan_actual.waktu,
      tgl_actual: call_plan_actual.tgl_actual,
      waktu_actual: call_plan_actual.waktu_actual,
      id_mcl: call_plan_actual.id_mcl,
      nama_dokter: call_plan_actual.nama_dokter,
      spec: call_plan_actual.spec,
      segmen_md: call_plan_actual.segmen_md,
      class: call_plan_actual.class,
      institusi: call_plan_actual.institusi,
      alamat_praktek: call_plan_actual.alamat_praktek,
      keterangan: call_plan_actual.keterangan,
      status: call_plan_actual.status,
      foto: call_plan_actual.foto,
      join_visit: call_plan_actual.join_visit,
      join_visit_ff: call_plan_actual.join_visit_ff,
    })
    .from(call_plan_actual)
    .where(
      and(
        eq(call_plan_actual.id_peg, opts.targetIdPeg),
        isNull(call_plan_actual.approval_actual),
        isNotNull(call_plan_actual.tgl_actual),
        gte(call_plan_actual.tgl_actual, startDate),
        lte(call_plan_actual.tgl_actual, endDate),
        gte(call_plan_actual.tgl_actual, cutoff),
      ),
    )
    .orderBy(asc(call_plan_actual.tgl_actual), asc(call_plan_actual.waktu_actual));
}

// ---------------------------------------------------------------------------
// 3) Batch approve/reject Actual
// ---------------------------------------------------------------------------

export type BatchActualApprovalItem = {
  id: string;
  approval_actual: 'Approve' | 'Reject';
  approval_actual_comment?: string;
};

export type BatchActualApprovalInput = {
  approverIdPeg: number;
  approverJabatan: string;
  approvals: BatchActualApprovalItem[];
};

export type BatchActualApprovalResult = {
  total: number;
  approved: number;
  rejected: number;
};

export async function batchApproveCallActual(
  opts: BatchActualApprovalInput,
): Promise<BatchActualApprovalResult> {
  if (opts.approvals.length === 0) {
    throw new ValidationError('Batch approvals tidak boleh kosong.');
  }

  const ids = opts.approvals.map((a) => a.id);

  // 1. Fetch existing rows.
  const existing = await db
    .select({
      id: call_plan_actual.id,
      id_peg: call_plan_actual.id_peg,
      id_mcl: call_plan_actual.id_mcl,
      tgl_actual: call_plan_actual.tgl_actual,
      foto: call_plan_actual.foto,
    })
    .from(call_plan_actual)
    .where(inArray(call_plan_actual.id, ids));

  if (existing.length === 0) {
    return { total: 0, approved: 0, rejected: 0 };
  }

  // 2. Multi-periode guard (per bulan tgl_actual).
  const periodeSet = new Set<string>();
  for (const r of existing) {
    if (r.tgl_actual) periodeSet.add(r.tgl_actual.slice(0, 7));
  }
  if (periodeSet.size > 1) {
    throw new ValidationError(
      'Batch berisi call_actual dari multiple periode. Pisahkan request per periode.',
      { detected_periodes: [...periodeSet] },
    );
  }

  // 3. Authority check per row.
  const approvableIds = await getApprovableCallListIdPegs(opts.approverIdPeg, opts.approverJabatan);
  const approvableSet = new Set(approvableIds);
  const unauthorizedIds = existing.filter((r) => !approvableSet.has(r.id_peg)).map((r) => r.id);
  if (unauthorizedIds.length > 0) {
    throw new DomainError({
      message: 'Tidak boleh approve call_actual dari pegawai di luar scope Anda.',
      statusCode: 403,
      code: 'NOT_APPROVER_FOR_ROW',
      details: { ids: unauthorizedIds },
    });
  }

  // 4. Per-row deadline + photo check.
  const now = new Date();
  const extra = weekendExtraDays(now);
  const maxHari = BATAS_HARI_ACTUAL + extra;
  const lewatJam = sudahLewatJamWIB(BATAS_JAM_ACTUAL, now);

  const existingMap = new Map(existing.map((r) => [r.id, r]));

  // Map decisions per id (silent-skip yang tidak ada di DB).
  const validDecisions = opts.approvals.filter((a) => existingMap.has(a.id));

  for (const item of validDecisions) {
    const row = existingMap.get(item.id)!;
    if (!row.tgl_actual) continue;

    const jarak = diffDaysWIB(row.tgl_actual, now);
    if (jarak > maxHari || (jarak === maxHari && lewatJam)) {
      throw new DeadlinePassedError(
        `Approval call actual gagal: sudah melewati batas ${BATAS_HARI_ACTUAL} hari setelah tgl_actual (batas jam ${BATAS_JAM_ACTUAL}:00 WIB di hari terakhir).`,
        'APPROVAL_ACTUAL_EXPIRED',
        { id: row.id, tgl_actual: row.tgl_actual, jarak_hari: jarak },
      );
    }

    if (item.approval_actual === 'Approve') {
      const fotoEmpty = !row.foto || row.foto.trim() === '';
      if (fotoEmpty) {
        throw new DeadlinePassedError(
          'Approval tidak dapat dilakukan karena foto tidak terdeteksi atau tidak ada.',
          'APPROVAL_ACTUAL_NO_FOTO',
          { id: row.id },
        );
      }
    }
  }

  // 5. Transaction: UPDATE per item + cascade `call_list.is_visited` on Approve.
  let approved = 0;
  let rejected = 0;

  // Pre-resolve id_peg expansion (combo id_ff) once per row id_peg untuk cascade.
  const idPegExpansionCache = new Map<number, number[]>();
  async function expandIdPeg(idPeg: number): Promise<number[]> {
    const cached = idPegExpansionCache.get(idPeg);
    if (cached) return cached;
    const list = await getAllIdPegOfSameUser(idPeg);
    idPegExpansionCache.set(idPeg, list);
    return list;
  }

  await db.transaction(async (tx) => {
    for (const item of validDecisions) {
      const row = existingMap.get(item.id)!;
      const isApprove = item.approval_actual === 'Approve';
      const comment = item.approval_actual_comment ?? null;

      await tx
        .update(call_plan_actual)
        .set({
          approval_actual: item.approval_actual,
          approval_actual_by: opts.approverIdPeg,
          approval_actual_date: now,
          approval_actual_comment: comment,
          updated_by: opts.approverIdPeg,
          updated_at: now,
        })
        .where(eq(call_plan_actual.id, item.id));

      // Cascade: mark call_list.is_visited=true (legacy 1235-1259).
      if (isApprove && row.tgl_actual && row.id_mcl != null) {
        const periodeFirst = `${row.tgl_actual.slice(0, 7)}-01`;
        const idPegSet = await expandIdPeg(row.id_peg);
        await tx
          .update(call_list)
          .set({
            is_visited: true,
            updated_by: opts.approverIdPeg,
            updated_at: now,
          })
          .where(
            and(
              inArray(call_list.id_peg, idPegSet),
              eq(call_list.id_mcl, row.id_mcl),
              eq(call_list.periode, periodeFirst),
            ),
          );
      }

      if (isApprove) approved++;
      else rejected++;
    }
  });

  return { total: validDecisions.length, approved, rejected };
}
