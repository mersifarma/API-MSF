import type { Context } from 'hono';
import { sql } from '../config/database';
import {
  BATAS_HARI_KERJA_LIST,
  OVERRIDE_BULAN_LIST,
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

function parseJsonOrArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function todayJakartaYmd(): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function nowJakartaIso(): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
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

function formatYm(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  return last.toISOString().slice(0, 10);
}

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ============================================================================
// Inline route handlers (server-date, modul-all, doctor-spec, app-version)
// ============================================================================

export async function serverDate(c: Context) {
  return c.json({ date: new Date().toISOString() });
}

export async function modulAll(c: Context) {
  const data = await sql`SELECT * FROM app_modul`;
  return c.json({ success: true, data });
}

export async function doctorSpec(c: Context) {
  const rows = await sql`SELECT spec FROM data_spec_dr`;
  return c.json({ success: true, data: rows.map((r: any) => r.spec) });
}

export async function getAppVersion(c: Context) {
  const rows = await sql`SELECT version, link_apk FROM call_version ORDER BY id DESC LIMIT 1`;
  if (rows.length === 0) {
    return c.json({ success: false, message: 'Data versi tidak ditemukan di database.' }, 404);
  }
  return c.json({ success: true, data: { version: rows[0].version, link_apk: rows[0].link_apk } });
}

// ============================================================================
// MCL — doctorList
// ============================================================================

export async function doctorList(c: Context) {
  const body = await c.req.json();
  const search: string = body.search ?? '';
  const specFilter: string = body.specFilter ?? '';
  const classFilter: string = body.classFilter ?? '';
  const idPegRaw = body.id_peg;
  const idPegArray: number[] = parseJsonOrArray(idPegRaw).map((v) => Number(v));

  const today = todayJakartaYmd();

  let strukturPeg: number[] = [];
  if (idPegArray.length > 0) {
    const pegawai = await sql`
      SELECT string_agg(DISTINCT jabatan, ',') AS jabatan,
             string_agg(DISTINCT divisi, ',') AS divisi
      FROM data_pegawai
      WHERE rowid = ANY(${idPegArray})
    `;
    const divisiArr: string[] = pegawai[0]?.divisi ? pegawai[0].divisi.split(',') : [];
    const isPEPM =
      (pegawai[0]?.jabatan ?? '').includes('PE') || (pegawai[0]?.jabatan ?? '').includes('PM');

    const struktur = await sql`
      SELECT string_agg(DISTINCT id_peg_mr::text, ',') AS id_peg
      FROM struktur
      WHERE ${today}::date BETWEEN periode_awal AND periode_akhir
        AND (
          id_peg_dm = ANY(${idPegArray})
          OR id_peg_rsm = ANY(${idPegArray})
          ${isPEPM && divisiArr.length > 0 ? sql`OR divisi = ANY(${divisiArr})` : sql``}
        )
    `;
    strukturPeg = struktur[0]?.id_peg
      ? struktur[0].id_peg.split(',').map((s: string) => Number(s)).filter(Boolean)
      : [];
  }

  const targetIds = idPegArray.length > 0 ? [...idPegArray, ...strukturPeg] : [0];

  const data = await sql`
    SELECT
      "ID_MD" AS id_md, "NAMA_DOKTER" AS nama_dokter, "SPEC" AS spec,
      "CLASS" AS class, "SEGMEN_MD" AS segmen_md, "INSTITUSI" AS institusi,
      "HARI_PRAKTEK" AS hari_praktek, "JAM_MULAI_PRAKTEK" AS jam_mulai_praktek,
      "JAM_SELESAI_PRAKTEK" AS jam_selesai_praktek, "DIVISI" AS divisi,
      "ID_PEG" AS id_peg, "ID_FF" AS id_ff
    FROM list_dokter_visit_new
    WHERE ("STATUS_MD" IS NULL OR "STATUS_MD" = 'AKTIF')
      ${idPegArray.length > 0 ? sql`AND "ID_PEG" = ANY(${targetIds})` : sql``}
      ${search ? sql`AND ("NAMA_DOKTER" ILIKE ${'%' + search + '%'} OR "INSTITUSI" ILIKE ${'%' + search + '%'})` : sql``}
      ${specFilter ? sql`AND "SPEC" = ${specFilter}` : sql``}
      ${classFilter ? sql`AND "CLASS" = ${classFilter}` : sql``}
    ORDER BY "NAMA_DOKTER" ASC
  `;

  return c.json({ success: true, data });
}

// ============================================================================
// Call List
// ============================================================================

export async function displayCallList(c: Context) {
  const body = await c.req.json();
  const idPegArray = parseJsonOrArray(body.id_peg).map((v) => Number(v));

  const data = await sql`
    SELECT * FROM call_list
    WHERE ${idPegArray.length > 0 ? sql`id_peg = ANY(${idPegArray})` : sql`id_peg = 0`}
  `;

  return c.json({ data });
}

export async function getCallList(c: Context) {
  const body = await c.req.json();
  const search: string = (body.search ?? '').trim();
  const idPegRaw = body.id_peg;
  const periode: string | undefined = body.periode;

  if (!idPegRaw) {
    return c.json({ success: true, data: [] });
  }

  const decoded = parseJsonOrArray(idPegRaw).map((v) => Number(v));
  const idPegArray = decoded.length > 0 ? decoded : [Number(idPegRaw)];

  const jab = await sql`
    SELECT jabatan, rowid, id
    FROM data_pegawai
    WHERE rowid = ANY(${idPegArray})
      AND COALESCE(status, 'Exist') = 'Exist'
    LIMIT 1
  `;
  const jabatan: string = jab[0]?.jabatan ?? '';
  const jabRowid: number = jab[0]?.rowid ?? 0;
  const jabId: string = jab[0]?.id ?? '';

  const today = todayJakartaYmd();

  const pegawaiRow = await sql`
    SELECT string_agg(DISTINCT jabatan, ',') AS jabatan,
           string_agg(DISTINCT divisi, ',') AS divisi
    FROM data_pegawai
    WHERE rowid = ANY(${idPegArray})
  `;
  const divisiArr: string[] = pegawaiRow[0]?.divisi ? pegawaiRow[0].divisi.split(',') : [];
  const isPEPM =
    (pegawaiRow[0]?.jabatan ?? '').includes('PE') ||
    (pegawaiRow[0]?.jabatan ?? '').includes('PM');

  const struktur = await sql`
    SELECT string_agg(DISTINCT id_peg_mr::text, ',') AS id_peg
    FROM struktur
    WHERE ${today}::date BETWEEN periode_awal AND periode_akhir
      AND (
        id_peg_dm = ANY(${idPegArray})
        OR id_peg_rsm = ANY(${idPegArray})
        ${isPEPM && divisiArr.length > 0 ? sql`OR divisi = ANY(${divisiArr})` : sql``}
      )
  `;
  const strukturPeg: number[] = struktur[0]?.id_peg
    ? struktur[0].id_peg.split(',').map((s: string) => Number(s)).filter(Boolean)
    : [];
  const targetIdPeg = [...new Set([...idPegArray, ...strukturPeg])];

  // CASE expression untuk id_peg & id_ff diturunkan dari jabatan
  const doctors = await sql`
    SELECT
      master_dokter."ID_MCL" AS id_mcl,
      master_dokter."SEGMEN_MD" AS segmen_md,
      master_dokter."NAMA_DOKTER" AS nama_dokter,
      master_dokter."SPEC" AS spec,
      master_dokter."ID_PEG" AS id_peg_mr,
      CASE
        WHEN ${jabatan} = 'ACT. DM' OR ${jabatan} = 'DM' THEN
          (SELECT id_peg_dm FROM struktur WHERE id_peg_mr = master_dokter."ID_PEG"
             AND ${today}::date BETWEEN periode_awal AND periode_akhir
           GROUP BY id_peg_dm LIMIT 1)
        WHEN ${jabatan} = 'PE' OR ${jabatan} = 'PM' THEN ${jabRowid}
        WHEN ${jabatan} = 'RSM' THEN
          (SELECT id_peg_rsm FROM struktur WHERE id_peg_mr = master_dokter."ID_PEG"
             AND ${today}::date BETWEEN periode_awal AND periode_akhir
           GROUP BY id_peg_rsm LIMIT 1)
        ELSE master_dokter."ID_PEG"
      END AS id_peg,
      CASE
        WHEN ${jabatan} = 'ACT. DM' OR ${jabatan} = 'DM' THEN
          (SELECT id_dm FROM struktur WHERE id_peg_mr = master_dokter."ID_PEG"
             AND ${today}::date BETWEEN periode_awal AND periode_akhir
           GROUP BY id_dm LIMIT 1)
        WHEN ${jabatan} = 'PE' OR ${jabatan} = 'PM' THEN ${jabId}
        WHEN ${jabatan} = 'RSM' THEN
          (SELECT id_rsm FROM struktur WHERE id_peg_mr = master_dokter."ID_PEG"
             AND ${today}::date BETWEEN periode_awal AND periode_akhir
           GROUP BY id_rsm LIMIT 1)
        ELSE master_dokter."ID_FF"
      END AS id_ff,
      master_dokter."ID_FF" AS id_ff_mr
    FROM list_dokter_visit_new master_dokter
    ${
      periode
        ? sql`LEFT JOIN call_list ON master_dokter."ID_MCL" = call_list.id_mcl
                 AND call_list.periode = ${periode}::date
                 AND call_list.id_peg = ANY(${idPegArray})`
        : sql``
    }
    WHERE COALESCE(master_dokter."STATUS_MD", 'AKTIF') = 'AKTIF'
      ${periode ? sql`AND call_list.id_mcl IS NULL` : sql``}
      ${search ? sql`AND master_dokter."NAMA_DOKTER" ILIKE ${'%' + search + '%'}` : sql``}
      AND master_dokter."ID_PEG" = ANY(${targetIdPeg})
    GROUP BY master_dokter."ID_MCL", master_dokter."SEGMEN_MD", master_dokter."NAMA_DOKTER",
             master_dokter."SPEC", master_dokter."ID_PEG", master_dokter."ID_FF"
    ORDER BY master_dokter."NAMA_DOKTER"
  `;

  if (doctors.length === 0) {
    return c.json({ success: true, data: [] });
  }

  const idMclList = [...new Set(doctors.map((d: any) => d.id_mcl))];
  const idFfList = [...new Set(doctors.map((d: any) => d.id_ff_mr).filter(Boolean))];
  const idPegList = [...new Set(doctors.map((d: any) => d.id_peg_mr).filter(Boolean))];

  const institusiRows = await sql`
    SELECT DISTINCT "ID_MCL" AS id_mcl, "INSTITUSI" AS institusi
    FROM list_dokter_visit_new
    WHERE "ID_MCL" = ANY(${idMclList})
      AND "ID_FF" = ANY(${idFfList})
      AND "ID_PEG" = ANY(${idPegList})
      AND COALESCE("STATUS_MD", 'AKTIF') = 'AKTIF'
  `;
  const praktekRows = await sql`
    SELECT DISTINCT "ID_MCL" AS id_mcl, "ALAMAT_PRAKTEK" AS alamat_praktek
    FROM list_dokter_visit_new
    WHERE "ID_MCL" = ANY(${idMclList})
      AND "ID_FF" = ANY(${idFfList})
      AND "ID_PEG" = ANY(${idPegList})
      AND COALESCE("STATUS_MD", 'AKTIF') = 'AKTIF'
  `;
  const classRows = await sql`
    SELECT "ID_MCL" AS id_mcl, MIN("CLASS") AS class
    FROM list_dokter_visit_new
    WHERE "ID_MCL" = ANY(${idMclList})
      AND "ID_FF" = ANY(${idFfList})
      AND "ID_PEG" = ANY(${idPegList})
      AND COALESCE("STATUS_MD", 'AKTIF') = 'AKTIF'
    GROUP BY "ID_MCL"
  `;

  const institusiByMcl: Record<string, any[]> = {};
  institusiRows.forEach((r: any) => {
    (institusiByMcl[r.id_mcl] ??= []).push({ institusi: r.institusi });
  });
  const praktekByMcl: Record<string, any[]> = {};
  praktekRows.forEach((r: any) => {
    (praktekByMcl[r.id_mcl] ??= []).push({ alamat_praktek: r.alamat_praktek });
  });
  const classByMcl: Record<string, any> = {};
  classRows.forEach((r: any) => {
    classByMcl[r.id_mcl] = r.class;
  });

  const data = doctors.map((d: any) => ({
    id_mcl: d.id_mcl,
    segmen_md: d.segmen_md,
    nama_dokter: d.nama_dokter,
    spec: d.spec,
    institusi: institusiByMcl[d.id_mcl] ?? [],
    alamat_praktek: praktekByMcl[d.id_mcl] ?? [],
    id_peg: d.id_peg,
    id_ff: d.id_ff,
    class: classByMcl[d.id_mcl] ?? [],
  }));

  return c.json({ success: true, data });
}

export async function getMonthlyCount(c: Context) {
  const body = await c.req.json();
  const total = await sql`
    SELECT COUNT(*) AS c FROM call_list WHERE id_peg = ${body.id_peg} AND periode = ${body.periode}::date
  `;
  const dokter = await sql`
    SELECT COUNT(*) AS c FROM call_list WHERE id_peg = ${body.id_peg} AND periode = ${body.periode}::date AND segmen = 'Doctor'
  `;
  const nonDokter = await sql`
    SELECT COUNT(*) AS c FROM call_list WHERE id_peg = ${body.id_peg} AND periode = ${body.periode}::date AND segmen = 'Non-Doctor'
  `;
  return c.json({
    success: true,
    count: Number(total[0].c),
    count_dokter: Number(dokter[0].c),
    count_non_dokter: Number(nonDokter[0].c),
  });
}

export async function saveCallList(c: Context) {
  const v = checkAppVersion(c);
  if (v) return v;
  const body = await c.req.json();
  if (!body.id_mcl) return c.json({ message: 'id_mcl cannot be null.' }, 422);
  if (!body.periode) return c.json({ message: 'Periode cannot be null.' }, 422);

  const cekpegawai = await sql`
    SELECT b.rowid, a.jumlah
    FROM call_setting a
    JOIN data_pegawai b ON a.user = b.id_user
    WHERE b.rowid = ${body.id_peg} AND a.input_set = 'Call List'
    LIMIT 1
  `;
  const hasSetting = cekpegawai.length > 0;
  const bulanPeriode = formatYm(body.periode);

  if (!OVERRIDE_BULAN_LIST || OVERRIDE_BULAN_LIST.trim() !== bulanPeriode) {
    const limit = hasSetting ? Number(cekpegawai[0].jumlah) : BATAS_HARI_KERJA_LIST;
    const periodeAwal = new Date(body.periode + 'T00:00:00Z');
    let workDayCount = 0;
    let deadline = new Date(periodeAwal);
    while (true) {
      if (isWeekday(deadline)) {
        workDayCount++;
        if (workDayCount >= limit) break;
      }
      deadline = addDays(deadline, 1);
    }
    const today = new Date(todayJakartaYmd() + 'T00:00:00Z');
    if (today.getTime() > deadline.getTime()) {
      const deadlineStr = deadline.toISOString().slice(0, 10);
      return c.json(
        {
          success: false,
          error_code: 'ADD_CALL_LIST_EXPIRED',
          message: `Penambahan call list tidak dapat dilakukan. Batas waktu ${BATAS_HARI_KERJA_LIST} hari kerja awal bulan sudah terlewat (deadline: ${deadlineStr}).`,
        },
        422,
      );
    }
  }

  const existsRow = await sql`
    SELECT 1 FROM call_list
    WHERE id_peg = ${body.id_peg} AND id_mcl = ${body.id_mcl} AND periode = ${body.periode}::date
    LIMIT 1
  `;
  if (existsRow.length > 0) {
    return c.json(
      { success: false, error_code: 'DUPLICATE_DOCTOR', message: 'Dokter sudah ada di call list bulan ini.' },
      400,
    );
  }

  const pegawai = await sql`
    SELECT jabatan, divisi FROM data_pegawai WHERE rowid = ${body.id_peg} LIMIT 1
  `;
  if (pegawai.length > 0) {
    const target = await sql`
      SELECT dokter, non_dokter FROM call_target_list
      WHERE jabatan = ${pegawai[0].jabatan} AND divisi = ${pegawai[0].divisi}
        AND periode_awal <= ${body.periode}::date
        AND (periode_akhir IS NULL OR periode_akhir >= ${body.periode}::date)
      LIMIT 1
    `;
    if (target.length > 0) {
      const segmen = body.segmen ?? 'Doctor';
      const cekpeg = await sql`
        SELECT string_agg(DISTINCT rowid::text, ',') AS id_peg
        FROM data_pegawai
        WHERE id_user IN (SELECT id_user FROM data_pegawai WHERE rowid = ${body.id_peg})
          AND COALESCE(status, 'exist') = 'exist'
      `;
      const idPegIds: number[] = cekpeg[0]?.id_peg
        ? cekpeg[0].id_peg.split(',').map((s: string) => Number(s))
        : [Number(body.id_peg)];

      if (segmen === 'Doctor') {
        const cnt = await sql`
          SELECT COUNT(*) AS c FROM call_list
          WHERE id_peg = ANY(${idPegIds}) AND periode = ${body.periode}::date AND segmen = 'Doctor'
        `;
        if (Number(cnt[0].c) >= Number(target[0].dokter)) {
          return c.json(
            { success: false, error_code: 'TARGET_DOKTER_FULL', message: `Target Dokter sudah penuh (maks. ${target[0].dokter}).` },
            400,
          );
        }
      } else {
        const cnt = await sql`
          SELECT COUNT(*) AS c FROM call_list
          WHERE id_peg = ANY(${idPegIds}) AND periode = ${body.periode}::date AND segmen = 'Non-Doctor'
        `;
        if (Number(cnt[0].c) >= Number(target[0].non_dokter)) {
          return c.json(
            { success: false, error_code: 'TARGET_NON_DOKTER_FULL', message: `Target Non-Dokter sudah penuh (maks. ${target[0].non_dokter}).` },
            400,
          );
        }
      }
    }
  }

  // Wilayah luar kota
  const getjabatan = await sql`SELECT jabatan FROM data_pegawai WHERE rowid = ${body.id_peg} LIMIT 1`;
  const getstruktur = await sql`
    SELECT string_agg(DISTINCT id_peg_mr::text, ',') AS id_peg
    FROM struktur
    WHERE ${body.periode}::date BETWEEN periode_awal AND periode_akhir
      AND (id_peg_mr = ${body.id_peg} OR id_peg_dm = ${body.id_peg} OR id_peg_rsm = ${body.id_peg})
  `;
  const ids: number[] = getstruktur[0]?.id_peg
    ? getstruktur[0].id_peg.split(',').map((s: string) => Number(s))
    : [];

  const gettarget = await sql`
    SELECT COALESCE(MAX("WILAYAH"), 'Dalam Kota') AS wilayah,
           COALESCE(MAX("WILAYAH_DM"), 'Dalam Kota') AS wilayah_dm,
           COALESCE(MAX("WILAYAH_RSM"), 'Dalam Kota') AS wilayah_rsm
    FROM list_dokter_visit_new
    WHERE "ID_PEG" = ANY(${ids.length > 0 ? ids : [0]})
      AND "ID_MCL" = ${body.id_mcl}
      AND COALESCE("STATUS_MD", 'AKTIF') = 'AKTIF'
  `;

  let target_visit: number | null = null;
  let wilayah: string | null = null;
  const jab = getjabatan[0]?.jabatan;
  const tg = gettarget[0];
  if (jab && tg) {
    if (['MR', 'PS', 'KAE'].includes(jab) && tg.wilayah === 'Luar Kota') {
      target_visit = 1;
      wilayah = 'Luar Kota';
    } else if (['DM', 'ACT. DM'].includes(jab) && tg.wilayah_dm === 'Luar Kota') {
      target_visit = 1;
      wilayah = 'Luar Kota';
    } else if (jab === 'RSM' && tg.wilayah_rsm === 'Luar Kota') {
      target_visit = 1;
      wilayah = 'Luar Kota';
    }
  }

  const inserted = await sql`
    INSERT INTO call_list (
      id_mcl, periode, nama_dokter, spec, segmen, id_peg, id_ff, class, target_visit, wilayah
    ) VALUES (
      ${body.id_mcl}, ${body.periode}::date, ${body.nama_dokter ?? ''}, ${body.spec ?? ''},
      ${body.segmen ?? ''}, ${body.id_peg}, ${body.id_ff ?? ''}, ${body.class ?? ''},
      ${target_visit}, ${wilayah}
    ) RETURNING id
  `;

  return c.json({ success: true, message: 'Call list saved successfully.', id: inserted[0].id });
}

// ============================================================================
// Call Plan
// ============================================================================

export async function displayCallPlan(c: Context) {
  const body = await c.req.json();
  const idPegArray = parseJsonOrArray(body.id_peg).map((v) => Number(v));
  const monthYear: string | undefined = body.monthYear;
  const dateSearch: string | undefined = body.dateSearch;
  const search: string | undefined = body.search;

  const data = await sql`
    SELECT * FROM call_plan_actual
    WHERE tgl_plan IS NOT NULL
      AND ${idPegArray.length > 0 ? sql`id_peg = ANY(${idPegArray})` : sql`id_peg = 0`}
      ${monthYear ? sql`AND to_char(tgl_plan, 'YYYY-MM') = ${monthYear}` : sql``}
      ${dateSearch ? sql`AND tgl_plan = ${dateSearch}::date` : sql``}
      ${search ? sql`AND (nama_dokter ILIKE ${'%' + search + '%'} OR institusi ILIKE ${'%' + search + '%'})` : sql``}
  `;

  return c.json({ data });
}

export async function callPlanDoctor(c: Context) {
  const body = await c.req.json();
  const search: string = (body.search ?? '').trim();
  const idPeg = body.id_peg ?? null;
  const year: number | undefined = body.year;
  const month: number | undefined = body.month;

  const decoded = parseJsonOrArray(idPeg).map((v) => Number(v));
  const idPegArray = decoded.length > 0 ? decoded : idPeg ? [Number(idPeg)] : [];

  const doctors = await sql`
    SELECT id_mcl, id_ff, nama_dokter, spec, segmen, class, id_peg
    FROM call_list
    WHERE approval = 'Approve'
      ${search ? sql`AND nama_dokter ILIKE ${'%' + search + '%'}` : sql``}
      ${year && month ? sql`AND EXTRACT(YEAR FROM periode) = ${year} AND EXTRACT(MONTH FROM periode) = ${month}` : sql``}
      ${idPegArray.length > 0 ? sql`AND id_peg = ANY(${idPegArray})` : sql``}
    ORDER BY nama_dokter ASC
  `;

  return c.json({ success: true, data: doctors });
}

export async function callPlanInst(c: Context) {
  const body = await c.req.json();
  const idMcl = body.id_mcl ?? null;
  const idFF = body.id_ff ?? null;
  if (!idMcl && !idFF) {
    return c.json({ success: false, message: 'id_mcl and id_ff are required.' });
  }

  const idFFArr = parseJsonOrArray(idFF);
  const idFFArray = idFFArr.length > 0 ? idFFArr : [idFF];

  const jab = await sql`
    SELECT MAX(jabatan) AS jabatan, MAX(rowid) AS rowid, MAX(id) AS id, MAX(nama) AS nama,
           string_agg(DISTINCT divisi, ',') AS divisi
    FROM data_pegawai
    WHERE id = ANY(${idFFArray})
      AND COALESCE(status, 'Exist') = 'Exist'
  `;

  const jabatan: string = jab[0]?.jabatan ?? '';
  const jabId: string = jab[0]?.id ?? '';
  const jabNama: string = jab[0]?.nama ?? '';
  const divisi: string = jab[0]?.divisi ?? '';
  const divisiArr: string[] = divisi ? divisi.split(',') : [];
  const isPEPM = jabatan.includes('PE') || jabatan.includes('PM');
  const today = todayJakartaYmd();

  const results = await sql`
    SELECT
      z."ID_FF" AS id_ff_mr,
      z."NAMA_FF" AS nama_ff_mr,
      CASE
        WHEN ${jabatan} = 'ACT. DM' OR ${jabatan} = 'DM' THEN
          (SELECT id_dm FROM struktur WHERE id_mr = z."ID_FF"
             AND ${today}::date BETWEEN periode_awal AND periode_akhir
           GROUP BY id_dm LIMIT 1)
        WHEN ${jabatan} = 'PE' OR ${jabatan} = 'PM' THEN ${jabId}
        WHEN ${jabatan} = 'RSM' THEN
          (SELECT id_rsm FROM struktur WHERE id_mr = z."ID_FF"
             AND ${today}::date BETWEEN periode_awal AND periode_akhir
           GROUP BY id_rsm LIMIT 1)
        ELSE z."ID_FF"
      END AS id_ff,
      CASE
        WHEN ${jabatan} = 'ACT. DM' OR ${jabatan} = 'DM' THEN
          (SELECT b.nama FROM struktur a JOIN data_pegawai b ON a.id_peg_dm = b.rowid
             WHERE a.id_mr = z."ID_FF"
               AND ${today}::date BETWEEN a.periode_awal AND a.periode_akhir
           GROUP BY b.nama LIMIT 1)
        WHEN ${jabatan} = 'PE' OR ${jabatan} = 'PM' THEN ${jabNama}
        WHEN ${jabatan} = 'RSM' THEN
          (SELECT b.nama FROM struktur a JOIN data_pegawai b ON a.id_peg_rsm = b.rowid
             WHERE a.id_mr = z."ID_FF"
               AND ${today}::date BETWEEN a.periode_awal AND a.periode_akhir
           GROUP BY b.nama LIMIT 1)
        ELSE z."NAMA_FF"
      END AS nama_ff,
      z."DIVISI" AS divisi,
      z."INSTITUSI" AS institusi,
      z."ALAMAT_PRAKTEK" AS alamat_praktek,
      z."KOORDINAT_INSTITUSI" AS koordinat_institusi,
      z."ID_MCL" AS id_mcl,
      z."SEGMEN_MD" AS segmen_md
    FROM list_dokter_visit_new z
    WHERE z."ID_MCL" = ${Number(idMcl)}
      AND z."ID_PEG" IN (
        SELECT id_peg_mr FROM struktur
        WHERE ${today}::date BETWEEN periode_awal AND periode_akhir
          AND (
            ${isPEPM && divisiArr.length > 0 ? sql`divisi = ANY(${divisiArr})` : sql`(id_mr = ANY(${idFFArray}) OR id_dm = ANY(${idFFArray}) OR id_rsm = ANY(${idFFArray}))`}
          )
      )
      AND COALESCE(z."STATUS_MD", 'AKTIF') = 'AKTIF'
    ORDER BY z."INSTITUSI"
  `;

  return c.json({ success: true, data: results });
}

export async function getProductList(c: Context) {
  const divisi = c.req.query('divisi');
  const products = await sql`
    SELECT id_product, nama_product, jenis_product, kemasan, product_detail_link
    FROM data_product
    WHERE status = 'AKTIF'
      ${divisi ? sql`AND divisi = ${divisi}` : sql``}
    ORDER BY nama_product
  `;
  return c.json({ success: true, data: products });
}

export async function saveCallPlan(c: Context) {
  const v = checkAppVersion(c);
  if (v) return v;
  const body = await c.req.json();
  if (!body.id_mcl) return c.json({ message: 'id_mcl cannot be null.' }, 422);
  if (!body.tgl_plan) return c.json({ message: 'tgl_plan cannot be null.' }, 422);
  if (!body.waktu) return c.json({ message: 'Waktu cannot be null.' }, 422);

  const inserted = await sql`
    INSERT INTO call_plan_actual (
      id_peg, id_ff, nama_ff, divisi, tgl_plan, waktu, id_mcl, nama_dokter, spec, segmen_md,
      class, institusi, alamat_praktek, keterangan, product_list, status, koordinat_institusi
    ) VALUES (
      ${body.id_peg}, ${body.id_ff ?? ''}, ${body.nama_ff ?? ''}, ${body.divisi ?? ''},
      ${body.tgl_plan}::date, ${body.waktu}, ${body.id_mcl}, ${body.nama_dokter ?? ''},
      ${body.spec ?? ''}, ${body.segmen_md ?? null}, ${body.class ?? ''}, ${body.institusi ?? ''},
      ${body.alamat_praktek ?? ''}, ${body.keterangan ?? ''}, ${body.product_list ?? null},
      ${body.status ?? ''}, ${body.koordinat_institusi ?? ''}
    ) RETURNING id
  `;

  return c.json({ success: true, message: 'Call list saved successfully.', id: inserted[0].id });
}

// ============================================================================
// Actual
// ============================================================================

export async function getActualDetails(c: Context) {
  const id = c.req.param('id');
  const rows = await sql`SELECT * FROM call_plan_actual WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) {
    return c.json({ success: false, message: 'Data not found' }, 404);
  }
  const data: any = rows[0];

  const joinVisitNames: string[] = [];
  if (data.join_visit_ff) {
    if ((data.status ?? '') !== 'join_visit') {
      const idParts = String(data.join_visit_ff)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => n > 0);
      for (const pegId of idParts) {
        const p = await sql`SELECT rowid, nama FROM data_pegawai WHERE rowid = ${pegId} LIMIT 1`;
        if (p.length > 0) joinVisitNames.push(p[0].nama);
      }
    } else {
      const mrRecordId = String(data.join_visit_ff).trim();
      const mr = await sql`SELECT id_peg, join_visit_ff FROM call_plan_actual WHERE id = ${mrRecordId} LIMIT 1`;
      if (mr.length > 0) {
        const mrPeg = await sql`SELECT nama FROM data_pegawai WHERE rowid = ${mr[0].id_peg} LIMIT 1`;
        if (mrPeg.length > 0) joinVisitNames.push(mrPeg[0].nama);
        if (mr[0].join_visit_ff) {
          const atasanIds = String(mr[0].join_visit_ff)
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => n > 0 && n !== data.id_peg);
          for (const atasanPegId of atasanIds) {
            const p = await sql`SELECT nama FROM data_pegawai WHERE rowid = ${atasanPegId} LIMIT 1`;
            if (p.length > 0) joinVisitNames.push(p[0].nama);
          }
        }
      }
    }
  }

  data.join_visit_names = joinVisitNames;
  return c.json({ success: true, data });
}

export async function saveActual(c: Context) {
  const v = checkAppVersion(c);
  if (v) return v;
  const body = await c.req.json();
  if (!body.id) return c.json({ message: 'id required' }, 422);
  if (!body.koor_visit) return c.json({ message: 'koor_visit required' }, 422);
  if (!body.foto_link) return c.json({ message: 'foto_link required' }, 422);

  if (body.tgl_actual !== todayJakartaYmd()) {
    return c.json(
      {
        success: false,
        error_code: 'INVALID_TIME_SETTING',
        message: 'Anda merubah tanggal device, sesuaikan dengan tanggal sekarang.\nUntuk WIT & WITA kunjungan mulai dari Pukul 02.30.',
      },
      500,
    );
  }

  if (body.tgl_actual && body.waktu_actual && String(body.status ?? '').includes('offline')) {
    const waktu = new Date(`${body.tgl_actual}T${body.waktu_actual}+07:00`);
    const nowJ = new Date(Date.now());
    const selisihMenit = (waktu.getTime() - nowJ.getTime()) / 60000;
    if (selisihMenit < -60) {
      return c.json(
        {
          success: false,
          error_code: 'VISIT_TIME_EXPIRED',
          message: 'Gagal menyimpan: kunjungan sudah lebih dari 1 jam yang lalu.',
        },
        422,
      );
    }
  }

  try {
    await sql`
      UPDATE call_plan_actual SET
        keterangan = ${body.keterangan ?? ''},
        tgl_actual = ${body.tgl_actual ?? null}::date,
        waktu_actual = ${body.waktu_actual ?? null},
        koor_visit = ${body.koor_visit},
        stt_koor = ${body.stt_koor ?? 0},
        status = ${body.status ?? ''},
        join_visit = ${body.join_visit ?? 0},
        join_visit_ff = ${body.join_visit_id ?? null},
        foto = ${body.foto ?? null},
        tanda_tangan = ${body.tanda_tangan ?? null},
        foto_link = ${body.foto_link ?? null},
        ttd_link = ${body.ttd_link ?? null},
        s3_upload_log = ${body.s3_upload_log ?? null},
        updated_at = NOW()
      WHERE id = ${body.id}
    `;
    return c.json({ success: true, id: body.id });
  } catch (e: any) {
    console.error('saveActual error:', e?.message);
    return c.json({ success: false, message: `Gagal menyimpan actual: ${e?.message ?? ''}` }, 500);
  }
}

export async function displayActual(c: Context) {
  const body = await c.req.json();
  const idPegArray = parseJsonOrArray(body.id_peg).map((v) => Number(v));
  const monthYear: string | undefined = body.monthYear;
  const dateSearch: string | undefined = body.dateSearch;
  const search: string | undefined = body.search;

  const data = await sql`
    SELECT * FROM call_plan_actual
    WHERE status IS NOT NULL AND status != ''
      AND ${idPegArray.length > 0 ? sql`id_peg = ANY(${idPegArray})` : sql`id_peg = 0`}
      ${monthYear ? sql`AND to_char(tgl_actual, 'YYYY-MM') = ${monthYear}` : sql``}
      ${dateSearch ? sql`AND tgl_actual = ${dateSearch}::date` : sql``}
      ${search ? sql`AND (nama_dokter ILIKE ${'%' + search + '%'} OR institusi ILIKE ${'%' + search + '%'})` : sql``}
  `;
  return c.json({ data });
}

export async function saveUnplanned(c: Context) {
  const v = checkAppVersion(c);
  if (v) return v;
  const body = await c.req.json();
  if (!body.koor_visit) return c.json({ message: 'koor_visit required' }, 422);
  if (!body.foto_link) return c.json({ message: 'foto_link required' }, 422);

  if (body.tgl_actual !== todayJakartaYmd()) {
    return c.json(
      {
        success: false,
        error_code: 'INVALID_TIME_SETTING',
        message: 'Anda merubah tanggal device, sesuaikan dengan tanggal sekarang.\nUntuk WIT & WITA kunjungan mulai dari Pukul 02.30.',
      },
      500,
    );
  }

  if (body.tgl_actual && body.waktu_actual && String(body.status ?? '').includes('offline')) {
    const waktu = new Date(`${body.tgl_actual}T${body.waktu_actual}+07:00`);
    const nowJ = new Date(Date.now());
    const selisihMenit = (waktu.getTime() - nowJ.getTime()) / 60000;
    if (selisihMenit < -60) {
      return c.json(
        {
          success: false,
          error_code: 'VISIT_TIME_EXPIRED',
          message: 'Gagal menyimpan: kunjungan sudah lebih dari 1 jam yang lalu.',
        },
        422,
      );
    }
  }

  const tglActual = body.tgl_actual ?? todayJakartaYmd();
  const existing = await sql`
    SELECT 1 FROM call_plan_actual
    WHERE id_peg = ${body.id_peg} AND id_mcl = ${body.id_mcl} AND tgl_actual = ${tglActual}::date
    LIMIT 1
  `;
  if (existing.length > 0) {
    const namaDokter = body.nama_dokter ?? 'Dokter ini';
    const [yy, mm, dd] = tglActual.split('-');
    const tglFmt = `${dd}/${mm}/${yy}`;
    return c.json(
      {
        success: false,
        error_code: 'ALREADY_VISITED_TODAY',
        message: `${namaDokter} sudah dikunjungi pada ${tglFmt}. Kunjungan tidak dapat disimpan lebih dari sekali dalam sehari.`,
      },
      422,
    );
  }

  try {
    const inserted = await sql`
      INSERT INTO call_plan_actual (
        id_peg, id_ff, nama_ff, divisi, tgl_plan, waktu, id_mcl, nama_dokter, spec, segmen_md,
        class, institusi, alamat_praktek, keterangan, status, koordinat_institusi,
        tgl_actual, waktu_actual, koor_visit, stt_koor, join_visit, join_visit_ff,
        product_list, foto, tanda_tangan, foto_link, ttd_link, s3_upload_log
      ) VALUES (
        ${body.id_peg}, ${body.id_ff}, ${body.nama_ff}, ${body.divisi},
        ${body.tgl_plan ?? null}, ${body.waktu ?? null}, ${body.id_mcl}, ${body.nama_dokter},
        ${body.spec}, ${body.segmen_md ?? null}, ${body.class}, ${body.institusi},
        ${body.alamat_praktek}, ${body.keterangan}, ${body.status}, ${body.koordinat_institusi},
        ${body.tgl_actual}::date, ${body.waktu_actual}, ${body.koor_visit}, ${body.stt_koor ?? 0},
        ${body.join_visit ?? 0}, ${body.join_visit_id ?? null},
        ${body.product_list ?? null}, ${body.foto ?? null}, ${body.tanda_tangan ?? null},
        ${body.foto_link ?? null}, ${body.ttd_link ?? null}, ${body.s3_upload_log ?? null}
      ) RETURNING id
    `;
    return c.json({ success: true, message: 'Call list saved successfully.', id: inserted[0].id });
  } catch (e: any) {
    console.error('saveUnplanned error:', e?.message);
    const m = String(e?.message ?? '');
    if (m.includes('duplicate') || m.includes('unique')) {
      const namaDokter = body.nama_dokter ?? 'Dokter ini';
      return c.json(
        {
          success: false,
          error_code: 'ALREADY_VISITED_TODAY',
          message: `${namaDokter} sudah pernah dikunjungi hari ini. Data tidak dapat disimpan dua kali.`,
        },
        422,
      );
    }
    return c.json(
      { success: false, message: 'Gagal menyimpan kunjungan. Silakan coba lagi atau hubungi admin.' },
      500,
    );
  }
}

export async function getNtData(c: Context) {
  const body = await c.req.json();
  const idPegArray = parseJsonOrArray(body.id_peg).map((v) => Number(v));
  const search: string = (body.search ?? '').trim();
  const today = todayJakartaYmd();

  let strukturPeg: number[] = [];
  if (idPegArray.length > 0) {
    const pegawai = await sql`
      SELECT string_agg(DISTINCT jabatan, ',') AS jabatan,
             string_agg(DISTINCT divisi, ',') AS divisi
      FROM data_pegawai
      WHERE rowid = ANY(${idPegArray})
    `;
    const divisiArr: string[] = pegawai[0]?.divisi ? pegawai[0].divisi.split(',') : [];
    const isPEPM =
      (pegawai[0]?.jabatan ?? '').includes('PE') || (pegawai[0]?.jabatan ?? '').includes('PM');
    const struktur = await sql`
      SELECT string_agg(DISTINCT id_peg_mr::text, ',') AS id_peg
      FROM struktur
      WHERE ${today}::date BETWEEN periode_awal AND periode_akhir
        AND (
          id_peg_dm = ANY(${idPegArray})
          OR id_peg_rsm = ANY(${idPegArray})
          ${isPEPM && divisiArr.length > 0 ? sql`OR divisi = ANY(${divisiArr})` : sql``}
        )
    `;
    strukturPeg = struktur[0]?.id_peg
      ? struktur[0].id_peg.split(',').map((s: string) => Number(s)).filter(Boolean)
      : [];
  }

  const targetIds = idPegArray.length > 0 ? [...idPegArray, ...strukturPeg] : [0];

  const data = await sql`
    SELECT
      MIN("ID_MCL") AS id_mcl,
      "NAMA_DOKTER" AS nama_dokter,
      MIN("SPEC") AS spec,
      MIN("SEGMEN_MD") AS segmen_md,
      MIN("CLASS") AS class,
      "INSTITUSI" AS institusi,
      MIN("ALAMAT_PRAKTEK") AS alamat_praktek,
      MIN("KOORDINAT_INSTITUSI") AS koordinat_institusi
    FROM list_dokter_visit_new
    WHERE COALESCE("STATUS_MD", 'AKTIF') = 'AKTIF'
      ${idPegArray.length > 0 ? sql`AND "ID_PEG" = ANY(${targetIds})` : sql``}
      ${search ? sql`AND ("NAMA_DOKTER" ILIKE ${'%' + search + '%'} OR "INSTITUSI" ILIKE ${'%' + search + '%'})` : sql``}
    GROUP BY "NAMA_DOKTER", "INSTITUSI"
  `;

  return c.json({ success: true, data });
}

export async function getFFname(c: Context) {
  const body = await c.req.json();
  const ids = Array.isArray(body.id_peg) ? body.id_peg.map((v: any) => Number(v)) : [Number(body.id_peg)];
  const data = await sql`
    SELECT rowid, id, nama, divisi FROM data_pegawai WHERE rowid = ANY(${ids})
  `;
  return c.json({ success: true, data });
}

// ============================================================================
// Delete operations
// ============================================================================

export async function deleteCallList(c: Context) {
  try {
    const body = await c.req.json();
    if (!body.id_mcl || !body.id_peg || !body.periode) {
      return c.json({ success: false, message: 'id_mcl, id_peg, periode required' }, 422);
    }
    const periodeDate = new Date(body.periode);
    const periodeYear = periodeDate.getUTCFullYear();
    const periodeMonth = periodeDate.getUTCMonth() + 1;

    const existsInPlan = await sql`
      SELECT 1 FROM call_plan_actual
      WHERE id_mcl = ${body.id_mcl} AND id_peg = ${body.id_peg}
        AND tgl_plan IS NOT NULL
        AND EXTRACT(YEAR FROM tgl_plan) = ${periodeYear}
        AND EXTRACT(MONTH FROM tgl_plan) = ${periodeMonth}
      LIMIT 1
    `;
    if (existsInPlan.length > 0) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return c.json(
        {
          success: false,
          message: `Cannot delete! This customer already has a Call Plan scheduled for ${monthNames[periodeMonth - 1]} ${periodeYear}.`,
        },
        400,
      );
    }

    const rec = await sql`
      SELECT approval FROM call_list
      WHERE id_mcl = ${body.id_mcl} AND id_peg = ${body.id_peg} AND periode = ${body.periode}::date
      LIMIT 1
    `;
    if (rec.length > 0 && rec[0].approval === 'Reject') {
      return c.json(
        { success: false, message: 'Cannot delete! Status is Rejected. Please edit the data instead.' },
        400,
      );
    }

    const del = await sql`
      DELETE FROM call_list
      WHERE id_mcl = ${body.id_mcl} AND id_peg = ${body.id_peg} AND periode = ${body.periode}::date
      RETURNING id
    `;
    if (del.length > 0) {
      return c.json({ success: true, message: 'Call list deleted successfully.', deleted_rows: del.length });
    }
    return c.json({ success: false, message: 'Failed to delete call list. Data not found or already deleted.' }, 404);
  } catch (e: any) {
    return c.json({ success: false, message: `Error: ${e?.message ?? ''}` }, 500);
  }
}

export async function deleteCallPlan(c: Context) {
  try {
    const body = await c.req.json();
    if (!body.id) return c.json({ success: false, message: 'id required' }, 422);

    const rec = await sql`SELECT tgl_actual FROM call_plan_actual WHERE id = ${body.id} LIMIT 1`;
    if (rec.length === 0) return c.json({ success: false, message: 'Call plan not found.' }, 404);
    if (rec[0].tgl_actual) {
      return c.json({ success: false, message: 'Cannot delete! This plan already has actual visit date.' }, 400);
    }

    const del = await sql`DELETE FROM call_plan_actual WHERE id = ${body.id} RETURNING id`;
    if (del.length > 0) return c.json({ success: true, message: 'Call plan deleted successfully.' });
    return c.json({ success: false, message: 'Failed to delete call plan.' }, 400);
  } catch (e: any) {
    return c.json({ success: false, message: `Error: ${e?.message ?? ''}` }, 500);
  }
}

// ============================================================================
// Reports
// ============================================================================

export async function getReachProdReport(c: Context) {
  const body = await c.req.json();
  const idPegArray = parseJsonOrArray(body.id_peg).map((v) => Number(v));
  const year = body.year;
  const month = body.month;
  const targetIds = idPegArray.length > 0 ? idPegArray : [0];
  const periodeLike = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}%`;

  const reachDoc = await sql`
    SELECT COUNT(DISTINCT cpa.id_mcl) AS c
    FROM call_plan_actual cpa
    WHERE cpa.approval_actual = 'Approve'
      AND cpa.id_peg = ANY(${targetIds})
      ${year && month ? sql`AND EXTRACT(YEAR FROM cpa.tgl_actual) = ${year} AND EXTRACT(MONTH FROM cpa.tgl_actual) = ${month}` : sql``}
      AND cpa.segmen_md = 0
      AND cpa.status IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM call_list
        WHERE call_list.id_mcl = cpa.id_mcl
          AND call_list.id_peg = ANY(${targetIds})
          AND call_list.segmen = 'Doctor'
          AND to_char(call_list.periode, 'YYYY-MM-DD') LIKE ${periodeLike}
      )
  `;
  const reachNonDoc = await sql`
    SELECT COUNT(DISTINCT cpa.id_mcl) AS c
    FROM call_plan_actual cpa
    WHERE cpa.approval_actual = 'Approve'
      AND cpa.id_peg = ANY(${targetIds})
      ${year && month ? sql`AND EXTRACT(YEAR FROM cpa.tgl_actual) = ${year} AND EXTRACT(MONTH FROM cpa.tgl_actual) = ${month}` : sql``}
      AND cpa.segmen_md = 1
      AND cpa.status IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM call_list
        WHERE call_list.id_mcl = cpa.id_mcl
          AND call_list.id_peg = ANY(${targetIds})
          AND call_list.segmen = 'Non-Doctor'
          AND to_char(call_list.periode, 'YYYY-MM-DD') LIKE ${periodeLike}
      )
  `;
  const prodDoc = await sql`
    SELECT COUNT(*) AS c
    FROM call_plan_actual
    WHERE approval_actual = 'Approve'
      AND id_peg = ANY(${targetIds})
      ${year && month ? sql`AND EXTRACT(YEAR FROM tgl_actual) = ${year} AND EXTRACT(MONTH FROM tgl_actual) = ${month}` : sql``}
      AND segmen_md = 0
      AND status IS NOT NULL AND status != ''
  `;
  const prodNonDoc = await sql`
    SELECT COUNT(*) AS c
    FROM call_plan_actual
    WHERE approval_actual = 'Approve'
      AND id_peg = ANY(${targetIds})
      ${year && month ? sql`AND EXTRACT(YEAR FROM tgl_actual) = ${year} AND EXTRACT(MONTH FROM tgl_actual) = ${month}` : sql``}
      AND segmen_md = 1
      AND status IS NOT NULL AND status != ''
  `;

  return c.json({
    success: true,
    reach_doctor: Number(reachDoc[0].c),
    reach_non_doctor: Number(reachNonDoc[0].c),
    prod_doctor: Number(prodDoc[0].c),
    prod_non_doctor: Number(prodNonDoc[0].c),
  });
}

export async function getFreqReport(c: Context) {
  const body = await c.req.json();
  const idPegArray = parseJsonOrArray(body.id_peg).map((v) => Number(v));
  const periode: string = body.periode;
  const targetIds = idPegArray.length > 0 ? idPegArray : [0];

  const data = await sql`
    SELECT
      a.id_peg, a.id_ff, c.jabatan, c.divisi, a.id_mcl, a.nama_dokter,
      a.segmen, a.class,
      COALESCE(a.target_visit, b.target) AS target,
      (
        SELECT COUNT(id) FROM call_plan_actual
        WHERE to_char(tgl_actual, 'YYYY-MM-DD') LIKE ${periode + '%'}
          AND id_peg = ANY(${targetIds})
          AND id_mcl = a.id_mcl
          AND approval_actual = 'Approve'
      ) AS actual,
      CASE
        WHEN (
          SELECT COUNT(id) FROM call_plan_actual
          WHERE to_char(tgl_actual, 'YYYY-MM-DD') LIKE ${periode + '%'}
            AND id_peg = ANY(${targetIds})
            AND id_mcl = a.id_mcl
            AND approval_actual = 'Approve'
        ) >= COALESCE(a.target_visit, b.target)
        THEN 1 ELSE 0
      END AS point
    FROM call_list a
    JOIN data_pegawai c ON a.id_peg = c.rowid
    JOIN call_target_class b ON c.jabatan = b.jabatan AND a.class = b.class
    WHERE to_char(a.periode, 'YYYY-MM-DD') LIKE ${periode + '%'}
      AND a.id_peg = ANY(${targetIds})
  `;

  const freqDoctor = data.filter((i: any) => (i.segmen === 'Doctor' || i.segmen == 0) && i.point == 1).length;
  const freqNonDoctor = data.filter((i: any) => (i.segmen === 'Non-Doctor' || i.segmen == 1) && i.point == 1).length;

  return c.json({ success: true, data, freq_doctor: freqDoctor, freq_non_doctor: freqNonDoctor });
}

export async function getCallListTarget(c: Context) {
  try {
    const body = await c.req.json();
    if (!body.id_peg) {
      return c.json({ success: false, message: 'id_peg is required', target_dokter: 0, target_non_dokter: 0 });
    }
    const decoded = parseJsonOrArray(body.id_peg);
    const pegawaiId = decoded.length > 0 ? decoded[0] : body.id_peg;

    const pegawai = await sql`
      SELECT jabatan, divisi FROM data_pegawai WHERE rowid = ${pegawaiId} LIMIT 1
    `;
    if (pegawai.length === 0) {
      return c.json({ success: false, message: 'Pegawai not found', target_dokter: 0, target_non_dokter: 0 });
    }

    let targetRows;
    if (body.periode) {
      targetRows = await sql`
        SELECT dokter, non_dokter FROM call_target_list
        WHERE jabatan = ${pegawai[0].jabatan} AND divisi = ${pegawai[0].divisi}
          AND periode_awal <= ${body.periode}::date
          AND (periode_akhir IS NULL OR periode_akhir >= ${body.periode}::date)
        LIMIT 1
      `;
    } else {
      targetRows = await sql`
        SELECT dokter, non_dokter FROM call_target_list
        WHERE jabatan = ${pegawai[0].jabatan} AND divisi = ${pegawai[0].divisi}
        LIMIT 1
      `;
    }
    const t = targetRows[0];

    return c.json({
      success: true,
      jabatan: pegawai[0].jabatan,
      divisi: pegawai[0].divisi,
      target_dokter: Number(t?.dokter ?? 0),
      target_non_dokter: Number(t?.non_dokter ?? 0),
      target_total: Number(t?.dokter ?? 0) + Number(t?.non_dokter ?? 0),
    });
  } catch (e: any) {
    return c.json({ success: false, message: `Error: ${e?.message ?? ''}`, target_dokter: 0, target_non_dokter: 0 }, 500);
  }
}

// Note: getWorkingDays + getProductivityTarget mengambil dari report_admin_mkt.set_param_sum_mcr
// (tabel di schema lain, MariaDB). Di Postgres tidak ada → endpoint return working_days=0.
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function getWorkingDays(c: Context) {
  const body = await c.req.json();
  const year = body.year;
  const month = body.month;
  if (!year || !month) {
    return c.json({ success: false, message: 'Year and month are required', working_days: 0 });
  }

  const monthPad = String(month).padStart(2, '0');
  const bulanFormatted = `${MONTH_NAMES[Number(monthPad) - 1]}-${year}`;

  let workingDays = 0;
  try {
    const r = await sql`
      SELECT hari_kerja FROM report_admin_mkt.set_param_sum_mcr
      WHERE bulan = ${bulanFormatted} AND target = 'Y' LIMIT 1
    `;
    workingDays = Number(r[0]?.hari_kerja ?? 0);
  } catch {
    workingDays = 0;
  }

  const idPeg = body.id_peg;
  let unvisitCount = 0;
  if (idPeg) {
    const periodeFmt = `${year}-${monthPad}-01`;
    const mr = await sql`SELECT COUNT(*) AS c FROM visit_tidak_kunjungan_mr WHERE id_peg = ${idPeg} AND periode = ${periodeFmt}`;
    const nonMr = await sql`SELECT COUNT(*) AS c FROM visit_tidak_kunjungan WHERE id_peg = ${idPeg} AND periode = ${periodeFmt}`;
    unvisitCount = Number(mr[0].c) + Number(nonMr[0].c);
  }
  const eff = Math.max(0, workingDays - unvisitCount);

  return c.json({
    success: true,
    working_days: workingDays,
    unvisit_count: unvisitCount,
    effective_working_days: eff,
    period: bulanFormatted,
    debug: { input_year: year, input_month: month, formatted_period: bulanFormatted },
  });
}

export async function getProductivityTarget(c: Context) {
  const body = await c.req.json();
  const idPeg = body.id_peg;
  const year = body.year;
  const month = body.month;
  if (!idPeg || !year || !month) {
    return c.json({ success: false, message: 'id_peg, year, month are required' }, 422);
  }

  try {
    const pegawai = await sql`SELECT jabatan, divisi FROM data_pegawai WHERE rowid = ${idPeg} LIMIT 1`;
    if (pegawai.length === 0) return c.json({ success: false, message: 'Pegawai not found' }, 404);

    const monthPad = String(month).padStart(2, '0');
    const periodeStr = `${year}-${monthPad}-01`;
    const periodeStrUnvisit = `${monthPad}-${year}`;

    const target = await sql`
      SELECT dokter, non_dokter FROM call_target_hari
      WHERE jabatan = ${pegawai[0].jabatan} AND divisi = ${pegawai[0].divisi}
        AND periode_awal::date <= ${periodeStr}::date
        AND (periode_akhir IS NULL OR periode_akhir::date >= ${periodeStr}::date)
      ORDER BY periode_awal DESC LIMIT 1
    `;
    const dokterPerDay = Number(target[0]?.dokter ?? 0);
    const nonDokterPerDay = Number(target[0]?.non_dokter ?? 0);

    const bulanFormatted = `${MONTH_NAMES[Number(monthPad) - 1]}-${year}`;
    let workingDays = 0;
    try {
      const r = await sql`
        SELECT hari_kerja FROM report_admin_mkt.set_param_sum_mcr
        WHERE bulan = ${bulanFormatted} AND target = 'Y' LIMIT 1
      `;
      workingDays = Number(r[0]?.hari_kerja ?? 0);
    } catch {
      workingDays = 0;
    }

    const mr = await sql`SELECT COUNT(*) AS c FROM visit_tidak_kunjungan_mr WHERE id_peg = ${idPeg} AND periode = ${periodeStrUnvisit}`;
    const nonMr = await sql`SELECT COUNT(*) AS c FROM visit_tidak_kunjungan WHERE id_peg = ${idPeg} AND periode = ${periodeStrUnvisit}`;
    const unvisitCount = Number(mr[0].c) + Number(nonMr[0].c);
    const eff = Math.max(0, workingDays - unvisitCount);

    return c.json({
      success: true,
      jabatan: pegawai[0].jabatan,
      divisi: pegawai[0].divisi,
      target_per_day_dokter: dokterPerDay,
      target_per_day_non_dokter: nonDokterPerDay,
      working_days: workingDays,
      unvisit_count: unvisitCount,
      effective_working_days: eff,
      target_dokter: dokterPerDay * eff,
      target_non_dokter: nonDokterPerDay * eff,
      target_total: (dokterPerDay + nonDokterPerDay) * eff,
    });
  } catch (e: any) {
    return c.json({ success: false, message: `Error: ${e?.message ?? ''}` }, 500);
  }
}

// ============================================================================
// Offline
// ============================================================================

export async function offlineCallPlan(c: Context) {
  const body = await c.req.json();
  const idPegArray = parseJsonOrArray(body.id_peg).map((v) => Number(v));
  const monthYear: string | undefined = body.monthYear;
  const dateSearch: string | undefined = body.dateSearch;
  const search: string | undefined = body.search;

  const data = await sql`
    SELECT * FROM call_plan_actual
    WHERE approval = 'Approve' AND tgl_actual IS NULL
      AND ${idPegArray.length > 0 ? sql`id_peg = ANY(${idPegArray})` : sql`id_peg = 0`}
      ${monthYear ? sql`AND to_char(tgl_plan, 'YYYY-MM') = ${monthYear}` : sql``}
      ${dateSearch ? sql`AND tgl_plan = ${dateSearch}::date` : sql``}
      ${search ? sql`AND (nama_dokter ILIKE ${'%' + search + '%'} OR institusi ILIKE ${'%' + search + '%'})` : sql``}
  `;
  return c.json({ data });
}

// ============================================================================
// Unvisit
// ============================================================================

const UNVISIT_DATE_CONFIG = { days_back: 15, days_forward: 30 };

export async function getUnvisitConfig(c: Context) {
  return c.json({ success: true, config: UNVISIT_DATE_CONFIG });
}

export async function getUnvisitAlasan(c: Context) {
  const alasan = [
    { value: 'sakit', label: 'Sakit' },
    { value: 'izin_tidak_masuk', label: 'Izin Tidak Masuk' },
    { value: 'cuti', label: 'Cuti' },
    { value: 'administrasi', label: 'Administrasi' },
    { value: 'event', label: 'Event' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'training', label: 'Training' },
    { value: 'belum_aktif_bekerja', label: 'Belum Aktif Bekerja' },
    { value: 'other', label: 'Other' },
  ];
  return c.json({ success: true, data: alasan });
}

export async function addUnvisit(c: Context) {
  const body = await c.req.json();
  const idPeg = body.id_peg;
  const periode = body.periode;
  const tanggal = body.tanggal;
  const alasan = body.alasan;
  if (!idPeg || !periode || !tanggal || !alasan) {
    return c.json({ success: false, message: 'Field id_peg, periode, tanggal, dan alasan wajib diisi.' }, 422);
  }

  const minDate = new Date(Date.now() - UNVISIT_DATE_CONFIG.days_back * 86400000).toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + UNVISIT_DATE_CONFIG.days_forward * 86400000).toISOString().slice(0, 10);
  if (tanggal < minDate) {
    return c.json({ success: false, message: `Tanggal tidak boleh lebih dari ${UNVISIT_DATE_CONFIG.days_back} hari ke belakang dari hari ini.` }, 422);
  }
  if (tanggal > maxDate) {
    return c.json({ success: false, message: `Tanggal tidak boleh lebih dari ${UNVISIT_DATE_CONFIG.days_forward} hari ke depan dari hari ini.` }, 422);
  }

  const week = `W${isoWeekNumber(new Date(tanggal))}`;
  const jabatan = String(body.jabatan ?? '').toUpperCase().trim();
  const isMrGroup = ['MR', 'PS', 'KAE'].includes(jabatan);
  const table = isMrGroup ? 'visit_tidak_kunjungan_mr' : 'visit_tidak_kunjungan';

  const exists = isMrGroup
    ? await sql`SELECT 1 FROM visit_tidak_kunjungan_mr WHERE id_peg = ${idPeg} AND tanggal = ${tanggal}::date LIMIT 1`
    : await sql`SELECT 1 FROM visit_tidak_kunjungan WHERE id_peg = ${idPeg} AND tanggal = ${tanggal}::date LIMIT 1`;
  if (exists.length > 0) {
    return c.json({ success: false, message: 'Data unvisit untuk tanggal tersebut sudah ada.' }, 409);
  }

  const periodeMy = (() => {
    const d = new Date(periode);
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
  })();

  if (isMrGroup) {
    await sql`
      INSERT INTO visit_tidak_kunjungan_mr (periode, week, id_peg, id_ff, nama, divisi, tanggal, alasan, keterangan)
      VALUES (${periodeMy}, ${week}, ${idPeg}, ${body.id_ff ?? ''}, ${body.nama ?? ''}, ${body.divisi ?? ''}, ${tanggal}::date, ${alasan}, ${body.keterangan ?? ''})
    `;
  } else {
    await sql`
      INSERT INTO visit_tidak_kunjungan (periode, week, id_peg, id_ff, nama, divisi, tanggal, alasan, keterangan)
      VALUES (${periodeMy}, ${week}, ${idPeg}, ${body.id_ff ?? ''}, ${body.nama ?? ''}, ${body.divisi ?? ''}, ${tanggal}::date, ${alasan}, ${body.keterangan ?? ''})
    `;
  }

  return c.json({ success: true, message: 'Data unvisit berhasil disimpan.', table });
}

