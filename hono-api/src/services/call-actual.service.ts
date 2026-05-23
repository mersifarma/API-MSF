/**
 * Service untuk endpoint Call Actual.
 *
 * Port dari VisitController::{displayActual, getActualDetails, saveActual,
 * saveUnplanned, createJoinVisitRecordsForAtasan} di legacy Laravel.
 *
 * Mapping legacy → Hono:
 *   POST /call-actual-data           → listCallActual
 *   GET  /call-actual-details/{id}   → getCallActualDetails
 *   POST /call-actual-save           → saveActual (PATCH /:id di Hono)
 *   POST /unplan-actual-save         → saveUnplannedActual (POST /unplan)
 *
 * Business rules:
 *   - `tgl_actual` HARUS = today (TZ Asia/Jakarta) — anti device time tampering.
 *   - Untuk status mengandung 'offline': selisih (tgl_actual+waktu_actual) vs
 *     now() di WIB ≤ OFFLINE_VISIT_WINDOW_MINUTES (default 60 menit).
 *   - Unplan anti-duplikasi: (id_peg, id_mcl, tgl_actual) unique — sudah
 *     enforced di DB level via uniqueIndex `cpa_unique` (lihat schema), tapi
 *     kita cek dulu untuk error message yang ramah.
 *   - Join Visit copy: tiap atasan di `join_visit_id` (CSV) → INSERT row baru
 *     dengan status='join_visit', join_visit_ff = MR record ID, koor_visit=NULL.
 */

import { and, asc, eq, gte, ilike, inArray, isNotNull, lte, or, type SQL } from 'drizzle-orm';
import { db } from '../config/database';
import { data_pegawai } from '../db/schema/master';
import { call_plan_actual } from '../db/schema/transactional';
import { ConflictError, DeadlinePassedError, ForbiddenError, NotFoundError } from '../lib/errors';
import { OFFLINE_VISIT_WINDOW_MINUTES } from '../lib/constants';
import { diffMinutes, parseDateTimeWIB, todayWIB } from '../lib/timezone';
import { getVisibleIdPeg } from './struktur.service';

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export type ListCallActualOpts = {
  viewerIdPeg: number;
  viewerJabatan: string;
  periode?: string; // 'YYYY-MM'
  date?: string; // 'YYYY-MM-DD'
  search?: string;
};

export async function listCallActual(opts: ListCallActualOpts) {
  const visibleIds = await getVisibleIdPeg(opts.viewerIdPeg, opts.viewerJabatan);

  const conds: SQL[] = [
    isNotNull(call_plan_actual.status),
    inArray(call_plan_actual.id_peg, visibleIds),
  ];

  if (opts.date) {
    conds.push(eq(call_plan_actual.tgl_actual, opts.date));
  } else if (opts.periode) {
    const start = `${opts.periode}-01`;
    const [year, month] = opts.periode.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const end = `${opts.periode}-${String(lastDay).padStart(2, '0')}`;
    conds.push(gte(call_plan_actual.tgl_actual, start));
    conds.push(lte(call_plan_actual.tgl_actual, end));
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
    .select()
    .from(call_plan_actual)
    .where(and(...conds))
    .orderBy(asc(call_plan_actual.tgl_actual), asc(call_plan_actual.waktu_actual));
}

// ---------------------------------------------------------------------------
// DETAILS — with join_visit_names resolution
// ---------------------------------------------------------------------------

export async function getCallActualDetails(id: string) {
  const [row] = await db
    .select()
    .from(call_plan_actual)
    .where(eq(call_plan_actual.id, id))
    .limit(1);
  if (!row) {
    throw new NotFoundError(`Call actual ${id} tidak ditemukan`);
  }

  const joinVisitNames: string[] = [];

  if (row.status !== 'join_visit' && row.join_visit_ff) {
    // Row MR: join_visit_ff = CSV peg ID atasan (varchar 30)
    const ids = row.join_visit_ff
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length > 0) {
      const pegs = await db
        .select({ rowid: data_pegawai.rowid, nama: data_pegawai.nama })
        .from(data_pegawai)
        .where(inArray(data_pegawai.rowid, ids));
      for (const p of pegs) joinVisitNames.push(p.nama);
    }
  } else if (row.status === 'join_visit' && row.join_visit_id) {
    // Row atasan: join_visit_id = MR record UUID (self-FK)
    const [mr] = await db
      .select({
        id_peg: call_plan_actual.id_peg,
        join_visit_ff: call_plan_actual.join_visit_ff,
      })
      .from(call_plan_actual)
      .where(eq(call_plan_actual.id, row.join_visit_id))
      .limit(1);
    if (mr) {
      const [mrPeg] = await db
        .select({ nama: data_pegawai.nama })
        .from(data_pegawai)
        .where(eq(data_pegawai.rowid, mr.id_peg))
        .limit(1);
      if (mrPeg) joinVisitNames.push(mrPeg.nama);

      if (mr.join_visit_ff) {
        const otherIds = mr.join_visit_ff
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n) && n > 0 && n !== row.id_peg);
        if (otherIds.length > 0) {
          const others = await db
            .select({ nama: data_pegawai.nama })
            .from(data_pegawai)
            .where(inArray(data_pegawai.rowid, otherIds));
          for (const o of others) joinVisitNames.push(o.nama);
        }
      }
    }
  }

  return { ...row, join_visit_names: joinVisitNames };
}

