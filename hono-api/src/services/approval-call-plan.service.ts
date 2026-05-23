/**
 * Service untuk Approval Call Plan.
 *
 * Port dari VisitApprovalController::{DmApprovalPlanName, DmApprovalPlanDetails,
 * DmApprovalPlanSave} di legacy Laravel (lines 485-798).
 *
 * Mapping legacy → Hono (RESTful):
 *   POST /dm-approval-plan-name    → GET  /api/approval/call-plan/pegawai
 *   POST /dm-approval-plan-details → GET  /api/approval/call-plan
 *   POST /dm-approval-plan-save    → POST /api/approval/call-plan/batch
 *
 * Deadline (per-item, dihitung dari `tgl_plan` row, bukan periode):
 * - tgl_plan > today                       → boleh approve kapan saja
 * - tgl_plan === today && belum jam 10 WIB → OK
 * - tgl_plan === today && lewat jam 10 WIB → 422 APPROVAL_PLAN_TIME_EXPIRED
 * - tgl_plan < today                       → 422 APPROVAL_PLAN_EXPIRED
 *
 * Hardening dibanding legacy:
 * - **Authority per-row check** di batch save (legacy silent-update). 403 NOT_APPROVER_FOR_ROW.
 * - **Multi-periode batch guard** → 422 VALIDATION_ERROR (legacy hanya cek row pertama).
 *
 * Cascade Reject (mirror legacy line 783-787): saat Reject Plan, set juga
 * approval_actual=Reject + approval_actual_by + approval_actual_date supaya
 * row tidak nyangkut menunggu approval actual.
 *
 * Reuse `getApprovableCallListIdPegs` — vacancy/dummy escalation rule untuk
 * Plan IDENTIK dengan Call List (legacy lines 543-549 vs 543-549 di file
 * sama). Helper-nya struktur-only, bukan tabel-specific.
 */