export async function getUnvisitList(c: Context) {
  const body = await c.req.json();
  const idPegArray = parseJsonOrArray(body.id_peg).map((v) => Number(v));
  if (idPegArray.length === 0) return c.json({ success: false, data: [] });

  const periodeMy = (() => {
    const d = new Date(body.periode);
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
  })();

  const mapSql = sql`
    id,
    (substr(periode, 4, 4) || '-' || substr(periode, 1, 2) || '-01') AS periode,
    week, id_peg, id_ff, nama, divisi, tanggal, alasan, keterangan
  `;

  const mr = await sql`
    SELECT ${mapSql} FROM visit_tidak_kunjungan_mr
    WHERE id_peg = ANY(${idPegArray}) AND periode = ${periodeMy}
  `;
  const nonMr = await sql`
    SELECT ${mapSql} FROM visit_tidak_kunjungan
    WHERE id_peg = ANY(${idPegArray}) AND periode = ${periodeMy}
  `;
  const merged = [...mr, ...nonMr].sort((a: any, b: any) => String(a.tanggal).localeCompare(String(b.tanggal)));

  return c.json({ success: true, data: merged });
}

export async function deleteUnvisit(c: Context) {
  const body = await c.req.json();
  const id = body.id;
  if (!id) return c.json({ success: false, message: 'ID tidak ditemukan.' }, 422);

  const delMr = await sql`DELETE FROM visit_tidak_kunjungan_mr WHERE id = ${id} RETURNING id`;
  let delNonMr: any[] = [];
  if (delMr.length === 0) {
    delNonMr = await sql`DELETE FROM visit_tidak_kunjungan WHERE id = ${id} RETURNING id`;
  }
  if (delMr.length > 0 || delNonMr.length > 0) {
    return c.json({ success: true, message: 'Data unvisit berhasil dihapus.' });
  }
  return c.json({ success: false, message: 'Data tidak ditemukan atau sudah dihapus.' }, 404);
}

