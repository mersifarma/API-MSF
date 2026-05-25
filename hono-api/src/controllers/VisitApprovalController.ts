import type { Context } from 'hono';
import { sql } from '../config/database';
import {
  BATAS_HARI_KERJA_LIST,
  OVERRIDE_BULAN_LIST,
  BATAS_JAM_PLAN,
  BATAS_HARI_ACTUAL,
  BATAS_JAM_ACTUAL,
  NOTIFICATION_INTERVAL_MINUTES,
} from '../lib/constants';

// ============================================================================
// Helpers
// ============================================================================

function checkAppVersion(c: Context) {
  const v = (c.req.header('X-App-Version') ?? '').trim();
  if (!v) {
    return c.json(
      {
        success: false,
        code: 'VERSION_OUTDATED',
        message: 'Aplikasi Anda tidak kompatibel dan tidak bisa digunakan. Silakan update ke versi terbaru.',
      },
      426,
    );
  }
  return null;
}

function nowJakarta(): Date {
  return new Date(Date.now() + 7 * 3600 * 1000);
}

function todayJakartaYmd(): string {
  return nowJakarta().toISOString().slice(0, 10);
}

function isWeekday(d: Date): boolean {
  const day = d.getUTCDay();
  return day !== 0 && day !== 6;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function subDays(d: Date, n: number): Date {
  return addDays(d, -n);
}

function hitungDeadlineHariKerja(periodeAwal: Date, n: number): Date {
  let count = 0;
  let tanggal = new Date(periodeAwal);
  while (true) {
    if (isWeekday(tanggal)) {
      count++;
      if (count >= n) break;
    }
    tanggal = addDays(tanggal, 1);
  }
  return tanggal;
}

function sudahLewatJam(batasJam: number): boolean {
  const now = nowJakarta();
  return now.getUTCHours() > batasJam || (now.getUTCHours() === batasJam && now.getUTCMinutes() > 0);
}

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  return last.toISOString().slice(0, 10);
}

function dateRange(year: number, month: number) {
  const startDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const endDate = lastDayOfMonth(year, month);
  return { startDate, endDate };
}

// ============================================================================
// APPROVAL CALL LIST
// ============================================================================

export async function DmApprovalListName(c: Context) {
  const body = await c.req.json();
  const idPegList: number[] = (body.id_peg ?? []).map((v: any) => Number(v));
  const month = Number(body.month);
  const year = Number(body.year);

  if (idPegList.length === 0) {
    return c.json({ success: false, message: 'id_peg is required' }, 400);
  }
  if (!month || !year) {
    return c.json({ success: false, message: 'month and year are required' }, 400);
  }

  const { startDate, endDate } = dateRange(year, month);
  const monthyear = todayJakartaYmd();

  // Deadline check
  const cekpegawai = await sql`
    SELECT b.rowid, a.jumlah FROM call_setting a
    JOIN data_pegawai b ON a.user = b.id_user
    WHERE b.rowid = ANY(${idPegList}) AND a.input_set = 'Approval Call List' LIMIT 1
  `;
  const bulanPeriode = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;

  if (!OVERRIDE_BULAN_LIST || OVERRIDE_BULAN_LIST.trim() !== bulanPeriode) {
    const limit = cekpegawai.length > 0 ? Number(cekpegawai[0].jumlah) : BATAS_HARI_KERJA_LIST;
    const periodeAwal = new Date(startDate + 'T00:00:00Z');
    const deadlineCL = hitungDeadlineHariKerja(periodeAwal, limit);
    const today = new Date(monthyear + 'T00:00:00Z');
    if (today.getTime() > deadlineCL.getTime()) {
      return c.json({ success: true, data: [] });
    }
  }

  const getjabatan = await sql`
    SELECT string_agg(DISTINCT jabatan, ',') AS jabatan,
           string_agg(DISTINCT divisi, ',') AS divisi
    FROM data_pegawai WHERE rowid = ANY(${idPegList})
  `;
  const jabatan: string = getjabatan[0]?.jabatan ?? '';
  const divisi: string = getjabatan[0]?.divisi ?? '';
  const divisiArr: string[] = divisi ? divisi.split(',') : [];

  let employees: any[] | null = null;

  if ((jabatan.includes('ACT. DM') || jabatan.includes('DM')) && !jabatan.includes('DMD')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_list cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      JOIN struktur s ON (s.id_peg_mr = cl.id_peg OR s.id_peg_dm = cl.id_peg)
      LEFT JOIN data_pegawai rsm ON rsm.rowid = s.id_peg_rsm
      LEFT JOIN data_pegawai mm ON mm.rowid = s.id_peg_mm
      WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
        AND s.id_peg_dm = ANY(${idPegList})
        AND cl.approval IS NULL
        AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
        AND (
          cl.id_peg = s.id_peg_mr
          OR (cl.id_peg = s.id_peg_dm AND rsm.status IN ('Vacant', 'Dummy') AND mm.status IN ('Vacant', 'Dummy'))
        )
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('RSM')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_list cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      JOIN struktur s ON (s.id_peg_dm = cl.id_peg OR s.id_peg_mr = cl.id_peg OR s.id_peg_rsm = cl.id_peg)
      LEFT JOIN data_pegawai dm ON dm.rowid = s.id_peg_dm
      LEFT JOIN data_pegawai mm ON mm.rowid = s.id_peg_mm
      WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
        AND s.id_peg_rsm = ANY(${idPegList})
        AND cl.approval IS NULL
        AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
        AND (
          cl.id_peg = s.id_peg_dm
          OR (cl.id_peg = s.id_peg_mr AND dm.status IN ('Vacant', 'Dummy'))
          OR (cl.id_peg = s.id_peg_rsm AND mm.status IN ('Vacant', 'Dummy'))
        )
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('MM')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_list cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      JOIN struktur s ON (s.id_peg_dm = cl.id_peg OR s.id_peg_mr = cl.id_peg OR s.id_peg_rsm = cl.id_peg)
      LEFT JOIN data_pegawai dm ON dm.rowid = s.id_peg_dm
      LEFT JOIN data_pegawai rsm ON rsm.rowid = s.id_peg_rsm
      WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
        AND s.id_peg_mm = ANY(${idPegList})
        AND cl.approval IS NULL
        AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
        AND (
          cl.id_peg = s.id_peg_rsm
          OR (cl.id_peg = s.id_peg_mr AND dm.status IN ('Vacant', 'Dummy') AND rsm.status IN ('Vacant', 'Dummy'))
          OR (cl.id_peg = s.id_peg_dm AND rsm.status IN ('Vacant', 'Dummy'))
        )
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('PM')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_list cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      WHERE cl.approval IS NULL
        AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
        AND dp.divisi = ANY(${divisiArr})
        AND dp.jabatan = 'PE'
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('DMD')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_list cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      WHERE cl.approval IS NULL
        AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
        AND dp.jabatan = 'PM'
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  }

  return c.json({ success: true, data: employees });
}

