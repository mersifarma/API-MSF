import { beforeAll, describe, expect, it } from 'bun:test';
import { request } from '../helpers/app';
import { loginAs } from '../helpers/auth';
import { seedDokterVisit } from '../helpers/seed';

type SuccessBody<T> = { success: true; data: T };
type ErrorBody = { success: false; error: { message: string; code: string; details?: unknown } };

// Periode di-isolasi dari call-list.test.ts (yang pakai 2026-08 & 2026-10) supaya
// seed call_list dengan unique key (id_mcl, periode, id_ff) tidak collide saat
// dua test file jalan di temp DB yang sama per run.
const PERIODE = '2026-07';
const PERIODE_ISO = '2026-07-01';
const TGL_PLAN = '2026-07-15';
const TGL_PLAN_2 = '2026-07-16';

const VERSION_HEADERS = { 'X-App-Version': '1.0.0' } as const;

/**
 * Seed call_list rows (approval=Approve) supaya dokter muncul di /eligible-doctors.
 * Mirror dari pattern call-list.test.ts.
 */
async function seedApprovedCallList() {
  const { db } = await import('../../src/config/database');
  const { call_list } = await import('../../src/db/schema/transactional');

  await db.insert(call_list).values([
    {
      id_mcl: 1,
      periode: PERIODE_ISO,
      nama_dokter: 'dr. Andi Praktisi',
      spec: 'Umum',
      segmen: 'Doctor',
      class: 'A',
      target_visit: 1,
      id_peg: 1,
      id_ff: 'MR0001',
      approval: 'Approve',
    },
    {
      id_mcl: 2,
      periode: PERIODE_ISO,
      nama_dokter: 'dr. Budi Suhendar, Sp.A',
      spec: 'Anak',
      segmen: 'Doctor',
      class: 'A',
      target_visit: 1,
      id_peg: 1,
      id_ff: 'MR0001',
      approval: 'Approve',
    },
    {
      id_mcl: 3,
      periode: PERIODE_ISO,
      nama_dokter: 'dr. Citra Lestari, Sp.PD',
      spec: 'Penyakit Dalam',
      segmen: 'Non-Doctor',
      class: 'B',
      target_visit: 1,
      id_peg: 1,
      id_ff: 'MR0001',
      approval: null, // pending — TIDAK eligible untuk plan
    },
  ]);
}

async function deleteAllPlansForPeriode(periodePrefix: string) {
  const { db } = await import('../../src/config/database');
  const { call_plan_actual } = await import('../../src/db/schema/transactional');
  const { gte, lte, and } = await import('drizzle-orm');
  await db
    .delete(call_plan_actual)
    .where(
      and(
        gte(call_plan_actual.tgl_plan, `${periodePrefix}-01`),
        lte(call_plan_actual.tgl_plan, `${periodePrefix}-31`),
      ),
    );
}

async function seedPlanRow(idMcl: number, tglPlan: string, opts: { tglActual?: string } = {}) {
  const { db } = await import('../../src/config/database');
  const { call_plan_actual } = await import('../../src/db/schema/transactional');
  const [row] = await db
    .insert(call_plan_actual)
    .values({
      id_peg: 1,
      id_ff: 'MR0001',
      nama_ff: 'MR Satu',
      divisi: 'ETHICAL',
      id_mcl: idMcl,
      nama_dokter: `dr. seed-${idMcl}`,
      spec: 'Umum',
      segmen_md: 1,
      class: 'A',
      institusi: 'Klinik Sehat',
      tgl_plan: tglPlan,
      waktu: '10:00:00',
      tgl_actual: opts.tglActual ?? null,
    })
    .returning({ id: call_plan_actual.id });
  return row.id;
}

beforeAll(async () => {
  await seedDokterVisit();
  await seedApprovedCallList();
});

// =============================================================================
// GET /api/call-plan/eligible-doctors
// =============================================================================
describe('GET /api/call-plan/eligible-doctors', () => {
  it('returns only call_list rows with approval=Approve', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<Array<{ id_mcl: number; nama_dokter: string; segmen: string }>>
    >('GET', `/api/call-plan/eligible-doctors?periode=${PERIODE}`, { token });
    expect(status).toBe(200);
    // Seed: id_mcl 1 & 2 Approve, id_mcl 3 pending → eligible 2 rows
    expect(body.data.length).toBe(2);
    expect(body.data.map((r) => r.id_mcl).sort()).toEqual([1, 2]);
  });

  it('search narrows result by nama_dokter ILIKE', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<Array<{ id_mcl: number }>>>(
      'GET',
      `/api/call-plan/eligible-doctors?periode=${PERIODE}&search=Budi`,
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id_mcl).toBe(2);
  });

  it('returns 401 without token', async () => {
    const { status } = await request('GET', '/api/call-plan/eligible-doctors');
    expect(status).toBe(401);
  });
});