// ---------------------------------------------------------------------------
// Guards (shared antara saveActual & saveUnplannedActual)
// ---------------------------------------------------------------------------

function assertTglActualIsToday(tglActual: string, now: Date) {
  if (tglActual !== todayWIB(now)) {
    throw new DeadlinePassedError(
      'Anda merubah tanggal device, sesuaikan dengan tanggal sekarang.',
      'INVALID_TIME_SETTING',
    );
  }
}

function assertOfflineWindow(
  status: string,
  tglActual: string,
  waktuActual: string | undefined,
  now: Date,
) {
  if (!status.toLowerCase().includes('offline')) return;
  if (!waktuActual) return;

  const visitMoment = parseDateTimeWIB(tglActual, waktuActual);
  // diff = visit − now. Negatif kalau visit di masa lalu.
  const minutes = diffMinutes(visitMoment, now);
  if (minutes < -OFFLINE_VISIT_WINDOW_MINUTES) {
    throw new DeadlinePassedError(
      `Gagal menyimpan: kunjungan sudah lebih dari ${OFFLINE_VISIT_WINDOW_MINUTES} menit yang lalu.`,
      'VISIT_TIME_EXPIRED',
    );
  }
}

// ---------------------------------------------------------------------------
// SAVE ACTUAL — UPDATE existing Plan row
// ---------------------------------------------------------------------------

export type SaveActualInput = {
  callPlanId: string;
  viewerIdPeg: number;
  koorVisit: string;
  tglActual: string;
  waktuActual?: string;
  status: string;
  sttKoor?: number;
  keterangan?: string;
  joinVisit?: 0 | 1;
  joinVisitId?: string; // CSV peg ID atasan
  foto?: string;
  tandaTangan?: string;
  now?: Date; // injectable for tests
};