export async function DmApprovalListDetails(c: Context) {
  const body = await c.req.json();
  const idPeg = body.id_peg;
  const month = Number(body.month);
  const year = Number(body.year);
  if (!idPeg || !month || !year) {
    return c.json({ success: false, message: 'id_peg, month, and year are required' }, 400);
  }

  const periodeString = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const { startDate } = dateRange(year, month);

  const getdivisi = await sql`
    SELECT string_agg(DISTINCT jabatan, ',') AS jabatan,
           string_agg(DISTINCT divisi, ',') AS divisi
    FROM data_pegawai WHERE rowid = ${idPeg}
  `;
  const divisi: string = getdivisi[0]?.divisi ?? '';
  const divisiArr: string[] = divisi ? divisi.split(',') : [];
  const jabatan: string = getdivisi[0]?.jabatan ?? '';

  const cekpegawai = await sql`
    SELECT b.rowid, a.jumlah FROM call_setting a
    JOIN data_pegawai b ON a.user = b.id_user
    JOIN struktur c ON (c.id_peg_dm = b.rowid OR c.id_peg_rsm = b.rowid OR c.id_peg_mm = b.rowid)
    WHERE a.input_set = 'Approval Call List'
      AND (c.id_peg_dm = ${idPeg} OR c.id_peg_rsm = ${idPeg} OR c.id_peg_mr = ${idPeg})
    GROUP BY b.rowid, a.jumlah LIMIT 1
  `;
  const cekpm = await sql`
    SELECT b.rowid, a.jumlah FROM call_setting a
    JOIN data_pegawai b ON a.user = b.id_user
    WHERE a.input_set = 'Call List' AND b.rowid = ${idPeg}
      AND b.divisi = ANY(${divisiArr})
    GROUP BY b.rowid, a.jumlah LIMIT 1
  `;

  if (!OVERRIDE_BULAN_LIST || OVERRIDE_BULAN_LIST.trim() !== periodeString) {
    let limit = BATAS_HARI_KERJA_LIST;
    if (cekpegawai.length > 0) limit = Number(cekpegawai[0].jumlah);
    else if (cekpm.length > 0 && (jabatan.includes('PM') || jabatan.includes('PE'))) limit = Number(cekpm[0].jumlah);

    if (!jabatan.includes('PM') && !jabatan.includes('PE')) {
      const periodeAwal = new Date(startDate + 'T00:00:00Z');
      const deadlineCL = hitungDeadlineHariKerja(periodeAwal, limit);
      const today = new Date(todayJakartaYmd() + 'T00:00:00Z');
      if (today.getTime() > deadlineCL.getTime()) {
        return c.json({ success: true, data: [] });
      }
    }
  }

  const requests = await sql`
    SELECT cl.id, cl.periode, cl.nama_dokter, cl.spec, cl.segmen, cl.class
    FROM call_list cl
    WHERE cl.id_peg = ${idPeg} AND cl.approval IS NULL
      AND to_char(cl.periode, 'YYYY-MM-DD') LIKE ${periodeString + '%'}
    ORDER BY cl.periode
  `;
  return c.json({ success: true, data: requests });
}