// =============================================================================
// GET /api/call-plan/institutions
// =============================================================================
describe('GET /api/call-plan/institutions', () => {
  it('returns institusi rows untuk id_mcl yang visible', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<
        Array<{
          id_mcl: number;
          institusi: string | null;
          id_ff: string | null;
          nama_ff: string | null;
        }>
      >
    >('GET', '/api/call-plan/institutions?id_mcl=1', { token });
    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id_mcl).toBe(1);
    expect(body.data[0].institusi).toContain('Klinik');
    // MR: id_ff harus = id_ff_mr (tidak di-resolve ke supervisor)
    expect(body.data[0].id_ff).toBe('MR0001');
  });

  it('returns empty untuk id_mcl yang tidak visible ke user', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      '/api/call-plan/institutions?id_mcl=99999',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('returns 422 tanpa id_mcl', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      '/api/call-plan/institutions',
      { token },
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// =============================================================================
// GET /api/call-plan
// =============================================================================
describe('GET /api/call-plan', () => {
  beforeAll(async () => {
    await deleteAllPlansForPeriode(PERIODE);
    await seedPlanRow(1, TGL_PLAN);
    await seedPlanRow(2, TGL_PLAN_2);
  });

  it('returns plans untuk current user filtered by periode', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<Array<{ id_mcl: number; tgl_plan: string }>>
    >('GET', `/api/call-plan?periode=${PERIODE}`, { token });
    expect(status).toBe(200);
    expect(body.data.length).toBe(2);
    expect(body.data.map((r) => r.id_mcl).sort()).toEqual([1, 2]);
  });

  it('date filter narrows ke satu tanggal', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<Array<{ id_mcl: number }>>>(
      'GET',
      `/api/call-plan?date=${TGL_PLAN}`,
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id_mcl).toBe(1);
  });

  it('returns 422 untuk periode invalid', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      '/api/call-plan?periode=08-2026',
      { token },
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without token', async () => {
    const { status } = await request('GET', '/api/call-plan');
    expect(status).toBe(401);
  });
});

// =============================================================================
// POST /api/call-plan
// =============================================================================
describe('POST /api/call-plan', () => {
  beforeAll(async () => {
    await deleteAllPlansForPeriode(PERIODE);
  });

  it('201 happy path — snapshot dokter dari master + return id', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<{ id: string; id_mcl: number; tgl_plan: string; waktu: string }>
    >('POST', '/api/call-plan', {
      token,
      headers: VERSION_HEADERS,
      body: {
        id_mcl: 1,
        tgl_plan: TGL_PLAN,
        waktu: '10:30',
        product_list: [1, 2],
        keterangan: 'visit pagi',
      },
    });
    expect(status).toBe(201);
    expect(body.data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.data.id_mcl).toBe(1);
    expect(body.data.tgl_plan).toBe(TGL_PLAN);
    expect(body.data.waktu).toBe('10:30:00');
  });

  it('409 DUPLICATE_PLAN kalau (id_peg, id_mcl, tgl_plan) sudah ada', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/call-plan', {
      token,
      headers: VERSION_HEADERS,
      body: { id_mcl: 1, tgl_plan: TGL_PLAN, waktu: '11:00' },
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe('DUPLICATE_PLAN');
  });

  it('404 kalau id_mcl tidak ada di master', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/call-plan', {
      token,
      headers: VERSION_HEADERS,
      body: { id_mcl: 99999, tgl_plan: TGL_PLAN_2, waktu: '09:00' },
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('426 VERSION_OUTDATED kalau X-App-Version hilang', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/call-plan', {
      token,
      body: { id_mcl: 2, tgl_plan: TGL_PLAN_2, waktu: '09:00' },
    });
    expect(status).toBe(426);
    expect(body.error.code).toBe('VERSION_OUTDATED');
  });

  it('401 tanpa token', async () => {
    const { status } = await request('POST', '/api/call-plan', {
      headers: VERSION_HEADERS,
      body: { id_mcl: 2, tgl_plan: TGL_PLAN_2, waktu: '09:00' },
    });
    expect(status).toBe(401);
  });

  it('422 VALIDATION_ERROR untuk tgl_plan invalid', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/call-plan', {
      token,
      headers: VERSION_HEADERS,
      body: { id_mcl: 2, tgl_plan: '15-08-2026', waktu: '10:00' },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 VALIDATION_ERROR untuk waktu invalid', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/call-plan', {
      token,
      headers: VERSION_HEADERS,
      body: { id_mcl: 2, tgl_plan: TGL_PLAN_2, waktu: '25:99' },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// =============================================================================
// DELETE /api/call-plan/:id
// =============================================================================
describe('DELETE /api/call-plan/:id', () => {
  it('deletes row yang belum punya tgl_actual', async () => {
    await deleteAllPlansForPeriode(PERIODE);
    const id = await seedPlanRow(1, TGL_PLAN);
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<{ deleted: true }>>(
      'DELETE',
      `/api/call-plan/${id}`,
      { token, headers: VERSION_HEADERS },
    );
    expect(status).toBe(200);
    expect(body.data.deleted).toBe(true);
  });

  it('409 CALL_ACTUAL_EXISTS kalau tgl_actual sudah ada', async () => {
    await deleteAllPlansForPeriode(PERIODE);
    const id = await seedPlanRow(1, TGL_PLAN, { tglActual: TGL_PLAN });
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('DELETE', `/api/call-plan/${id}`, {
      token,
      headers: VERSION_HEADERS,
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe('CALL_ACTUAL_EXISTS');
  });

  it('404 untuk id yang tidak ada', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'DELETE',
      '/api/call-plan/00000000-0000-0000-0000-000000000000',
      { token, headers: VERSION_HEADERS },
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('422 untuk id bukan UUID', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('DELETE', '/api/call-plan/not-a-uuid', {
      token,
      headers: VERSION_HEADERS,
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('426 VERSION_OUTDATED kalau X-App-Version hilang', async () => {
    await deleteAllPlansForPeriode(PERIODE);
    const id = await seedPlanRow(1, TGL_PLAN);
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('DELETE', `/api/call-plan/${id}`, {
      token,
    });
    expect(status).toBe(426);
    expect(body.error.code).toBe('VERSION_OUTDATED');
  });

  it('403 kalau delete milik pegawai lain', async () => {
    await deleteAllPlansForPeriode(PERIODE);
    const id = await seedPlanRow(1, TGL_PLAN);
    const { token } = await loginAs('dm01'); // DM bukan owner row
    const { status, body } = await request<ErrorBody>('DELETE', `/api/call-plan/${id}`, {
      token,
      headers: VERSION_HEADERS,
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