import { and, asc, count as countSql, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { db } from '../config/database';
import { data_pegawai } from '../db/schema/master';
import { call_plan_actual } from '../db/schema/transactional';
import { BATAS_JAM_PLAN } from '../lib/constants';
import { DeadlinePassedError, DomainError, ValidationError } from '../lib/errors';
import { sudahLewatJamWIB, todayWIB } from '../lib/timezone';
import { getApprovableCallListIdPegs } from './struktur.service';

function lastDayOfMonth(periode: string): string {
  const [year, month] = periode.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${periode}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Hitung filter `tgl_plan >= ?` untuk list/details.
 *
 * Mirror legacy lines 517-521:
 *   tglPlanFilter = today
 *   if (sudahLewatJam(BATAS_JAM_PLAN)) tglPlanFilter = tomorrow
 *
 * Effect: setelah lewat jam 10, row dengan tgl_plan === today tidak muncul lagi
 * di list (karena sudah expired untuk approval).
 */
function getTglPlanFilter(now: Date = new Date()): string {
  if (sudahLewatJamWIB(BATAS_JAM_PLAN, now)) {
    // tomorrow WIB
    const tomorrow = new Date(now.getTime() + 24 * 3_600_000);
    return todayWIB(tomorrow);
  }
  return todayWIB(now);
}

// ---------------------------------------------------------------------------
// 1) List pegawai bawahan yang punya pending tgl_plan di periode
// ---------------------------------------------------------------------------

export type ListPegawaiPendingPlanInput = {
  approverIdPeg: number;
  approverJabatan: string;
  periode: string; // 'YYYY-MM'
};

export type PegawaiPendingPlanRow = {
  id_peg: number;
  nama_pegawai: string;
  total_request: number;
};

export async function listPegawaiPendingPlan(
  opts: ListPegawaiPendingPlanInput,
): Promise<PegawaiPendingPlanRow[]> {
  const approvableIds = await getApprovableCallListIdPegs(opts.approverIdPeg, opts.approverJabatan);
  if (approvableIds.length === 0) return [];

  const startDate = `${opts.periode}-01`;
  const endDate = lastDayOfMonth(opts.periode);
  const tglPlanFilter = getTglPlanFilter();

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
        isNull(call_plan_actual.approval),
        isNotNull(call_plan_actual.tgl_plan),
        gte(call_plan_actual.tgl_plan, startDate),
        lte(call_plan_actual.tgl_plan, endDate),
        gte(call_plan_actual.tgl_plan, tglPlanFilter),
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
// 2) Detail pending plans milik pegawai tertentu
// ---------------------------------------------------------------------------

export type ListPlanDetailsInput = {
  approverIdPeg: number;
  approverJabatan: string;
  targetIdPeg: number;
  periode: string;
};

export type CallPlanDetailRow = {
  id: string;
  tgl_plan: string | null;
  waktu: string | null;
  id_mcl: number | null;
  nama_dokter: string | null;
  spec: string | null;
  segmen_md: number | null;
  class: string | null;
  institusi: string | null;
  alamat_praktek: string | null;
};

export async function listCallPlanDetailsForPegawai(
  opts: ListPlanDetailsInput,
): Promise<CallPlanDetailRow[]> {
  // Authority check: target HARUS ada di approvable scope. Kalau tidak → [].
  // Sama dengan Approval Call List — empty bukan throw, supaya consistent
  // dengan deadline-passed behavior.
  const approvableIds = await getApprovableCallListIdPegs(opts.approverIdPeg, opts.approverJabatan);
  if (!approvableIds.includes(opts.targetIdPeg)) {
    return [];
  }

  const startDate = `${opts.periode}-01`;
  const endDate = lastDayOfMonth(opts.periode);
  const tglPlanFilter = getTglPlanFilter();

  return db
    .select({
      id: call_plan_actual.id,
      tgl_plan: call_plan_actual.tgl_plan,
      waktu: call_plan_actual.waktu,
      id_mcl: call_plan_actual.id_mcl,
      nama_dokter: call_plan_actual.nama_dokter,
      spec: call_plan_actual.spec,
      segmen_md: call_plan_actual.segmen_md,
      class: call_plan_actual.class,
      institusi: call_plan_actual.institusi,
      alamat_praktek: call_plan_actual.alamat_praktek,
    })
    .from(call_plan_actual)
    .where(
      and(
        eq(call_plan_actual.id_peg, opts.targetIdPeg),
        isNull(call_plan_actual.approval),
        isNotNull(call_plan_actual.tgl_plan),
        gte(call_plan_actual.tgl_plan, startDate),
        lte(call_plan_actual.tgl_plan, endDate),
        gte(call_plan_actual.tgl_plan, tglPlanFilter),
      ),
    )
    .orderBy(asc(call_plan_actual.tgl_plan), asc(call_plan_actual.waktu));
}

// ---------------------------------------------------------------------------
// 3) Batch approve/reject
// ---------------------------------------------------------------------------

export type BatchPlanApprovalItem = {
  id: string;
  approval: 'Approve' | 'Reject';
  approval_comment?: string;
};

export type BatchPlanApprovalInput = {
  approverIdPeg: number;
  approverJabatan: string;
  approvals: BatchPlanApprovalItem[];
};

export type BatchPlanApprovalResult = {
  total: number;
  approved: number;
  rejected: number;
};

export async function batchApproveCallPlan(
  opts: BatchPlanApprovalInput,
): Promise<BatchPlanApprovalResult> {
  if (opts.approvals.length === 0) {
    throw new ValidationError('Batch approvals tidak boleh kosong.');
  }

  const ids = opts.approvals.map((a) => a.id);

  // 1. Fetch existing rows (with tgl_plan untuk deadline check).
  const existing = await db
    .select({
      id: call_plan_actual.id,
      id_peg: call_plan_actual.id_peg,
      tgl_plan: call_plan_actual.tgl_plan,
    })
    .from(call_plan_actual)
    .where(inArray(call_plan_actual.id, ids));

  if (existing.length === 0) {
    return { total: 0, approved: 0, rejected: 0 };
  }

  // 2. Multi-periode guard.
  const periodeSet = new Set<string>();
  for (const r of existing) {
    if (r.tgl_plan) periodeSet.add(r.tgl_plan.slice(0, 7));
  }
  if (periodeSet.size > 1) {
    throw new ValidationError(
      'Batch berisi call_plan dari multiple periode. Pisahkan request per periode.',
      { detected_periodes: [...periodeSet] },
    );
  }

  // 3. Authority check per row.
  const approvableIds = await getApprovableCallListIdPegs(opts.approverIdPeg, opts.approverJabatan);
  const approvableSet = new Set(approvableIds);
  const unauthorizedIds = existing.filter((r) => !approvableSet.has(r.id_peg)).map((r) => r.id);
  if (unauthorizedIds.length > 0) {
    throw new DomainError({
      message: 'Tidak boleh approve call_plan dari pegawai di luar scope Anda.',
      statusCode: 403,
      code: 'NOT_APPROVER_FOR_ROW',
      details: { ids: unauthorizedIds },
    });
  }

  // 4. Per-row deadline check (legacy lines 752-773).
  const now = new Date();
  const today = todayWIB(now);
  const lewatJam = sudahLewatJamWIB(BATAS_JAM_PLAN, now);

  for (const r of existing) {
    if (!r.tgl_plan) continue; // safety; filtered by isNotNull elsewhere
    if (r.tgl_plan < today) {
      throw new DeadlinePassedError(
        `Approval call plan gagal: tgl_plan (${r.tgl_plan}) sudah terlewat. Approval hanya bisa dilakukan sampai hari tgl_plan sebelum pukul ${BATAS_JAM_PLAN}:00 WIB.`,
        'APPROVAL_PLAN_EXPIRED',
        { id: r.id, tgl_plan: r.tgl_plan },
      );
    }
    if (r.tgl_plan === today && lewatJam) {
      throw new DeadlinePassedError(
        `Approval call plan gagal: sudah melewati pukul ${BATAS_JAM_PLAN}:00 WIB untuk tgl_plan hari ini.`,
        'APPROVAL_PLAN_TIME_EXPIRED',
        { id: r.id, tgl_plan: r.tgl_plan },
      );
    }
  }

  // 5. Map decisions by id (silent-skip yang tidak ada di DB).
  const existingIdSet = new Set(existing.map((r) => r.id));
  const validDecisions = opts.approvals.filter((a) => existingIdSet.has(a.id));

  // 6. Transaction: UPDATE per item. Cascade reject ke approval_actual.
  let approved = 0;
  let rejected = 0;

  await db.transaction(async (tx) => {
    for (const item of validDecisions) {
      const isApprove = item.approval === 'Approve';
      const comment = isApprove ? null : (item.approval_comment ?? null);

      const updateData: Record<string, unknown> = {
        approval: item.approval,
        approval_by: opts.approverIdPeg,
        approval_date: now,
        approval_comment: comment,
        updated_by: opts.approverIdPeg,
        updated_at: now,
      };

      if (!isApprove) {
        // Cascade: plan rejected → actual auto-rejected (mirror legacy 783-787).
        updateData.approval_actual = 'Reject';
        updateData.approval_actual_by = opts.approverIdPeg;
        updateData.approval_actual_date = now;
      }

      await tx.update(call_plan_actual).set(updateData).where(eq(call_plan_actual.id, item.id));

      if (isApprove) approved++;
      else rejected++;
    }
  });

  return { total: validDecisions.length, approved, rejected };
}