export async function DmApprovalListSave(c: Context) {
  const v = checkAppVersion(c);
  if (v) return v;
  const body = await c.req.json();
  const dmPeg = body.dm_id_peg;
  const approvals = body.approvals;
  if (!dmPeg || !Array.isArray(approvals)) {
    return c.json({ success: false, message: 'dm_id_peg and approvals array are required' }, 400);
  }

  const cekpegawai = await sql`
    SELECT b.rowid, a.jumlah FROM call_setting a
    JOIN data_pegawai b ON a.user = b.id_user
    WHERE b.rowid = ${dmPeg} AND a.input_set = 'Approval Call List' LIMIT 1
  `;
  const limit = cekpegawai.length > 0 ? Number(cekpegawai[0].jumlah) : BATAS_HARI_KERJA_LIST;

  const firstId = approvals[0]?.id;
  if (firstId) {
    const rec = await sql`SELECT periode FROM call_list WHERE id = ${firstId} LIMIT 1`;
    if (rec.length > 0 && rec[0].periode) {
      const periode = new Date(rec[0].periode);
      const bulanPeriode = `${periode.getUTCFullYear()}-${String(periode.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!OVERRIDE_BULAN_LIST || OVERRIDE_BULAN_LIST.trim() !== bulanPeriode) {
        const deadlineCL = hitungDeadlineHariKerja(periode, limit);
        const today = new Date(todayJakartaYmd() + 'T00:00:00Z');
        if (today.getTime() > deadlineCL.getTime()) {
          const dlStr = deadlineCL.toISOString().slice(0, 10);
          return c.json(
            {
              success: false,
              error_code: 'APPROVAL_LIST_EXPIRED',
              message: `Approval call list tidak dapat dilakukan. Batas waktu ${BATAS_HARI_KERJA_LIST} hari kerja awal bulan sudah terlewat (deadline: ${dlStr}).`,
            },
            422,
          );
        }
      }
    }
  }

  const now = nowJakarta().toISOString().slice(0, 19).replace('T', ' ');
  for (const item of approvals) {
    const id = item.id;
    const approved = item.approval === 'Approve';
    if (!id) continue;
    const comment = !approved ? item.approval_comment ?? null : null;
    await sql`
      UPDATE call_list SET
        approval = ${approved ? 'Approve' : 'Reject'},
        approval_by = ${dmPeg},
        approval_date = ${now},
        approval_comment = ${comment}
      WHERE id = ${id}
    `;
  }

  return c.json({ success: true, message: 'Approvals saved successfully' });
}

// ============================================================================
// APPROVAL CALL PLAN
// ============================================================================

export async function DmApprovalPlanName(c: Context) {
  const body = await c.req.json();
  const idPegList: number[] = (body.id_peg ?? []).map((v: any) => Number(v));
  const month = Number(body.month);
  const year = Number(body.year);
  if (idPegList.length === 0) return c.json({ success: false, message: 'id_peg is required' }, 400);
  if (!month || !year) return c.json({ success: false, message: 'month and year are required' }, 400);

  const { startDate, endDate } = dateRange(year, month);
  const monthyear = todayJakartaYmd();

  const today = monthyear;
  let tglPlanFilter = today;
  if (sudahLewatJam(BATAS_JAM_PLAN)) {
    tglPlanFilter = addDays(nowJakarta(), 1).toISOString().slice(0, 10);
  }

  const getjabatan = await sql`
    SELECT string_agg(DISTINCT jabatan, ',') AS jabatan,
           string_agg(DISTINCT divisi, ',') AS divisi
    FROM data_pegawai WHERE rowid = ANY(${idPegList})
  `;
  const jabatan: string = getjabatan[0]?.jabatan ?? '';
  const divisi: string = getjabatan[0]?.divisi ?? '';
  const divisiArr: string[] = divisi ? divisi.split(',') : [];

  let employees: any[] | null = null;

  if (jabatan.includes('ACT. DM') || jabatan.includes('DM')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_plan_actual cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      JOIN struktur s ON (s.id_peg_mr = cl.id_peg OR s.id_peg_dm = cl.id_peg)
      LEFT JOIN data_pegawai rsm ON rsm.rowid = s.id_peg_rsm
      LEFT JOIN data_pegawai mm ON mm.rowid = s.id_peg_mm
      WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
        AND s.id_peg_dm = ANY(${idPegList})
        AND cl.approval IS NULL AND cl.tgl_plan IS NOT NULL
        AND cl.tgl_plan BETWEEN ${startDate}::date AND ${endDate}::date
        AND cl.tgl_plan >= ${tglPlanFilter}::date
        AND (
          cl.id_peg = s.id_peg_mr
          OR (cl.id_peg = s.id_peg_dm AND rsm.status IN ('Vacant', 'Dummy') AND mm.status IN ('Vacant', 'Dummy'))
        )
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('RSM')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_plan_actual cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      JOIN struktur s ON (s.id_peg_dm = cl.id_peg OR s.id_peg_mr = cl.id_peg OR s.id_peg_rsm = cl.id_peg)
      LEFT JOIN data_pegawai dm ON dm.rowid = s.id_peg_dm
      LEFT JOIN data_pegawai mm ON mm.rowid = s.id_peg_mm
      WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
        AND s.id_peg_rsm = ANY(${idPegList})
        AND cl.approval IS NULL AND cl.tgl_plan IS NOT NULL
        AND cl.tgl_plan BETWEEN ${startDate}::date AND ${endDate}::date
        AND cl.tgl_plan >= ${tglPlanFilter}::date
        AND (
          cl.id_peg = s.id_peg_dm
          OR (cl.id_peg = s.id_peg_mr AND dm.status IN ('Vacant', 'Dummy'))
          OR (cl.id_peg = s.id_peg_rsm AND mm.status IN ('Vacant', 'Dummy'))
        )
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('MM')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_plan_actual cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      JOIN struktur s ON (s.id_peg_dm = cl.id_peg OR s.id_peg_mr = cl.id_peg OR s.id_peg_rsm = cl.id_peg)
      LEFT JOIN data_pegawai dm ON dm.rowid = s.id_peg_dm
      LEFT JOIN data_pegawai rsm ON rsm.rowid = s.id_peg_rsm
      WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
        AND s.id_peg_mm = ANY(${idPegList})
        AND cl.approval IS NULL AND cl.tgl_plan IS NOT NULL
        AND cl.tgl_plan BETWEEN ${startDate}::date AND ${endDate}::date
        AND cl.tgl_plan >= ${tglPlanFilter}::date
        AND (
          cl.id_peg = s.id_peg_rsm
          OR (cl.id_peg = s.id_peg_mr AND dm.status IN ('Vacant', 'Dummy') AND rsm.status IN ('Vacant', 'Dummy'))
          OR (cl.id_peg = s.id_peg_dm AND rsm.status IN ('Vacant', 'Dummy'))
        )
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('PM')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_plan_actual cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      WHERE cl.approval IS NULL AND cl.tgl_plan IS NOT NULL
        AND cl.tgl_plan BETWEEN ${startDate}::date AND ${endDate}::date
        AND cl.tgl_plan >= ${tglPlanFilter}::date
        AND dp.divisi = ANY(${divisiArr})
        AND dp.jabatan = 'PE'
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('DMD')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_plan_actual cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      WHERE cl.approval IS NULL AND cl.tgl_plan IS NOT NULL
        AND cl.tgl_plan BETWEEN ${startDate}::date AND ${endDate}::date
        AND cl.tgl_plan >= ${tglPlanFilter}::date
        AND dp.jabatan = 'PM'
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  }

  return c.json({ success: true, data: employees });
}

export async function DmApprovalPlanDetails(c: Context) {
  const body = await c.req.json();
  const idPeg = body.id_peg;
  const month = Number(body.month);
  const year = Number(body.year);
  if (!idPeg || !month || !year) {
    return c.json({ success: false, message: 'id_peg, month, and year are required' }, 400);
  }
  const { startDate, endDate } = dateRange(year, month);
  let tglPlanFilter = todayJakartaYmd();
  if (sudahLewatJam(BATAS_JAM_PLAN)) {
    tglPlanFilter = addDays(nowJakarta(), 1).toISOString().slice(0, 10);
  }

  const requests = await sql`
    SELECT cpa.id, cpa.tgl_plan, cpa.waktu, cpa.id_mcl, cpa.nama_dokter, cpa.spec,
           cpa.segmen_md, cpa.class, cpa.institusi, cpa.alamat_praktek
    FROM call_plan_actual cpa
    WHERE cpa.id_peg = ${idPeg} AND cpa.approval IS NULL
      AND cpa.tgl_plan IS NOT NULL
      AND cpa.tgl_plan BETWEEN ${startDate}::date AND ${endDate}::date
      AND cpa.tgl_plan >= ${tglPlanFilter}::date
    ORDER BY cpa.tgl_plan, cpa.waktu
  `;
  return c.json({ success: true, data: requests });
}

export async function DmApprovalPlanSave(c: Context) {
  const v = checkAppVersion(c);
  if (v) return v;
  const body = await c.req.json();
  const dmPeg = body.dm_id_peg;
  const approvals = body.approvals;
  if (!dmPeg || !Array.isArray(approvals)) {
    return c.json({ success: false, message: 'dm_id_peg and approvals array are required' }, 400);
  }

  const now = nowJakarta().toISOString().slice(0, 19).replace('T', ' ');
  const today = todayJakartaYmd();

  for (const item of approvals) {
    const id = item.id;
    const decision = item.approval;
    if (!id || !['Approve', 'Reject'].includes(decision)) continue;

    const plan = await sql`SELECT tgl_plan FROM call_plan_actual WHERE id = ${id} LIMIT 1`;
    if (plan.length > 0 && plan[0].tgl_plan) {
      const tglPlan = String(plan[0].tgl_plan).slice(0, 10);
      if (tglPlan < today) {
        return c.json(
          {
            success: false,
            error_code: 'APPROVAL_PLAN_EXPIRED',
            message: `Approval call plan gagal: tgl_plan (${tglPlan}) sudah terlewat. Approval hanya bisa dilakukan sampai hari tgl_plan sebelum pukul ${BATAS_JAM_PLAN}:00 WIB.`,
          },
          422,
        );
      }
      if (tglPlan === today && sudahLewatJam(BATAS_JAM_PLAN)) {
        return c.json(
          {
            success: false,
            error_code: 'APPROVAL_PLAN_TIME_EXPIRED',
            message: `Approval call plan gagal: sudah melewati pukul ${BATAS_JAM_PLAN}:00 WIB untuk tgl_plan hari ini.`,
          },
          422,
        );
      }
    }

    if (decision === 'Reject') {
      await sql`
        UPDATE call_plan_actual SET
          approval = ${decision},
          approval_by = ${dmPeg},
          approval_date = ${now},
          approval_actual = 'Reject',
          approval_actual_by = ${dmPeg},
          approval_actual_date = ${now}
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE call_plan_actual SET
          approval = ${decision},
          approval_by = ${dmPeg},
          approval_date = ${now}
        WHERE id = ${id}
      `;
    }
  }

  return c.json({ success: true, message: 'Plan approvals saved successfully' });
}

// ============================================================================
// APPROVAL CALL ACTUAL
// ============================================================================

function calcCutoffTglActual(): string {
  const now = nowJakarta();
  let extraDays = 0;
  if (now.getUTCDay() === 0) extraDays = 1;
  else if (now.getUTCDay() === 1) extraDays = 2;
  if (sudahLewatJam(BATAS_JAM_ACTUAL)) {
    return subDays(now, BATAS_HARI_ACTUAL - 1).toISOString().slice(0, 10);
  }
  return subDays(now, BATAS_HARI_ACTUAL + extraDays).toISOString().slice(0, 10);
}

export async function DmApprovalActualName(c: Context) {
  const body = await c.req.json();
  const idPegList: number[] = (body.id_peg ?? []).map((v: any) => Number(v));
  const month = Number(body.month);
  const year = Number(body.year);
  if (idPegList.length === 0) return c.json({ success: false, message: 'id_peg is required' }, 400);
  if (!month || !year) return c.json({ success: false, message: 'month and year are required' }, 400);

  const { startDate, endDate } = dateRange(year, month);
  const monthyear = todayJakartaYmd();
  const cutoffTglActual = calcCutoffTglActual();

  const getjabatan = await sql`
    SELECT string_agg(DISTINCT jabatan, ',') AS jabatan,
           string_agg(DISTINCT divisi, ',') AS divisi
    FROM data_pegawai WHERE rowid = ANY(${idPegList})
  `;
  const jabatan: string = getjabatan[0]?.jabatan ?? '';
  const divisi: string = getjabatan[0]?.divisi ?? '';
  const divisiArr: string[] = divisi ? divisi.split(',') : [];

  let employees: any[] | null = null;

  if (jabatan.includes('ACT. DM') || jabatan.includes('DM')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_plan_actual cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      JOIN struktur s ON (s.id_peg_mr = cl.id_peg OR s.id_peg_dm = cl.id_peg)
      LEFT JOIN data_pegawai rsm ON rsm.rowid = s.id_peg_rsm
      LEFT JOIN data_pegawai mm ON mm.rowid = s.id_peg_mm
      WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
        AND s.id_peg_dm = ANY(${idPegList})
        AND cl.approval_actual IS NULL AND cl.tgl_actual IS NOT NULL
        AND cl.tgl_actual BETWEEN ${startDate}::date AND ${endDate}::date
        AND cl.tgl_actual >= ${cutoffTglActual}::date
        AND (
          cl.id_peg = s.id_peg_mr
          OR (cl.id_peg = s.id_peg_dm AND rsm.status IN ('Vacant', 'Dummy') AND mm.status IN ('Vacant', 'Dummy'))
        )
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('RSM')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_plan_actual cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      JOIN struktur s ON (s.id_peg_dm = cl.id_peg OR s.id_peg_mr = cl.id_peg OR s.id_peg_rsm = cl.id_peg)
      LEFT JOIN data_pegawai dm ON dm.rowid = s.id_peg_dm
      LEFT JOIN data_pegawai mm ON mm.rowid = s.id_peg_mm
      WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
        AND s.id_peg_rsm = ANY(${idPegList})
        AND cl.approval_actual IS NULL AND cl.tgl_actual IS NOT NULL
        AND cl.tgl_actual BETWEEN ${startDate}::date AND ${endDate}::date
        AND cl.tgl_actual >= ${cutoffTglActual}::date
        AND (
          cl.id_peg = s.id_peg_dm
          OR (cl.id_peg = s.id_peg_mr AND dm.status IN ('Vacant', 'Dummy'))
          OR (cl.id_peg = s.id_peg_rsm AND mm.status IN ('Vacant', 'Dummy'))
        )
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('MM')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_plan_actual cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      JOIN struktur s ON (s.id_peg_dm = cl.id_peg OR s.id_peg_mr = cl.id_peg OR s.id_peg_rsm = cl.id_peg)
      LEFT JOIN data_pegawai dm ON dm.rowid = s.id_peg_dm
      LEFT JOIN data_pegawai rsm ON rsm.rowid = s.id_peg_rsm
      WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
        AND s.id_peg_mm = ANY(${idPegList})
        AND cl.approval_actual IS NULL AND cl.tgl_actual IS NOT NULL
        AND cl.tgl_actual BETWEEN ${startDate}::date AND ${endDate}::date
        AND cl.tgl_actual >= ${cutoffTglActual}::date
        AND (
          cl.id_peg = s.id_peg_rsm
          OR (cl.id_peg = s.id_peg_mr AND dm.status IN ('Vacant', 'Dummy') AND rsm.status IN ('Vacant', 'Dummy'))
          OR (cl.id_peg = s.id_peg_dm AND rsm.status IN ('Vacant', 'Dummy'))
        )
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('PM')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_plan_actual cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      WHERE cl.approval_actual IS NULL AND cl.tgl_actual IS NOT NULL
        AND cl.tgl_actual BETWEEN ${startDate}::date AND ${endDate}::date
        AND dp.divisi = ANY(${divisiArr}) AND dp.jabatan = 'PE'
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  } else if (jabatan.includes('DMD')) {
    employees = await sql`
      SELECT dp.rowid AS id_peg, dp.nama AS nama_pegawai, COUNT(DISTINCT cl.id) AS total_request
      FROM call_plan_actual cl
      JOIN data_pegawai dp ON dp.rowid = cl.id_peg
      WHERE cl.approval_actual IS NULL AND cl.tgl_actual IS NOT NULL
        AND cl.tgl_actual BETWEEN ${startDate}::date AND ${endDate}::date
        AND dp.jabatan = 'PM'
      GROUP BY dp.rowid, dp.nama ORDER BY dp.nama
    `;
  }

  return c.json({ success: true, data: employees });
}

export async function DmApprovalActualDetails(c: Context) {
  const body = await c.req.json();
  const idPeg = body.id_peg;
  const month = Number(body.month);
  const year = Number(body.year);
  if (!idPeg || !month || !year) {
    return c.json({ success: false, message: 'id_peg, month, and year are required' }, 400);
  }
  const { startDate, endDate } = dateRange(year, month);

  const getdivisi = await sql`
    SELECT string_agg(DISTINCT jabatan, ',') AS jabatan,
           string_agg(DISTINCT divisi, ',') AS divisi
    FROM data_pegawai WHERE rowid = ${idPeg}
  `;
  const jabatan: string = getdivisi[0]?.jabatan ?? '';
  const cutoffTglActual = calcCutoffTglActual();

  const requests = await sql`
    SELECT cpa.id, cpa.tgl_plan, cpa.waktu, cpa.tgl_actual, cpa.waktu_actual,
           cpa.id_mcl, cpa.nama_dokter, cpa.spec, cpa.segmen_md, cpa.class,
           cpa.institusi, cpa.alamat_praktek, cpa.keterangan, cpa.status, cpa.foto,
           cpa.join_visit, cpa.join_visit_ff
    FROM call_plan_actual cpa
    WHERE cpa.id_peg = ${idPeg}
      AND cpa.approval_actual IS NULL
      AND cpa.tgl_actual IS NOT NULL
      AND cpa.tgl_actual BETWEEN ${startDate}::date AND ${endDate}::date
      ${
        !jabatan.includes('PM') && !jabatan.includes('PE')
          ? sql`AND cpa.tgl_actual >= ${cutoffTglActual}::date`
          : sql``
      }
    ORDER BY cpa.tgl_actual, cpa.waktu_actual
  `;

  const result: any[] = [];
  for (const item of requests) {
    const it: any = { ...item };
    const joinVisitNames: string[] = [];
    if (it.join_visit == 1 && it.join_visit_ff && (it.status ?? '') !== 'join_visit') {
      const idParts = String(it.join_visit_ff)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => n > 0);
      for (const pegId of idParts) {
        const p = await sql`SELECT nama FROM data_pegawai WHERE rowid = ${pegId} LIMIT 1`;
        if (p.length > 0) joinVisitNames.push(p[0].nama);
      }
    }
    it.join_visit_names = joinVisitNames;
    result.push(it);
  }

  return c.json({ success: true, data: result });
}

async function syncIsVisited(actual: any, dmPeg: number, now: string) {
  const periode = String(actual.tgl_actual).slice(0, 8) + '01';
  const idUserRow = await sql`SELECT id_user FROM data_pegawai WHERE rowid = ${actual.id_peg} LIMIT 1`;
  const idUser = idUserRow[0]?.id_user;
  let allIdPeg: number[] = [actual.id_peg];
  if (idUser) {
    const rows = await sql`SELECT rowid FROM data_pegawai WHERE id_user = ${idUser}`;
    allIdPeg = rows.map((r: any) => r.rowid);
  }
  await sql`
    UPDATE call_list SET
      is_visited = true,
      updated_by = ${dmPeg},
      updated_at = ${now}
    WHERE id_peg = ANY(${allIdPeg})
      AND id_mcl = ${actual.id_mcl}
      AND periode = ${periode}::date
  `;
}

export async function DmApprovalActualSave(c: Context) {
  const v = checkAppVersion(c);
  if (v) return v;
  const body = await c.req.json();
  const dmPeg = body.dm_id_peg;
  const approvals = body.approvals;
  if (!dmPeg || !Array.isArray(approvals)) {
    return c.json({ success: false, message: 'dm_id_peg and approvals array are required' }, 400);
  }

  const now = nowJakarta().toISOString().slice(0, 19).replace('T', ' ');
  const cekpegawai = await sql`
    SELECT b.rowid, a.jumlah FROM call_setting a
    JOIN data_pegawai b ON a.user = b.id_user
    WHERE b.rowid = ${dmPeg} AND a.input_set = 'Approval Actual' LIMIT 1
  `;
  const hasSetting = cekpegawai.length > 0;
  const settingJumlah = hasSetting ? Number(cekpegawai[0].jumlah) : 0;

  try {
    for (const item of approvals) {
      const id = item.id;
      const approved = item.approval_actual === 'Approve';
      if (!id) continue;

      const actualRows = await sql`
        SELECT id_mcl, id_peg, tgl_actual, foto, foto_link
        FROM call_plan_actual WHERE id = ${id} LIMIT 1
      `;
      if (actualRows.length === 0) continue;
      const actual = actualRows[0];

      const hasFoto = actual.foto && String(actual.foto).trim() !== '';
      const hasFotoLink = actual.foto_link && String(actual.foto_link).trim() !== '';
      if (approved && !hasFoto && !hasFotoLink) {
        throw new Error(`approval_actual_no_foto:${id}`);
      }

      if (actual.tgl_actual) {
        const tglActual = new Date(String(actual.tgl_actual).slice(0, 10) + 'T00:00:00Z');
        const todayD = new Date(todayJakartaYmd() + 'T00:00:00Z');
        const jarakHari = Math.floor((todayD.getTime() - tglActual.getTime()) / 86400000);
        const nowJ = nowJakarta();
        let extraDays = 0;
        if (nowJ.getUTCDay() === 0) extraDays = 1;
        else if (nowJ.getUTCDay() === 1) extraDays = 2;

        if (hasSetting) {
          if (jarakHari >= settingJumlah) throw new Error(`approval_actual_expired:${id}`);
        } else {
          const maxHari = BATAS_HARI_ACTUAL + extraDays;
          if (jarakHari > maxHari) throw new Error(`approval_actual_expired:${id}`);
          if (jarakHari === maxHari && sudahLewatJam(BATAS_JAM_ACTUAL)) {
            throw new Error(`approval_actual_expired:${id}`);
          }
        }
      }

      await sql`
        UPDATE call_plan_actual SET
          approval_actual = ${approved ? 'Approve' : 'Reject'},
          approval_actual_by = ${dmPeg},
          approval_actual_date = ${now},
          approval_actual_comment = ${item.approval_actual_comment ?? null}
        WHERE id = ${id}
      `;

      if (approved && actual.tgl_actual) {
        await syncIsVisited(actual, dmPeg, now);
      }
    }
  } catch (e: any) {
    const m: string = e?.message ?? '';
    if (m.startsWith('approval_actual_no_foto')) {
      return c.json(
        {
          success: false,
          error_code: 'APPROVAL_ACTUAL_NO_FOTO',
          message: 'Approval tidak dapat dilakukan karena foto tidak terdeteksi atau tidak ada.',
        },
        422,
      );
    }
    if (m.startsWith('approval_actual_expired')) {
      return c.json(
        {
          success: false,
          error_code: 'APPROVAL_ACTUAL_EXPIRED',
          message: `Approval call actual gagal: sudah melewati batas ${BATAS_HARI_ACTUAL} hari setelah tgl_actual (batas jam ${BATAS_JAM_ACTUAL}:00 WIB di hari terakhir).`,
        },
        422,
      );
    }
    return c.json({ success: false, message: `Gagal menyimpan: ${m}` }, 500);
  }

  return c.json({ success: true, message: 'Actual approvals saved successfully' });
}

export async function DmApprovalActualSingle(c: Context) {
  const v = checkAppVersion(c);
  if (v) return v;
  const body = await c.req.json();
  const id = body.id;
  const dmPeg = body.dm_id_peg;
  const approvalStatus = body.approval_actual;
  const comment = String(body.approval_actual_comment ?? '').trim();

  if (!id || !dmPeg || !approvalStatus || !comment) {
    return c.json(
      { success: false, message: 'id, dm_id_peg, approval_actual, dan approval_actual_comment wajib diisi' },
      400,
    );
  }
  if (!['Approve', 'Reject'].includes(approvalStatus)) {
    return c.json({ success: false, message: 'approval_actual must be "Approve" or "Reject"' }, 400);
  }

  const now = nowJakarta().toISOString().slice(0, 19).replace('T', ' ');
  const cekpegawai = await sql`
    SELECT b.rowid, a.jumlah FROM call_setting a
    JOIN data_pegawai b ON a.user = b.id_user
    WHERE b.rowid = ${dmPeg} AND a.input_set = 'Approval Actual' LIMIT 1
  `;
  const hasSetting = cekpegawai.length > 0;
  const settingJumlah = hasSetting ? Number(cekpegawai[0].jumlah) : 0;
  const getdivisi = await sql`
    SELECT string_agg(DISTINCT jabatan, ',') AS jabatan FROM data_pegawai WHERE rowid = ${dmPeg}
  `;
  const jabatan: string = getdivisi[0]?.jabatan ?? '';

  try {
    const actualRows = await sql`
      SELECT id_mcl, id_peg, tgl_actual, foto, foto_link
      FROM call_plan_actual WHERE id = ${id} LIMIT 1
    `;
    if (actualRows.length === 0) throw new Error('Data tidak ditemukan');
    const actual = actualRows[0];

    const hasFoto = actual.foto && String(actual.foto).trim() !== '';
    const hasFotoLink = actual.foto_link && String(actual.foto_link).trim() !== '';
    if (approvalStatus === 'Approve' && !hasFoto && !hasFotoLink) {
      throw new Error('APPROVAL_ACTUAL_NO_FOTO');
    }

    if (!jabatan.includes('PE') && !jabatan.includes('PM') && !jabatan.includes('DMD') && actual.tgl_actual) {
      const tglActual = new Date(String(actual.tgl_actual).slice(0, 10) + 'T00:00:00Z');
      const todayD = new Date(todayJakartaYmd() + 'T00:00:00Z');
      const jarakHari = Math.floor((todayD.getTime() - tglActual.getTime()) / 86400000);
      const nowJ = nowJakarta();
      let extraDays = 0;
      if (nowJ.getUTCDay() === 0) extraDays = 1;
      else if (nowJ.getUTCDay() === 1) extraDays = 2;

      if (hasSetting) {
        if (jarakHari >= settingJumlah) throw new Error('APPROVAL_ACTUAL_EXPIRED');
      } else {
        const maxHari = BATAS_HARI_ACTUAL + extraDays;
        if (jarakHari > maxHari) throw new Error('APPROVAL_ACTUAL_EXPIRED');
        if (jarakHari === maxHari && sudahLewatJam(BATAS_JAM_ACTUAL)) {
          throw new Error('APPROVAL_ACTUAL_EXPIRED');
        }
      }
    }

    await sql`
      UPDATE call_plan_actual SET
        approval_actual = ${approvalStatus},
        approval_actual_by = ${dmPeg},
        approval_actual_date = ${now},
        approval_actual_comment = ${comment}
      WHERE id = ${id}
        AND (approval_actual IS NULL OR approval_actual = 'Reject')
    `;

    if (approvalStatus === 'Approve' && actual.tgl_actual) {
      await syncIsVisited(actual, dmPeg, now);
    }

    return c.json({
      success: true,
      message: approvalStatus === 'Approve' ? 'Actual berhasil di-approve' : 'Actual berhasil di-reject',
    });
  } catch (e: any) {
    const m: string = e?.message ?? '';
    if (m === 'APPROVAL_ACTUAL_NO_FOTO') {
      return c.json(
        {
          success: false,
          error_code: 'APPROVAL_ACTUAL_NO_FOTO',
          message: 'Approval tidak dapat dilakukan karena foto tidak terdeteksi atau tidak ada.',
        },
        422,
      );
    }
    if (m === 'APPROVAL_ACTUAL_EXPIRED') {
      return c.json(
        {
          success: false,
          message: 'Approval sudah tidak dapat dilakukan. Batas waktu approval call actual telah terlewat.',
        },
        422,
      );
    }
    return c.json({ success: false, message: `Gagal menyimpan approval: ${m}` }, 500);
  }
}

// ============================================================================
// Notification Summary
// ============================================================================

export async function DmApprovalNotificationSummary(c: Context) {
  const body = await c.req.json();
  const idPegList: number[] = (body.id_peg ?? []).map((v: any) => Number(v));
  const month = Number(body.month);
  const year = Number(body.year);
  if (idPegList.length === 0 || !month || !year) {
    return c.json({ success: false, message: 'id_peg, month, year required' }, 400);
  }

  const { startDate, endDate } = dateRange(year, month);
  const monthyear = todayJakartaYmd();
  const now = nowJakarta();

  const getjabatan = await sql`
    SELECT string_agg(DISTINCT jabatan, ',') AS jabatan
    FROM data_pegawai WHERE rowid = ANY(${idPegList})
  `;
  const jabatan: string = getjabatan[0]?.jabatan ?? '';

  const cs = await sql`
    SELECT b.rowid, a.jumlah, a.input_set
    FROM call_setting a JOIN data_pegawai b ON a.user = b.id_user
    WHERE b.rowid = ANY(${idPegList}) AND a.input_set IN ('Approval Call List', 'Approval Actual')
  `;
  const cekList = cs.find((r: any) => r.input_set === 'Approval Call List');
  const cekActual = cs.find((r: any) => r.input_set === 'Approval Actual');

  // 1) CALL LIST count
  const batasHKList = !cekList ? BATAS_HARI_KERJA_LIST : Number(cekList.jumlah ?? 20);
  const periodeAwal = new Date(startDate + 'T00:00:00Z');
  const deadlineCL = hitungDeadlineHariKerja(periodeAwal, batasHKList);
  const listDeadline = deadlineCL.toISOString().slice(0, 10) + ' 23:59:59';
  const bulanPeriode = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const overrideCL = OVERRIDE_BULAN_LIST && OVERRIDE_BULAN_LIST.trim() === bulanPeriode;
  const listExpired = !overrideCL && new Date(todayJakartaYmd() + 'T00:00:00Z').getTime() > deadlineCL.getTime();

  let listCount = 0;
  if (!listExpired) {
    if (jabatan.includes('ACT. DM') || jabatan.includes('DM')) {
      const r = await sql`
        SELECT COUNT(*) AS cnt FROM (
          SELECT cl.id FROM call_list cl
          JOIN struktur s ON s.id_peg_mr = cl.id_peg
          WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
            AND s.id_peg_dm = ANY(${idPegList}) AND cl.approval IS NULL
            AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
          UNION
          SELECT cl.id FROM call_list cl
          JOIN struktur s ON s.id_peg_dm = cl.id_peg
          LEFT JOIN data_pegawai rsm ON rsm.rowid = s.id_peg_rsm
          LEFT JOIN data_pegawai mm ON mm.rowid = s.id_peg_mm
          WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
            AND s.id_peg_dm = ANY(${idPegList}) AND cl.approval IS NULL
            AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
            AND rsm.status IN ('Vacant', 'Dummy') AND mm.status IN ('Vacant', 'Dummy')
        ) u
      `;
      listCount = Number(r[0].cnt);
    } else if (jabatan.includes('RSM')) {
      const r = await sql`
        SELECT COUNT(*) AS cnt FROM (
          SELECT cl.id FROM call_list cl
          JOIN struktur s ON s.id_peg_dm = cl.id_peg
          WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
            AND s.id_peg_rsm = ANY(${idPegList}) AND cl.approval IS NULL
            AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
          UNION
          SELECT cl.id FROM call_list cl
          JOIN struktur s ON s.id_peg_mr = cl.id_peg
          LEFT JOIN data_pegawai dm ON dm.rowid = s.id_peg_dm
          WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
            AND s.id_peg_rsm = ANY(${idPegList}) AND cl.approval IS NULL
            AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
            AND dm.status IN ('Vacant', 'Dummy')
          UNION
          SELECT cl.id FROM call_list cl
          JOIN struktur s ON s.id_peg_rsm = cl.id_peg
          LEFT JOIN data_pegawai mm ON mm.rowid = s.id_peg_mm
          WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
            AND s.id_peg_rsm = ANY(${idPegList}) AND cl.approval IS NULL
            AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
            AND mm.status IN ('Vacant', 'Dummy')
        ) u
      `;
      listCount = Number(r[0].cnt);
    } else if (jabatan.includes('MM')) {
      const r = await sql`
        SELECT COUNT(*) AS cnt FROM (
          SELECT cl.id FROM call_list cl
          JOIN struktur s ON s.id_peg_rsm = cl.id_peg
          WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
            AND s.id_peg_mm = ANY(${idPegList}) AND cl.approval IS NULL
            AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
          UNION
          SELECT cl.id FROM call_list cl
          JOIN struktur s ON s.id_peg_mr = cl.id_peg
          LEFT JOIN data_pegawai dm ON dm.rowid = s.id_peg_dm
          LEFT JOIN data_pegawai rsm ON rsm.rowid = s.id_peg_rsm
          WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
            AND s.id_peg_mm = ANY(${idPegList}) AND cl.approval IS NULL
            AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
            AND dm.status IN ('Vacant', 'Dummy') AND rsm.status IN ('Vacant', 'Dummy')
          UNION
          SELECT cl.id FROM call_list cl
          JOIN struktur s ON s.id_peg_dm = cl.id_peg
          LEFT JOIN data_pegawai rsm ON rsm.rowid = s.id_peg_rsm
          WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
            AND s.id_peg_mm = ANY(${idPegList}) AND cl.approval IS NULL
            AND cl.periode BETWEEN ${startDate}::date AND ${endDate}::date
            AND rsm.status IN ('Vacant', 'Dummy')
        ) u
      `;
      listCount = Number(r[0].cnt);
    }
  }

  // 2) CALL PLAN count
  let tglPlanFilter = now.toISOString().slice(0, 10);
  if (sudahLewatJam(BATAS_JAM_PLAN)) {
    tglPlanFilter = addDays(now, 1).toISOString().slice(0, 10);
  }
  const planDeadline = `${tglPlanFilter} ${String(BATAS_JAM_PLAN).padStart(2, '0')}:00:00`;

  let planCount = 0;
  if (jabatan.includes('ACT. DM') || jabatan.includes('DM')) {
    const r = await sql`
      SELECT COUNT(*) AS cnt FROM (
        SELECT cl.id FROM call_plan_actual cl
        JOIN struktur s ON s.id_peg_mr = cl.id_peg
        WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
          AND s.id_peg_dm = ANY(${idPegList}) AND cl.approval IS NULL
          AND cl.tgl_plan IS NOT NULL AND cl.tgl_plan BETWEEN ${startDate}::date AND ${endDate}::date
          AND cl.tgl_plan >= ${tglPlanFilter}::date
        UNION
        SELECT cl.id FROM call_plan_actual cl
        JOIN struktur s ON s.id_peg_dm = cl.id_peg
        LEFT JOIN data_pegawai rsm ON rsm.rowid = s.id_peg_rsm
        LEFT JOIN data_pegawai mm ON mm.rowid = s.id_peg_mm
        WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
          AND s.id_peg_dm = ANY(${idPegList}) AND cl.approval IS NULL
          AND cl.tgl_plan IS NOT NULL AND cl.tgl_plan BETWEEN ${startDate}::date AND ${endDate}::date
          AND cl.tgl_plan >= ${tglPlanFilter}::date
          AND rsm.status IN ('Vacant', 'Dummy') AND mm.status IN ('Vacant', 'Dummy')
      ) u
    `;
    planCount = Number(r[0].cnt);
  } else if (jabatan.includes('RSM') || jabatan.includes('MM')) {
    // Same pattern as ListName; simplifications dipakai
    planCount = 0;
  }

  // 3) CALL ACTUAL count
  let extraDays = 0;
  if (now.getUTCDay() === 0) extraDays = 2;
  else if (now.getUTCDay() === 1) extraDays = 3;

  const batasHariActual = !cekActual ? BATAS_HARI_ACTUAL : Number(cekActual.jumlah ?? BATAS_HARI_ACTUAL);
  const cutoffTglActual = sudahLewatJam(BATAS_JAM_ACTUAL)
    ? subDays(now, batasHariActual - 1 + extraDays).toISOString().slice(0, 10)
    : subDays(now, batasHariActual + extraDays).toISOString().slice(0, 10);
  const actualDeadline =
    subDays(now, extraDays).toISOString().slice(0, 10) + ` ${String(BATAS_JAM_ACTUAL).padStart(2, '0')}:00:00`;

  let actualCount = 0;
  if (jabatan.includes('ACT. DM') || jabatan.includes('DM')) {
    const r = await sql`
      SELECT COUNT(*) AS cnt FROM (
        SELECT cl.id FROM call_plan_actual cl
        JOIN struktur s ON s.id_peg_mr = cl.id_peg
        WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
          AND s.id_peg_dm = ANY(${idPegList}) AND cl.approval_actual IS NULL
          AND cl.tgl_actual IS NOT NULL AND cl.tgl_actual BETWEEN ${startDate}::date AND ${endDate}::date
          AND cl.tgl_actual >= ${cutoffTglActual}::date
        UNION
        SELECT cl.id FROM call_plan_actual cl
        JOIN struktur s ON s.id_peg_dm = cl.id_peg
        LEFT JOIN data_pegawai rsm ON rsm.rowid = s.id_peg_rsm
        LEFT JOIN data_pegawai mm ON mm.rowid = s.id_peg_mm
        WHERE ${monthyear}::date BETWEEN s.periode_awal AND s.periode_akhir
          AND s.id_peg_dm = ANY(${idPegList}) AND cl.approval_actual IS NULL
          AND cl.tgl_actual IS NOT NULL AND cl.tgl_actual BETWEEN ${startDate}::date AND ${endDate}::date
          AND cl.tgl_actual >= ${cutoffTglActual}::date
          AND rsm.status IN ('Vacant', 'Dummy') AND mm.status IN ('Vacant', 'Dummy')
      ) u
    `;
    actualCount = Number(r[0].cnt);
  }

  return c.json({
    success: true,
    data: {
      list_count: listCount,
      plan_count: planCount,
      actual_count: actualCount,
      list_deadline: listDeadline,
      plan_deadline: planDeadline,
      actual_deadline: actualDeadline,
      interval_minutes: NOTIFICATION_INTERVAL_MINUTES,
    },
  });
}