export async function saveActual(opts: SaveActualInput) {
  const now = opts.now ?? new Date();
  assertTglActualIsToday(opts.tglActual, now);
  assertOfflineWindow(opts.status, opts.tglActual, opts.waktuActual, now);

  const [row] = await db
    .select({ id: call_plan_actual.id, id_peg: call_plan_actual.id_peg })
    .from(call_plan_actual)
    .where(eq(call_plan_actual.id, opts.callPlanId))
    .limit(1);
  if (!row) {
    throw new NotFoundError(`Call plan ${opts.callPlanId} tidak ditemukan`);
  }
  if (row.id_peg !== opts.viewerIdPeg) {
    throw new ForbiddenError('Tidak boleh save actual milik pegawai lain.');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(call_plan_actual)
      .set({
        keterangan: opts.keterangan ?? null,
        tgl_actual: opts.tglActual,
        waktu_actual: opts.waktuActual ?? null,
        koor_visit: opts.koorVisit,
        stt_koor: opts.sttKoor ?? 0,
        status: opts.status,
        join_visit: opts.joinVisit ?? 0,
        join_visit_ff: opts.joinVisitId ?? null,
        foto: opts.foto ?? null,
        tanda_tangan: opts.tandaTangan ?? null,
        updated_by: opts.viewerIdPeg,
        updated_at: now,
      })
      .where(eq(call_plan_actual.id, opts.callPlanId));

    if (opts.joinVisit === 1 && opts.joinVisitId) {
      await copyJoinVisitRowsTx(tx, opts.callPlanId, opts.joinVisitId, now);
    }
  });

  return { id: opts.callPlanId };
}

// ---------------------------------------------------------------------------
// SAVE UNPLANNED — INSERT row baru
// ---------------------------------------------------------------------------

export type SaveUnplannedInput = {
  viewerIdPeg: number;
  // Customer snapshot
  idMcl: number;
  namaDokter: string;
  spec: string;
  segmenMd: number;
  class?: string;
  institusi?: string;
  alamatPraktek?: string;
  koordinatInstitusi?: string;
  // Visit data
  koorVisit: string;
  tglActual: string;
  waktuActual?: string;
  status: string;
  sttKoor?: number;
  keterangan?: string;
  // Join visit
  joinVisit?: 0 | 1;
  joinVisitId?: string;
  // Product list
  productList?: number[];
  // Photos
  foto?: string;
  tandaTangan?: string;
  now?: Date;
};

export async function saveUnplannedActual(opts: SaveUnplannedInput) {
  const now = opts.now ?? new Date();
  assertTglActualIsToday(opts.tglActual, now);
  assertOfflineWindow(opts.status, opts.tglActual, opts.waktuActual, now);

  // Resolve id_ff + nama_ff + divisi dari data_pegawai (token-derived).
  const [peg] = await db
    .select({ id_ff: data_pegawai.id, nama: data_pegawai.nama, divisi: data_pegawai.divisi })
    .from(data_pegawai)
    .where(eq(data_pegawai.rowid, opts.viewerIdPeg))
    .limit(1);
  if (!peg) {
    throw new NotFoundError(`Pegawai id_peg=${opts.viewerIdPeg} tidak ditemukan`);
  }

  // Anti-duplikasi: (id_peg, id_mcl, tgl_actual) — kasih error message ramah
  // sebelum kena unique constraint di DB.
  const [dup] = await db
    .select({ id: call_plan_actual.id })
    .from(call_plan_actual)
    .where(
      and(
        eq(call_plan_actual.id_peg, opts.viewerIdPeg),
        eq(call_plan_actual.id_mcl, opts.idMcl),
        eq(call_plan_actual.tgl_actual, opts.tglActual),
      ),
    )
    .limit(1);
  if (dup) {
    throw new ConflictError(
      `${opts.namaDokter} sudah dikunjungi pada ${opts.tglActual}. Kunjungan tidak dapat disimpan lebih dari sekali dalam sehari.`,
      'ALREADY_VISITED_TODAY',
    );
  }

  const insertedId = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(call_plan_actual)
      .values({
        id_peg: opts.viewerIdPeg,
        id_ff: peg.id_ff,
        nama_ff: peg.nama,
        divisi: peg.divisi ?? null,
        id_mcl: opts.idMcl,
        nama_dokter: opts.namaDokter,
        spec: opts.spec,
        segmen_md: opts.segmenMd,
        class: opts.class ?? null,
        institusi: opts.institusi ?? null,
        alamat_praktek: opts.alamatPraktek ?? null,
        koordinat_institusi: opts.koordinatInstitusi ?? null,
        // Plan kosong (unplanned)
        tgl_plan: null,
        waktu: null,
        // Actual data
        tgl_actual: opts.tglActual,
        waktu_actual: opts.waktuActual ?? null,
        koor_visit: opts.koorVisit,
        stt_koor: opts.sttKoor ?? 0,
        status: opts.status,
        keterangan: opts.keterangan ?? null,
        // Join visit
        join_visit: opts.joinVisit ?? 0,
        join_visit_ff: opts.joinVisitId ?? null,
        // Product list
        product_list: opts.productList ? JSON.stringify(opts.productList) : null,
        // Photos
        foto: opts.foto ?? null,
        tanda_tangan: opts.tandaTangan ?? null,
        created_by: opts.viewerIdPeg,
        updated_by: opts.viewerIdPeg,
      })
      .returning({ id: call_plan_actual.id });

    if (opts.joinVisit === 1 && opts.joinVisitId) {
      await copyJoinVisitRowsTx(tx, inserted.id, opts.joinVisitId, now);
    }

    return inserted.id;
  });

  return { id: insertedId };
}

