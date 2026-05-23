/**
 * Service untuk Approval Call List.
 *
 * Port dari VisitApprovalController::{DmApprovalListName, DmApprovalListDetails,
 * DmApprovalListSave} di legacy Laravel.
 *
 * Mapping legacy → Hono (RESTful):
 *   POST /dm-approval-list-name    → GET  /api/approval/call-list/pegawai
 *   POST /dm-approval-list-details → GET  /api/approval/call-list
 *   POST /dm-approval-list-save    → POST /api/approval/call-list/batch
 *
 * Hardening dibanding legacy:
 * - **Authority per-row check** di batch save: row.id_peg HARUS ∈ approvable scope.
 *   Legacy silent-update tanpa cek. Kita throw 403 NOT_APPROVER_FOR_ROW.
 * - **Multi-periode batch guard**: kalau row antar-periode beda → 422 MIXED_PERIODES.
 *   Legacy cuma cek periode row pertama (smuggle-able). Kita pre-check semua.
 * - **Audit trail**: insert ke `call_list_history` per approve/reject (legacy
 *   tidak audit approval action).
 *
 * Tetap match legacy:
 * - Deadline lewat → list/details return [] (silent), batch save → 422 ERROR.
 * - `approval_comment` hanya disimpan kalau Reject (auto-null saat Approve).
 * - Silent-skip row ID yang tidak ada di DB.
 */

