import type { Context } from 'hono';
import { sql } from '../config/database';
import { JOIN_VISIT_RADIUS_METERS } from '../lib/constants';

// Haversine — jarak antar koordinat dalam meter
function hitungJarak(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlam = toRad(lon2 - lon1);
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getAppConfig(c: Context) {
  return c.json({
    success: true,
    data: {
      join_visit_radius_meters: JOIN_VISIT_RADIUS_METERS,
    },
  });
}

export async function callJoinVisit(c: Context) {
  const body = await c.req.json();
  const raw = body.id_peg;
  const idPegList: number[] = Array.isArray(raw)
    ? raw.map((v: any) => Number(v))
    : JSON.parse(String(raw ?? '[]')).map((v: any) => Number(v));

  if (idPegList.length === 0) {
    return c.json({ message: 'id_peg required' }, 400);
  }

  const jabatanRow = await sql`
    SELECT string_agg(DISTINCT jabatan, ',') AS jabatan
    FROM data_pegawai
    WHERE rowid = ANY(${idPegList})
  `;
  const jabatan: string = jabatanRow[0]?.jabatan ?? '';

  if (jabatan.includes('ACT. DM') || jabatan.includes('DM')) {
    const strukturRow = await sql`
      SELECT string_agg(DISTINCT id_peg_rsm::text, ',') AS rsm_ids
      FROM struktur
      WHERE id_peg_dm = ANY(${idPegList})
        AND periode_awal::date <= NOW()::date
        AND periode_akhir::date >= NOW()::date
    `;
    const rsmIdsStr = strukturRow[0]?.rsm_ids;
    if (!rsmIdsStr) {
      return c.json({ message: 'DM not found' }, 404);
    }
    const rsmIds = rsmIdsStr.split(',').map((s: string) => Number(s)).filter(Boolean);
    const atasan = await sql`
      SELECT rowid, nama
      FROM data_pegawai
      WHERE rowid = ANY(${rsmIds})
    `;
    return c.json({ role: 'DM', atasan });
  }

  // CASE: MR
  const strukturRow = await sql`
    SELECT
      string_agg(DISTINCT id_peg_dm::text, ',')  AS dm_ids,
      string_agg(DISTINCT id_peg_rsm::text, ',') AS rsm_ids
    FROM struktur
    WHERE id_peg_mr = ANY(${idPegList})
      AND periode_awal::date <= NOW()::date
      AND periode_akhir::date >= NOW()::date
  `;
  const dmIdsStr = strukturRow[0]?.dm_ids;
  const rsmIdsStr = strukturRow[0]?.rsm_ids;
  if (!dmIdsStr && !rsmIdsStr) {
    return c.json({ message: 'MR not found' }, 404);
  }
  const dmIds = dmIdsStr ? dmIdsStr.split(',').map((s: string) => Number(s)).filter(Boolean) : [];
  const rsmIds = rsmIdsStr ? rsmIdsStr.split(',').map((s: string) => Number(s)).filter(Boolean) : [];
  const atasanIds = [...new Set([...dmIds, ...rsmIds])];
  const atasan = await sql`
    SELECT rowid, nama
    FROM data_pegawai
    WHERE rowid = ANY(${atasanIds})
  `;
  return c.json({ role: 'MR', atasan });
}

export async function approvalJoinVisit(c: Context) {
  const body = await c.req.json();
  const rawIdPeg = body.id_peg;
  const idPegList: number[] = Array.isArray(rawIdPeg) ? rawIdPeg.map((v) => Number(v)) : [];
  const month = Number(body.month);
  const year = Number(body.year);

  if (idPegList.length === 0) {
    return c.json({ success: false, message: 'id_peg is required' }, 400);
  }
  if (!month || !year) {
    return c.json({ success: false, message: 'month and year are required' }, 400);
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  // last day of month
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

  // join_visit_id yg sudah pernah di-copy (untuk exclude)
  const cekvisit = await sql`
    SELECT string_agg(DISTINCT cl.join_visit_id::text, ',') AS join_visit_id
    FROM call_plan_actual cl
    WHERE cl.join_visit_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(${idPegList}::int[]) AS x(id)
        WHERE x.id::text = ANY(string_to_array(cl.join_visit_ff, ','))
      )
  `;
  const excludeIds: string[] = cekvisit[0]?.join_visit_id
    ? cekvisit[0].join_visit_id.split(',')
    : [];

  const employees = await sql`
    SELECT
      dp.rowid AS id_peg,
      dp.nama AS nama_pegawai,
      COUNT(DISTINCT cl.id) AS total_request
    FROM call_plan_actual cl
    JOIN data_pegawai dp ON dp.rowid = cl.id_peg
    WHERE cl.join_visit = 1
      AND EXISTS (
        SELECT 1 FROM unnest(${idPegList}::int[]) AS x(id)
        WHERE x.id::text = ANY(string_to_array(cl.join_visit_ff, ','))
      )
      ${excludeIds.length > 0 ? sql`AND cl.id::text <> ALL(${excludeIds})` : sql``}
      AND cl.tgl_actual IS NOT NULL
      AND cl.tgl_actual BETWEEN ${startDate}::date AND ${endDate}::date
      AND cl.updated_at >= NOW() - INTERVAL '180 minutes'
    GROUP BY dp.rowid, dp.nama
    ORDER BY dp.nama
  `;

  return c.json({ success: true, data: employees });
}

export async function joinVisitDetails(c: Context) {
  const body = await c.req.json();
  const idPeg = Number(body.id_peg);
  const month = Number(body.month);
  const year = Number(body.year);
  const approverId = Number(body.approver_id);

  if (!idPeg || !month || !year) {
    return c.json({ success: false, message: 'id_peg, month, and year are required' }, 400);
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

  const cekuser = await sql`SELECT id_user FROM data_pegawai WHERE rowid = ${approverId} LIMIT 1`;
  if (cekuser.length === 0) {
    return c.json({ success: false, message: 'approver not found' }, 404);
  }
  const cekpegawai = await sql`
    SELECT string_agg(DISTINCT rowid::text, ',') AS id_peg
    FROM data_pegawai
    WHERE id_user = ${cekuser[0].id_user}
      AND COALESCE(status, 'Exist') = 'Exist'
  `;
  const approverPegIds: number[] = cekpegawai[0]?.id_peg
    ? cekpegawai[0].id_peg.split(',').map((s: string) => Number(s))
    : [];

  const cekvisit = await sql`
    SELECT string_agg(DISTINCT cl.join_visit_id::text, ',') AS join_visit_id
    FROM call_plan_actual cl
    WHERE cl.join_visit_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(${approverPegIds}::int[]) AS x(id)
        WHERE x.id::text = ANY(string_to_array(cl.join_visit_ff, ','))
      )
  `;
  const excludeIds: string[] = cekvisit[0]?.join_visit_id
    ? cekvisit[0].join_visit_id.split(',')
    : [];

  const requests = await sql`
    SELECT
      cpa.id, cpa.tgl_plan, cpa.waktu, cpa.tgl_actual, cpa.waktu_actual,
      cpa.id_mcl, cpa.nama_dokter, cpa.spec, cpa.segmen_md, cpa.class,
      cpa.institusi, cpa.alamat_praktek, cpa.keterangan, cpa.status, cpa.foto
    FROM call_plan_actual cpa
    WHERE cpa.id_peg = ${idPeg}
      AND cpa.join_visit = 1
      AND EXISTS (
        SELECT 1 FROM unnest(${approverPegIds}::int[]) AS x(id)
        WHERE x.id::text = ANY(string_to_array(cpa.join_visit_ff, ','))
      )
      ${excludeIds.length > 0 ? sql`AND cpa.id::text <> ALL(${excludeIds})` : sql``}
      AND cpa.tgl_actual IS NOT NULL
      AND cpa.tgl_actual BETWEEN ${startDate}::date AND ${endDate}::date
      AND cpa.updated_at >= NOW() - INTERVAL '180 minutes'
    ORDER BY cpa.tgl_actual, cpa.waktu_actual
  `;

  return c.json({ success: true, data: requests });
}

async function joinVisitCopyData(actualId: string, approverPegId: number) {
  const actualRows = await sql`SELECT * FROM call_plan_actual WHERE id = ${actualId} LIMIT 1`;
  if (actualRows.length === 0) return;
  const actual = actualRows[0];

  const approverRows = await sql`SELECT * FROM data_pegawai WHERE rowid = ${approverPegId} LIMIT 1`;
  if (approverRows.length === 0) return;
  const approver = approverRows[0];

  await sql`
    INSERT INTO call_plan_actual (
      id_peg, id_ff, nama_ff, divisi,
      id_mcl, nama_dokter, spec, segmen_md, class, institusi,
      alamat_praktek, koordinat_institusi,
      tgl_plan, waktu, product_list, keterangan,
      tgl_actual, waktu_actual, koor_visit, stt_koor, status,
      foto, foto_link, tanda_tangan, ttd_link, s3_upload_log,
      approval, approval_by, approval_date, approval_comment,
      approval_actual, approval_actual_by, approval_actual_date, approval_actual_comment,
      join_visit, join_visit_ff, join_visit_id,
      note, created_by, updated_by
    ) VALUES (
      ${approver.rowid}, ${approver.id}, ${approver.nama}, ${actual.divisi},
      ${actual.id_mcl}, ${actual.nama_dokter}, ${actual.spec}, ${actual.segmen_md}, ${actual.class}, ${actual.institusi},
      ${actual.alamat_praktek}, ${actual.koordinat_institusi},
      ${actual.tgl_plan}, ${actual.waktu}, ${actual.product_list}, ${actual.keterangan},
      ${actual.tgl_actual}, ${actual.waktu_actual}, ${actual.koor_visit}, ${actual.stt_koor}, ${actual.status},
      ${actual.foto}, ${actual.foto_link}, ${actual.tanda_tangan}, ${actual.ttd_link}, ${actual.s3_upload_log},
      ${actual.approval}, ${actual.approval_by}, ${actual.approval_date}, ${actual.approval_comment},
      ${null}, ${null}, ${null}, ${null},
      ${0}, ${String(approver.rowid)}, ${actualId},
      ${actual.note}, ${actual.created_by}, ${actual.updated_by}
    )
  `;
}

export async function copyJoinVisit(c: Context) {
  const body = await c.req.json();
  const id: string | undefined = body.id;
  const idPeg = Number(body.id_peg);
  const koorVisit = body.koor_visit;

  if (!id || !idPeg) {
    return c.json({ success: false, message: 'id dan id_peg wajib diisi' }, 400);
  }

  const mrRow = await sql`SELECT koor_visit FROM call_plan_actual WHERE id = ${id} LIMIT 1`;
  const mrKoor: string | null = mrRow[0]?.koor_visit ?? null;

  if (mrKoor) {
    if (!koorVisit || typeof koorVisit !== 'string' || !koorVisit.includes(',')) {
      return c.json(
        {
          success: false,
          message: 'Koordinat lokasi atasan tidak diterima. Tekan Get Location sebelum Approve.',
        },
        422,
      );
    }
    const mrParts = mrKoor.split(',');
    const ap = koorVisit.split(',');
    if (mrParts.length === 2 && ap.length === 2) {
      const mrLat = parseFloat(mrParts[0].trim());
      const mrLng = parseFloat(mrParts[1].trim());
      const atasanLat = parseFloat(ap[0].trim());
      const atasanLng = parseFloat(ap[1].trim());
      const jarak = hitungJarak(atasanLat, atasanLng, mrLat, mrLng);
      if (jarak > JOIN_VISIT_RADIUS_METERS) {
        // Note: legacy bug — string concat sebelum subtract = "120-20" rendered berturut.
        // Pertahankan: "Maksimum: {RADIUS-20}m" sesuai output PHP.
        return c.json(
          {
            success: false,
            message: `Lokasi Anda terlalu jauh dari lokasi MR pada saat input Visit (${Math.round(jarak)}m). Maksimum: ${JOIN_VISIT_RADIUS_METERS - 20}m.`,
          },
          422,
        );
      }
    }
  }

  try {
    await joinVisitCopyData(id, idPeg);
    return c.json({ success: true, message: 'Copy berhasil' });
  } catch (e: any) {
    return c.json({ success: false, message: `Gagal copy: ${e?.message ?? ''}` }, 500);
  }
}