// ---------------------------------------------------------------------------
// JOIN VISIT COPY — insert row baru per atasan
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function copyJoinVisitRowsTx(tx: Tx, mrRecordId: string, joinVisitIdCsv: string, now: Date) {
  const atasanIds = joinVisitIdCsv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (atasanIds.length === 0) return;

  const [mrRecord] = await tx
    .select()
    .from(call_plan_actual)
    .where(eq(call_plan_actual.id, mrRecordId))
    .limit(1);
  if (!mrRecord) return;

  const atasanPegs = await tx
    .select({ rowid: data_pegawai.rowid, nama: data_pegawai.nama })
    .from(data_pegawai)
    .where(inArray(data_pegawai.rowid, atasanIds));
  const namaByRowid = new Map(atasanPegs.map((p) => [p.rowid, p.nama]));

  for (const atasanId of atasanIds) {
    // Anti-duplikasi: same (atasan, status='join_visit', join_visit_id=mrRecordId UUID)
    const [existing] = await tx
      .select({ id: call_plan_actual.id })
      .from(call_plan_actual)
      .where(
        and(
          eq(call_plan_actual.id_peg, atasanId),
          eq(call_plan_actual.status, 'join_visit'),
          eq(call_plan_actual.join_visit_id, mrRecordId),
        ),
      )
      .limit(1);
    if (existing) continue;

    await tx.insert(call_plan_actual).values({
      id_peg: atasanId,
      id_ff: mrRecord.id_ff,
      nama_ff: namaByRowid.get(atasanId) ?? mrRecord.nama_ff,
      divisi: mrRecord.divisi ?? null,
      tgl_plan: null,
      waktu: null,
      id_mcl: mrRecord.id_mcl,
      nama_dokter: mrRecord.nama_dokter,
      spec: mrRecord.spec,
      segmen_md: mrRecord.segmen_md,
      class: mrRecord.class,
      institusi: mrRecord.institusi,
      alamat_praktek: mrRecord.alamat_praktek,
      keterangan: mrRecord.keterangan,
      koordinat_institusi: mrRecord.koordinat_institusi,
      tgl_actual: mrRecord.tgl_actual,
      waktu_actual: mrRecord.waktu_actual,
      // koor_visit dikosongkan — atasan wajib isi sendiri
      koor_visit: null,
      stt_koor: 0,
      status: 'join_visit',
      join_visit: 1,
      // join_visit_id (uuid self-FK) ke MR record; join_visit_ff biarkan null
      // — kolom itu khusus CSV peg ID atasan untuk row MR.
      join_visit_id: mrRecordId,
      created_by: atasanId,
      updated_by: atasanId,
      created_at: now,
      updated_at: now,
    });
  }
}