import { and, asc, count as countSql, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../config/database';
import { data_pegawai } from '../db/schema/master';
import { call_list, call_list_history } from '../db/schema/transactional';
import { DeadlinePassedError, DomainError, ValidationError } from '../lib/errors';
import { getApprovalListDeadline, isApprovalListDeadlinePassed } from './approval-deadline.service';
import { getApprovableCallListIdPegs } from './struktur.service';

function periodeToIsoDate(periode: string): string {
  return `${periode}-01`;
}

function formatDeadlineWIB(d: Date): string {
  const wib = new Date(d.getTime() + 7 * 3_600_000);
  return wib.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 1) List pegawai bawahan yang punya pending call_list di periode
// ---------------------------------------------------------------------------

export type ListPegawaiPendingInput = {
  approverIdPeg: number;
  approverJabatan: string;
  periode: string; // 'YYYY-MM'
};

export type PegawaiPendingRow = {
  id_peg: number;
  nama_pegawai: string;
  total_request: number;
};

export async function listPegawaiPending(
  opts: ListPegawaiPendingInput,
): Promise<PegawaiPendingRow[]> {
  // Deadline lewat → empty (legacy behavior).
  if (await isApprovalListDeadlinePassed(opts.approverIdPeg, opts.periode)) {
    return [];
  }

  const approvableIds = await getApprovableCallListIdPegs(opts.approverIdPeg, opts.approverJabatan);
  if (approvableIds.length === 0) return [];

  const periodeIso = periodeToIsoDate(opts.periode);

  const rows = await db
    .select({
      id_peg: data_pegawai.rowid,
      nama_pegawai: data_pegawai.nama,
      total_request: countSql(call_list.id).as('total_request'),
    })
    .from(call_list)
    .innerJoin(data_pegawai, eq(data_pegawai.rowid, call_list.id_peg))
    .where(
      and(
        inArray(call_list.id_peg, approvableIds),
        eq(call_list.periode, periodeIso),
        isNull(call_list.approval),
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
// 2) Detail call_list pending milik pegawai tertentu
// ---------------------------------------------------------------------------

export type ListDetailsInput = {
  approverIdPeg: number;
  approverJabatan: string;
  targetIdPeg: number;
  periode: string;
};

export type CallListDetailRow = {
  id: string;
  periode: string | null;
  nama_dokter: string;
  spec: string;
  segmen: string;
  class: string | null;
};

export async function listCallListDetailsForPegawai(
  opts: ListDetailsInput,
): Promise<CallListDetailRow[]> {
  if (await isApprovalListDeadlinePassed(opts.approverIdPeg, opts.periode)) {
    return [];
  }

  // Authority check: target HARUS ada di approvable scope. Kalau tidak → [].
  // Decision: return empty (bukan throw) supaya consistent dengan deadline-passed
  // behavior. Lebih ramah UX kalau user buka link expired.
  const approvableIds = await getApprovableCallListIdPegs(opts.approverIdPeg, opts.approverJabatan);
  if (!approvableIds.includes(opts.targetIdPeg)) {
    return [];
  }

  const periodeIso = periodeToIsoDate(opts.periode);

  return db
    .select({
      id: call_list.id,
      periode: call_list.periode,
      nama_dokter: call_list.nama_dokter,
      spec: call_list.spec,
      segmen: call_list.segmen,
      class: call_list.class,
    })
    .from(call_list)
    .where(
      and(
        eq(call_list.id_peg, opts.targetIdPeg),
        eq(call_list.periode, periodeIso),
        isNull(call_list.approval),
      ),
    )
    .orderBy(asc(call_list.periode), asc(call_list.nama_dokter));
}

// ---------------------------------------------------------------------------
// 3) Batch approve/reject
// ---------------------------------------------------------------------------

export type BatchApprovalItem = {
  id: string;
  approval: 'Approve' | 'Reject';
  approval_comment?: string;
};

export type BatchApprovalInput = {
  approverIdPeg: number;
  approverJabatan: string;
  approvals: BatchApprovalItem[];
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type BatchApprovalResult = {
  total: number;
  approved: number;
  rejected: number;
};

export async function batchApproveCallList(opts: BatchApprovalInput): Promise<BatchApprovalResult> {
  if (opts.approvals.length === 0) {
    throw new ValidationError('Batch approvals tidak boleh kosong.');
  }

  const ids = opts.approvals.map((a) => a.id);

  // 1. Fetch existing rows.
  const existing = await db
    .select({
      id: call_list.id,
      id_peg: call_list.id_peg,
      periode: call_list.periode,
    })
    .from(call_list)
    .where(inArray(call_list.id, ids));

  if (existing.length === 0) {
    // Semua ID tidak ada di DB → return summary 0/0/0 (silent skip ala legacy).
    return { total: 0, approved: 0, rejected: 0 };
  }

  // 2. Multi-periode guard.
  const periodeSet = new Set<string>();
  for (const r of existing) {
    if (r.periode) periodeSet.add(r.periode.slice(0, 7));
  }
  if (periodeSet.size > 1) {
    throw new ValidationError(
      'Batch berisi call_list dari multiple periode. Pisahkan request per periode.',
      { detected_periodes: [...periodeSet] },
    );
  }
  const periode = [...periodeSet][0] ?? null;

  // 3. Deadline check (pakai periode batch).
  if (periode) {
    const passed = await isApprovalListDeadlinePassed(opts.approverIdPeg, periode);
    if (passed) {
      const deadline = await getApprovalListDeadline(opts.approverIdPeg, periode);
      const deadlineStr = deadline ? formatDeadlineWIB(deadline) : '-';
      throw new DeadlinePassedError(
        `Approval call list tidak dapat dilakukan. Batas waktu sudah terlewat (deadline: ${deadlineStr}).`,
        'APPROVAL_LIST_EXPIRED',
        { periode, deadline: deadline?.toISOString() ?? null },
      );
    }
  }

  // 4. Authority check per row.
  const approvableIds = await getApprovableCallListIdPegs(opts.approverIdPeg, opts.approverJabatan);
  const approvableSet = new Set(approvableIds);
  const unauthorizedIds = existing.filter((r) => !approvableSet.has(r.id_peg)).map((r) => r.id);
  if (unauthorizedIds.length > 0) {
    throw new DomainError({
      message: 'Tidak boleh approve call_list dari pegawai di luar scope Anda.',
      statusCode: 403,
      code: 'NOT_APPROVER_FOR_ROW',
      details: { ids: unauthorizedIds },
    });
  }

  // 5. Map decisions by id (silent-skip yang tidak ada di DB).
  const existingIdSet = new Set(existing.map((r) => r.id));
  const validDecisions = opts.approvals.filter((a) => existingIdSet.has(a.id));

  // 6. Transaction: UPDATE + INSERT history per item.
  const now = new Date();
  let approved = 0;
  let rejected = 0;

  await db.transaction(async (tx) => {
    for (const item of validDecisions) {
      const isApprove = item.approval === 'Approve';
      const comment = isApprove ? null : (item.approval_comment ?? null);

      await tx
        .update(call_list)
        .set({
          approval: item.approval,
          approval_by: opts.approverIdPeg,
          approval_date: now,
          approval_comment: comment,
          updated_by: opts.approverIdPeg,
          updated_at: now,
        })
        .where(eq(call_list.id, item.id));

      await tx.insert(call_list_history).values({
        call_list_id: item.id,
        id_peg: opts.approverIdPeg,
        action_type: isApprove ? 'approve' : 'reject',
        reason: comment,
        ip_address: opts.ipAddress ?? null,
        user_agent: opts.userAgent ?? null,
      });

      if (isApprove) approved++;
      else rejected++;
    }
  });

  return { total: validDecisions.length, approved, rejected };
}