// ============================================================================
// Update Call List + History
// ============================================================================

export async function updateCallList(c: Context) {
  const v = checkAppVersion(c);
  if (v) return v;
  const body = await c.req.json();
  if (!body.call_list_id) return c.json({ message: 'call_list_id required' }, 422);
  if (!body.id_mcl) return c.json({ message: 'id_mcl required' }, 422);
  if (!body.periode) return c.json({ message: 'periode required' }, 422);

  const cl = await sql`SELECT * FROM call_list WHERE id = ${body.call_list_id} LIMIT 1`;
  if (cl.length === 0) return c.json({ success: false, message: 'Call list not found.' }, 404);
  const callList = cl[0];

  const approval = callList.approval ?? '-';
  if (approval !== 'Reject') {
    return c.json(
      { success: false, message: `Cannot edit! Only Rejected call list can be edited. Current status: ${approval}` },
      403,
    );
  }

  const pegawai = await sql`SELECT jabatan, divisi FROM data_pegawai WHERE rowid = ${body.id_peg} LIMIT 1`;
  if (pegawai.length > 0) {
    const target = await sql`
      SELECT dokter, non_dokter FROM call_target_list
      WHERE jabatan = ${pegawai[0].jabatan} AND divisi = ${pegawai[0].divisi}
        AND periode_awal <= ${body.periode}::date
        AND (periode_akhir IS NULL OR periode_akhir >= ${body.periode}::date)
      LIMIT 1
    `;
    if (target.length > 0 && body.id_mcl !== callList.id_mcl) {
      const segmen = body.segmen ?? 'Doctor';
      if (segmen === 'Doctor') {
        const cnt = await sql`
          SELECT COUNT(*) AS c FROM call_list
          WHERE id_peg = ${body.id_peg} AND periode = ${body.periode}::date AND segmen = 'Doctor'
            AND id != ${body.call_list_id}
        `;
        if (Number(cnt[0].c) >= Number(target[0].dokter)) {
          return c.json({ success: false, message: 'Target Dokter sudah penuh.' }, 400);
        }
      }
    }
  }

  try {
    await sql`
      UPDATE call_list SET
        id_mcl = ${body.id_mcl}, nama_dokter = ${body.nama_dokter}, spec = ${body.spec},
        segmen = ${body.segmen}, class = ${body.class}, id_peg = ${body.id_peg}, id_ff = ${body.id_ff},
        approval = NULL, approval_by = NULL, approval_date = NULL, approval_comment = NULL,
        updated_by = ${body.id_peg}, updated_at = NOW()
      WHERE id = ${body.call_list_id}
    `;

    await sql`
      INSERT INTO call_list_history (
        call_list_id, id_peg, action_type, action_date,
        old_id_mcl, new_id_mcl, old_nama_dokter, new_nama_dokter,
        old_spec, new_spec, old_class, new_class,
        old_segmen, new_segmen, old_wilayah, new_wilayah,
        old_target_visit, new_target_visit, reason, ip_address
      ) VALUES (
        ${body.call_list_id}, ${body.id_peg}, 'edit', NOW(),
        ${callList.id_mcl}, ${body.id_mcl}, ${callList.nama_dokter}, ${body.nama_dokter},
        ${callList.spec}, ${body.spec}, ${callList.class}, ${body.class},
        ${callList.segmen}, ${body.segmen}, ${callList.wilayah}, ${body.wilayah ?? null},
        ${callList.target_visit}, ${body.target_visit ?? null},
        ${body.reason ?? null}, ${c.req.header('x-forwarded-for') ?? ''}
      )
    `;
    return c.json({ success: true, message: 'Call list updated successfully.', changes: 1 });
  } catch (e: any) {
    console.error('Update Call List Error:', e?.message);
    return c.json({ success: false, message: 'Failed to update call list.' }, 500);
  }
}

