/**
 * Service untuk endpoint Call Plan.
 *
 * Port dari VisitController::{displayCallPlan, callPlanDoctor, callPlanInst,
 * saveCallPlan, deleteCallPlan} di legacy Laravel.
 *
 * Mapping legacy → Hono:
 *   /call-plan-data    → listCallPlan
 *   /call-plan-doctor  → listEligibleDoctors
 *   /call-plan-inst    → listInstitutions
 *   /call-plan-save    → createCallPlan
 *   /call-plan-delete  → deleteCallPlan
 *
 * Catatan: row "Plan-only" di `call_plan_actual` dibedakan dengan filter
 * `tgl_plan IS NOT NULL`. Saat Actual diisi, `tgl_actual` di-set di sini juga.
 * Delete Plan ditolak kalau `tgl_actual` sudah ada (sudah jadi Actual).
 *
 * Tidak ada update Plan di legacy — flow-nya delete + create ulang.
 */

import {
  and,
  asc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import { db } from '../config/database';
import { data_pegawai, list_dokter_visit_new, struktur } from '../db/schema/master';
import { call_list, call_plan_actual } from '../db/schema/transactional';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors';
import { getVisibleIdPeg } from './struktur.service';

// ---------------------------------------------------------------------------
// LIST — port displayCallPlan
// ---------------------------------------------------------------------------

export type ListCallPlanOpts = {
  viewerIdPeg: number;
  viewerJabatan: string;
  periode?: string; // 'YYYY-MM' → filter tgl_plan LIKE 'YYYY-MM-%'
  date?: string; // 'YYYY-MM-DD' → exact tgl_plan
  search?: string; // match nama_dokter atau institusi
};

export async function listCallPlan(opts: ListCallPlanOpts) {
  const visibleIds = await getVisibleIdPeg(opts.viewerIdPeg, opts.viewerJabatan);

  const conds: SQL[] = [
    isNotNull(call_plan_actual.tgl_plan),
    inArray(call_plan_actual.id_peg, visibleIds),
  ];

  if (opts.date) {
    conds.push(eq(call_plan_actual.tgl_plan, opts.date));
  } else if (opts.periode) {
    // periode 'YYYY-MM' → range awal..akhir bulan untuk leverage index pada tgl_plan
    const start = `${opts.periode}-01`;
    const [year, month] = opts.periode.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const end = `${opts.periode}-${String(lastDay).padStart(2, '0')}`;
    conds.push(gte(call_plan_actual.tgl_plan, start));
    conds.push(lte(call_plan_actual.tgl_plan, end));
  }

  if (opts.search) {
    const pat = `%${opts.search}%`;
    const orCond = or(
      ilike(call_plan_actual.nama_dokter, pat),
      ilike(call_plan_actual.institusi, pat),
    );
    if (orCond) conds.push(orCond);
  }

  return db
    .select({
      id: call_plan_actual.id,
      id_peg: call_plan_actual.id_peg,
      id_ff: call_plan_actual.id_ff,
      nama_ff: call_plan_actual.nama_ff,
      divisi: call_plan_actual.divisi,
      id_mcl: call_plan_actual.id_mcl,
      nama_dokter: call_plan_actual.nama_dokter,
      spec: call_plan_actual.spec,
      segmen_md: call_plan_actual.segmen_md,
      class: call_plan_actual.class,
      institusi: call_plan_actual.institusi,
      alamat_praktek: call_plan_actual.alamat_praktek,
      koordinat_institusi: call_plan_actual.koordinat_institusi,
      tgl_plan: call_plan_actual.tgl_plan,
      waktu: call_plan_actual.waktu,
      product_list: call_plan_actual.product_list,
      keterangan: call_plan_actual.keterangan,
      tgl_actual: call_plan_actual.tgl_actual,
      status: call_plan_actual.status,
      approval: call_plan_actual.approval,
      approval_by: call_plan_actual.approval_by,
      approval_date: call_plan_actual.approval_date,
      approval_comment: call_plan_actual.approval_comment,
      approval_actual: call_plan_actual.approval_actual,
      created_at: call_plan_actual.created_at,
      updated_at: call_plan_actual.updated_at,
    })
    .from(call_plan_actual)
    .where(and(...conds))
    .orderBy(asc(call_plan_actual.tgl_plan), asc(call_plan_actual.waktu));
}

// ---------------------------------------------------------------------------
// ELIGIBLE DOCTORS — port callPlanDoctor
// ---------------------------------------------------------------------------

export type EligibleDoctorsOpts = {
  viewerIdPeg: number;
  viewerJabatan: string;
  periode?: string; // 'YYYY-MM' → filter call_list.periode
  search?: string;
  limit: number;
};

export async function listEligibleDoctors(opts: EligibleDoctorsOpts) {
  const visibleIds = await getVisibleIdPeg(opts.viewerIdPeg, opts.viewerJabatan);

  const conds: SQL[] = [inArray(call_list.id_peg, visibleIds), eq(call_list.approval, 'Approve')];

  if (opts.periode) {
    conds.push(eq(call_list.periode, `${opts.periode}-01`));
  }

  if (opts.search) {
    conds.push(ilike(call_list.nama_dokter, `%${opts.search}%`));
  }

  return db
    .select({
      id_call_list: call_list.id,
      id_mcl: call_list.id_mcl,
      id_ff: call_list.id_ff,
      nama_dokter: call_list.nama_dokter,
      spec: call_list.spec,
      segmen: call_list.segmen,
      class: call_list.class,
      id_peg: call_list.id_peg,
      periode: call_list.periode,
    })
    .from(call_list)
    .where(and(...conds))
    .orderBy(asc(call_list.nama_dokter))
    .limit(opts.limit);
}

// ---------------------------------------------------------------------------
// INSTITUTIONS — port callPlanInst
// ---------------------------------------------------------------------------

export type InstitutionsOpts = {
  viewerIdPeg: number;
  viewerJabatan: string;
  idMcl: number;
};

/**
 * Resolve daftar institusi (lokasi praktek) untuk satu dokter (id_mcl).
 *
 * Legacy `callPlanInst` melakukan hierarchy resolution: untuk DM/RSM/PE/PM,
 * `id_ff` MR di-resolve ke atasannya via tabel `struktur`. Kita pakai
 * `data_pegawai.id` user untuk menentukan jabatan, lalu derive `id_ff` &
 * `nama_ff` yang tepat untuk row Plan.
 *
 * Output schema: list `{ id_mcl, id_ff_mr, nama_ff_mr, id_ff, nama_ff, divisi,
 * institusi, alamat_praktek, koordinat_institusi, segmen_md }` — sama dengan
 * legacy.
 */
export async function listInstitutions(opts: InstitutionsOpts) {
  const [viewer] = await db
    .select({
      id_pegawai: data_pegawai.id,
      nama: data_pegawai.nama,
      jabatan: data_pegawai.jabatan,
      divisi: data_pegawai.divisi,
    })
    .from(data_pegawai)
    .where(eq(data_pegawai.rowid, opts.viewerIdPeg))
    .limit(1);

  if (!viewer) {
    throw new NotFoundError(`Pegawai id_peg=${opts.viewerIdPeg} tidak ditemukan`);
  }

  const upperJab = (viewer.jabatan ?? '').toUpperCase();
  const isDM = upperJab === 'DM' || upperJab === 'ACT. DM';
  const isRSM = upperJab === 'RSM';
  const isPEPM = upperJab.includes('PE') || upperJab.includes('PM');
  const visibleIds = await getVisibleIdPeg(opts.viewerIdPeg, viewer.jabatan ?? '');
  const today = new Date().toISOString().slice(0, 10);
  const divisiArray = viewer.divisi
    ? viewer.divisi
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Master rows untuk id_mcl ini, dibatasi ke MR yang ada di struktur user.
  const rows = await db
    .select({
      id_mcl: list_dokter_visit_new.ID,
      id_ff_mr: list_dokter_visit_new.ID_FF,
      nama_ff_mr: list_dokter_visit_new.NAMA_FF,
      divisi: list_dokter_visit_new.DIVISI,
      institusi: list_dokter_visit_new.INSTITUSI,
      alamat_praktek: list_dokter_visit_new.ALAMAT_PRAKTEK,
      koordinat_institusi: list_dokter_visit_new.KOORDINAT_INSTITUSI,
      segmen_md: list_dokter_visit_new.SEGMEN_MD,
      id_peg_owner: list_dokter_visit_new.ID_PEG,
    })
    .from(list_dokter_visit_new)
    .where(
      and(
        eq(list_dokter_visit_new.ID, opts.idMcl),
        inArray(list_dokter_visit_new.ID_PEG, visibleIds),
        or(
          isNull(list_dokter_visit_new.STATUS_MD),
          eq(list_dokter_visit_new.STATUS_MD, 'AKTIF'),
          eq(list_dokter_visit_new.STATUS_MD, 'ACTIVE'),
        ),
      ),
    )
    .orderBy(asc(list_dokter_visit_new.INSTITUSI));

  if (rows.length === 0) return [];

  // Untuk DM/RSM: resolve `id_ff` & `nama_ff` ke supervisor via struktur.
  // Untuk PE/PM: pakai data viewer langsung.
  // Untuk lainnya (MR/PS/KAE): id_ff = id_ff_mr.
  if (isPEPM) {
    return rows.map((r) => ({
      ...r,
      id_ff: viewer.id_pegawai,
      nama_ff: viewer.nama,
      divisi: divisiArray.length === 1 ? divisiArray[0] : r.divisi,
    }));
  }

  if (!isDM && !isRSM) {
    return rows.map((r) => ({
      ...r,
      id_ff: r.id_ff_mr,
      nama_ff: r.nama_ff_mr,
    }));
  }

  // Lookup struktur untuk MR-MR yang terkait
  const mrIdFfList = rows.map((r) => r.id_ff_mr).filter(Boolean);
  if (mrIdFfList.length === 0) {
    return rows.map((r) => ({
      ...r,
      id_ff: r.id_ff_mr,
      nama_ff: r.nama_ff_mr,
    }));
  }

  const strukturRows = await db
    .select({
      id_mr: struktur.id_mr,
      id_dm: struktur.id_dm,
      id_peg_dm: struktur.id_peg_dm,
      id_rsm: struktur.id_rsm,
      id_peg_rsm: struktur.id_peg_rsm,
    })
    .from(struktur)
    .where(
      and(
        inArray(struktur.id_mr, mrIdFfList),
        lte(struktur.periode_awal, today),
        gte(struktur.periode_akhir, today),
      ),
    );

  // Index by id_mr → supervisor info
  const byMr = new Map<string, { id_ff: string | null; id_peg: number | null }>();
  for (const s of strukturRows) {
    if (!s.id_mr) continue;
    if (isDM) {
      byMr.set(s.id_mr, { id_ff: s.id_dm ?? null, id_peg: s.id_peg_dm ?? null });
    } else if (isRSM) {
      byMr.set(s.id_mr, { id_ff: s.id_rsm ?? null, id_peg: s.id_peg_rsm ?? null });
    }
  }

  // Resolve nama supervisor (DM/RSM) dari data_pegawai
  const supervisorIdPegSet = new Set<number>();
  for (const v of byMr.values()) {
    if (v.id_peg != null) supervisorIdPegSet.add(v.id_peg);
  }
  const supervisorIdPegs = [...supervisorIdPegSet];
  const supervisors = supervisorIdPegs.length
    ? await db
        .select({ rowid: data_pegawai.rowid, nama: data_pegawai.nama })
        .from(data_pegawai)
        .where(inArray(data_pegawai.rowid, supervisorIdPegs))
    : [];
  const namaByRowid = new Map(supervisors.map((s) => [s.rowid, s.nama]));

  return rows.map((r) => {
    const sup = byMr.get(r.id_ff_mr);
    return {
      ...r,
      id_ff: sup?.id_ff ?? r.id_ff_mr,
      nama_ff: sup?.id_peg != null ? (namaByRowid.get(sup.id_peg) ?? r.nama_ff_mr) : r.nama_ff_mr,
    };
  });
}

// ---------------------------------------------------------------------------
// CREATE — port saveCallPlan
// ---------------------------------------------------------------------------

export type CreateCallPlanInput = {
  idPeg: number;
  idMcl: number;
  tglPlan: string; // 'YYYY-MM-DD'
  waktu: string; // 'HH:MM' or 'HH:MM:SS'
  institusi?: string;
  alamatPraktek?: string;
  koordinatInstitusi?: string;
  productList?: number[];
  keterangan?: string;
};

export async function createCallPlan(opts: CreateCallPlanInput) {
  // 1. Pastikan pegawai owner valid & ambil id_ff + nama + divisi.
  const [peg] = await db
    .select({
      rowid: data_pegawai.rowid,
      id_ff: data_pegawai.id,
      nama: data_pegawai.nama,
      divisi: data_pegawai.divisi,
    })
    .from(data_pegawai)
    .where(eq(data_pegawai.rowid, opts.idPeg))
    .limit(1);
  if (!peg) {
    throw new NotFoundError(`Pegawai id_peg=${opts.idPeg} tidak ditemukan`);
  }

  // 2. Snapshot dokter dari master (nama, spec, segmen, class + alamat fallback).
  const [snap] = await db
    .select({
      NAMA_DOKTER: list_dokter_visit_new.NAMA_DOKTER,
      SPEC: list_dokter_visit_new.SPEC,
      CLASS: list_dokter_visit_new.CLASS,
      SEGMEN_MD: list_dokter_visit_new.SEGMEN_MD,
      INSTITUSI: list_dokter_visit_new.INSTITUSI,
      ALAMAT_PRAKTEK: list_dokter_visit_new.ALAMAT_PRAKTEK,
      KOORDINAT_INSTITUSI: list_dokter_visit_new.KOORDINAT_INSTITUSI,
    })
    .from(list_dokter_visit_new)
    .where(eq(list_dokter_visit_new.ID, opts.idMcl))
    .limit(1);
  if (!snap) {
    throw new NotFoundError(`Dokter id_mcl=${opts.idMcl} tidak ditemukan`);
  }

  // 3. Anti-duplikasi: (id_peg, id_mcl, tgl_plan) tidak boleh ganda.
  const [dup] = await db
    .select({ id: call_plan_actual.id })
    .from(call_plan_actual)
    .where(
      and(
        eq(call_plan_actual.id_peg, opts.idPeg),
        eq(call_plan_actual.id_mcl, opts.idMcl),
        eq(call_plan_actual.tgl_plan, opts.tglPlan),
      ),
    )
    .limit(1);
  if (dup) {
    throw new ConflictError(
      'Call plan untuk dokter ini pada tanggal tersebut sudah ada.',
      'DUPLICATE_PLAN',
    );
  }

  // 4. Insert.
  const [inserted] = await db
    .insert(call_plan_actual)
    .values({
      id_peg: opts.idPeg,
      id_ff: peg.id_ff,
      nama_ff: peg.nama,
      divisi: peg.divisi ?? null,
      id_mcl: opts.idMcl,
      nama_dokter: snap.NAMA_DOKTER,
      spec: snap.SPEC,
      segmen_md: snap.SEGMEN_MD,
      class: snap.CLASS ?? null,
      institusi: opts.institusi ?? snap.INSTITUSI ?? null,
      alamat_praktek: opts.alamatPraktek ?? snap.ALAMAT_PRAKTEK ?? null,
      koordinat_institusi: opts.koordinatInstitusi ?? snap.KOORDINAT_INSTITUSI ?? null,
      tgl_plan: opts.tglPlan,
      waktu: opts.waktu.length === 5 ? `${opts.waktu}:00` : opts.waktu,
      product_list: opts.productList ? JSON.stringify(opts.productList) : null,
      keterangan: opts.keterangan ?? null,
      created_by: opts.idPeg,
      updated_by: opts.idPeg,
    })
    .returning({
      id: call_plan_actual.id,
      id_mcl: call_plan_actual.id_mcl,
      tgl_plan: call_plan_actual.tgl_plan,
      waktu: call_plan_actual.waktu,
    });

  return inserted;
}

// ---------------------------------------------------------------------------
// DELETE — port deleteCallPlan
// ---------------------------------------------------------------------------

export type DeleteCallPlanInput = {
  callPlanId: string;
  viewerIdPeg: number;
};

export async function deleteCallPlan(opts: DeleteCallPlanInput) {
  const [row] = await db
    .select({
      id: call_plan_actual.id,
      id_peg: call_plan_actual.id_peg,
      tgl_actual: call_plan_actual.tgl_actual,
    })
    .from(call_plan_actual)
    .where(eq(call_plan_actual.id, opts.callPlanId))
    .limit(1);
  if (!row) {
    throw new NotFoundError(`Call plan ${opts.callPlanId} tidak ditemukan`);
  }
  if (row.id_peg !== opts.viewerIdPeg) {
    throw new ForbiddenError('Tidak boleh delete call plan milik pegawai lain.');
  }
  if (row.tgl_actual !== null) {
    throw new ConflictError(
      'Cannot delete! This plan already has actual visit date.',
      'CALL_ACTUAL_EXISTS',
    );
  }

  await db.delete(call_plan_actual).where(eq(call_plan_actual.id, opts.callPlanId));

  return { id: opts.callPlanId, deleted: true };
}