export async function getCallListHistory(c: Context) {
  try {
    const body = await c.req.json();
    const callListId = body.call_list_id;

    let history = await sql`
      SELECT * FROM call_list_history
      WHERE call_list_id = ${callListId}
      ORDER BY action_date DESC
    `;
    if (history.length === 0) {
      const cl = await sql`SELECT * FROM call_list WHERE id = ${callListId} LIMIT 1`;
      if (cl.length > 0) {
        const periode = new Date(cl[0].periode);
        const year = periode.getUTCFullYear();
        const month = periode.getUTCMonth() + 1;
        history = await sql`
          SELECT * FROM call_list_history
          WHERE id_peg = ${cl[0].id_peg}
            AND (old_id_mcl = ${cl[0].id_mcl} OR new_id_mcl = ${cl[0].id_mcl})
            AND EXTRACT(YEAR FROM action_date) = ${year}
            AND EXTRACT(MONTH FROM action_date) = ${month}
          ORDER BY action_date DESC
        `;
      }
    }

    const data = history.map((item: any) => ({
      id: item.id,
      action_type: item.action_type,
      action_date: item.action_date,
      old_id_mcl: item.old_id_mcl,
      new_id_mcl: item.new_id_mcl,
      old_nama_dokter: item.old_nama_dokter,
      new_nama_dokter: item.new_nama_dokter,
      old_spec: item.old_spec,
      new_spec: item.new_spec,
      old_class: item.old_class,
      new_class: item.new_class,
      old_segmen: item.old_segmen,
      new_segmen: item.new_segmen,
      old_wilayah: item.old_wilayah,
      new_wilayah: item.new_wilayah,
      old_target_visit: item.old_target_visit,
      new_target_visit: item.new_target_visit,
      reason: item.reason,
    }));

    return c.json({ success: true, data });
  } catch {
    return c.json({ success: false, message: 'Error fetching history.' }, 500);
  }
}

export async function getMyPendingCallListCount(c: Context) {
  const body = await c.req.json();
  const idPegArray = (body.id_peg ?? []).map((v: any) => Number(v));
  const month = Number(body.month);
  const year = Number(body.year);

  if (idPegArray.length === 0 || !month || !year) {
    return c.json({ success: false, message: 'id_peg, month, year required' }, 400);
  }

  const startDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const endDate = lastDayOfMonth(year, month);

  const cnt = await sql`
    SELECT COUNT(*) AS c FROM call_list
    WHERE id_peg = ANY(${idPegArray})
      AND approval IS NULL
      AND periode BETWEEN ${startDate}::date AND ${endDate}::date
  `;

  return c.json({ success: true, data: { my_pending_count: Number(cnt[0].c) } });
}
