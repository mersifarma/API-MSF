import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { request } from '../helpers/app';
import { loginAs } from '../helpers/auth';
import { seedDokterVisit } from '../helpers/seed';

type SuccessBody<T> = { success: true; data: T };
type ErrorBody = { success: false; error: { message: string; code: string; details?: unknown } };

const VERSION_HEADERS = { 'X-App-Version': '1.0.0' } as const;

// Pakai periode jauh ke depan supaya tgl_plan selalu di masa depan (deadline-safe).
// Note: kalau real-world clock pernah lewat 2099, please review.
const PERIODE = '2099-12';
const TGL_PLAN_FUTURE_1 = '2099-12-15';
const TGL_PLAN_FUTURE_2 = '2099-12-20';
const PERIODE_PAST = '2020-01';
const TGL_PLAN_PAST = '2020-01-15';

async function deleteAllCallPlanActual() {
  const { db } = await import('../../src/config/database');
  const { call_plan_actual } = await import('../../src/db/schema/transactional');
  await db.delete(call_plan_actual);
}

async function seedPendingPlans(): Promise<string[]> {
  const { db } = await import('../../src/config/database');
  const { call_plan_actual } = await import('../../src/db/schema/transactional');
  const inserted = await db
    .insert(call_plan_actual)
    .values([
      {
        id_peg: 1,
        id_ff: 'MR0001',
        nama_ff: 'MR Satu',
        divisi: 'ETHICAL',
        id_mcl: 1,
        nama_dokter: 'dr. Andi Praktisi',
        spec: 'Umum',
        segmen_md: 1,
        class: 'A',
        institusi: 'RS Sehat',
        alamat_praktek: 'Jl. Sehat 1',
        tgl_plan: TGL_PLAN_FUTURE_1,
        waktu: '09:00:00',
      },
      {
        id_peg: 1,
        id_ff: 'MR0001',
        nama_ff: 'MR Satu',
        divisi: 'ETHICAL',
        id_mcl: 2,
        nama_dokter: 'dr. Budi Suhendar',
        spec: 'Anak',
        segmen_md: 1,
        class: 'A',
        institusi: 'RS Anak',
        alamat_praktek: 'Jl. Anak 1',
        tgl_plan: TGL_PLAN_FUTURE_2,
        waktu: '10:00:00',
      },
    ])
    .returning({ id: call_plan_actual.id });
  return inserted.map((r) => r.id);
}

beforeAll(async () => {
  await seedDokterVisit();
});

// Bersihkan residue agar tidak collide dengan call_plan test file lain.
afterAll(async () => {
  await deleteAllCallPlanActual();
});

// =============================================================================
// GET /api/approval/call-plan/pegawai
// =============================================================================
describe('GET /api/approval/call-plan/pegawai', () => {
  beforeAll(async () => {
    await deleteAllCallPlanActual();
    await seedPendingPlans();
  });

  it('200 happy path (DM) — list MR bawahan dengan total_request', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<
      SuccessBody<Array<{ id_peg: number; nama_pegawai: string; total_request: number }>>
    >('GET', `/api/approval/call-plan/pegawai?periode=${PERIODE}`, { token });
    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id_peg).toBe(1);
    expect(body.data[0].nama_pegawai).toBe('MR Satu');
    expect(body.data[0].total_request).toBe(2);
  });

  it('200 empty kalau periode di masa lalu (tgl_plan expired)', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      `/api/approval/call-plan/pegawai?periode=${PERIODE_PAST}`,
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('200 empty untuk RSM kalau tidak ada DM-pending', async () => {
    const { token } = await loginAs('rsm01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      `/api/approval/call-plan/pegawai?periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(200);
    // Seed hanya punya MR plan, RSM lihat DM-pending → empty.
    expect(body.data).toEqual([]);
  });

  it('401 tanpa token', async () => {
    const { status } = await request(
      'GET',
      `/api/approval/call-plan/pegawai?periode=${PERIODE}`,
    );
    expect(status).toBe(401);
  });

  it('403 kalau jabatan MR', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      `/api/approval/call-plan/pegawai?periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('422 invalid periode format', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      '/api/approval/call-plan/pegawai?periode=12-2099',
      { token },
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('vacancy escalation: DM bisa lihat plan-nya sendiri kalau RSM+MM Vacant/Dummy', async () => {
    const { db } = await import('../../src/config/database');
    const { struktur, data_pegawai } = await import('../../src/db/schema/master');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');

    await db.insert(data_pegawai).values([
      {
        rowid: 20,
        id: 'DM0020',
        nama: 'DM Escalation',
        jabatan: 'DM',
        divisi: 'ETHICAL',
        status: 'ACTIVE',
      },
      {
        rowid: 21,
        id: 'RSM0020',
        nama: 'RSM Vacant',
        jabatan: 'RSM',
        divisi: 'ETHICAL',
        status: 'Vacant',
      },
      {
        rowid: 22,
        id: 'MM0020',
        nama: 'MM Dummy',
        jabatan: 'MM',
        divisi: 'ETHICAL',
        status: 'Dummy',
      },
    ]);
    await db.insert(struktur).values({
      id: 200,
      id_mr: 'MR0200',
      id_peg_mr: null,
      rayon_mr: 'Rayon-Z',
      golongan: 'DM',
      divisi: 'ETHICAL',
      id_dm: 'DM0020',
      id_peg_dm: 20,
      rayon_dm: 'Distrik-Z',
      id_rsm: 'RSM0020',
      id_peg_rsm: 21,
      region: 'Region-Z',
      id_mm: 'MM0020',
      id_peg_mm: 22,
      periode_awal: '2026-01-01',
      periode_akhir: '2099-12-31',
    });
    await db.insert(call_plan_actual).values({
      id_peg: 20,
      id_ff: 'DM0020',
      nama_ff: 'DM Escalation',
      divisi: 'ETHICAL',
      id_mcl: 4,
      nama_dokter: 'dr. Escalation Test',
      spec: 'Umum',
      segmen_md: 1,
      class: 'A',
      institusi: 'RS Test',
      alamat_praktek: 'Jl. Test 1',
      tgl_plan: TGL_PLAN_FUTURE_1,
      waktu: '11:00:00',
    });

    const { listPegawaiPendingPlan } = await import(
      '../../src/services/approval-call-plan.service'
    );
    const rows = await listPegawaiPendingPlan({
      approverIdPeg: 20,
      approverJabatan: 'DM',
      periode: PERIODE,
    });
    expect(rows.some((r) => r.id_peg === 20)).toBe(true);

    await db.delete(call_plan_actual).where(eq(call_plan_actual.id_peg, 20));
    await db.delete(struktur).where(eq(struktur.id, 200));
    await db.delete(data_pegawai).where(eq(data_pegawai.rowid, 20));
    await db.delete(data_pegawai).where(eq(data_pegawai.rowid, 21));
    await db.delete(data_pegawai).where(eq(data_pegawai.rowid, 22));
  });
});

// =============================================================================
// GET /api/approval/call-plan
// =============================================================================
describe('GET /api/approval/call-plan', () => {
  beforeAll(async () => {
    await deleteAllCallPlanActual();
    await seedPendingPlans();
  });

  it('200 details by id_peg', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<
      SuccessBody<Array<{ id: string; nama_dokter: string; tgl_plan: string }>>
    >('GET', `/api/approval/call-plan?id_peg=1&periode=${PERIODE}`, { token });
    expect(status).toBe(200);
    expect(body.data.length).toBe(2);
    // Sorted by tgl_plan asc, lalu waktu
    expect(body.data[0].tgl_plan).toBe(TGL_PLAN_FUTURE_1);
    expect(body.data[1].tgl_plan).toBe(TGL_PLAN_FUTURE_2);
  });

  it('200 empty kalau target id_peg di luar scope', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      `/api/approval/call-plan?id_peg=9999&periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('200 empty kalau periode masa lalu (tgl_plan expired)', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      `/api/approval/call-plan?id_peg=1&periode=${PERIODE_PAST}`,
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('401 tanpa token', async () => {
    const { status } = await request(
      'GET',
      `/api/approval/call-plan?id_peg=1&periode=${PERIODE}`,
    );
    expect(status).toBe(401);
  });

  it('403 kalau jabatan MR', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      `/api/approval/call-plan?id_peg=1&periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('422 tanpa id_peg', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      `/api/approval/call-plan?periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// =============================================================================
// POST /api/approval/call-plan/batch
// =============================================================================
describe('POST /api/approval/call-plan/batch', () => {
  it('200 batch approve happy path', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingPlans();
    const { token } = await loginAs('dm01');
    const { status, body } = await request<
      SuccessBody<{ total: number; approved: number; rejected: number }>
    >('POST', '/api/approval/call-plan/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: ids.map((id) => ({ id, approval: 'Approve' })) },
    });
    expect(status).toBe(200);
    expect(body.data).toEqual({ total: 2, approved: 2, rejected: 0 });

    const { db } = await import('../../src/config/database');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({
        approval: call_plan_actual.approval,
        approval_by: call_plan_actual.approval_by,
        approval_actual: call_plan_actual.approval_actual,
      })
      .from(call_plan_actual)
      .where(eq(call_plan_actual.id, ids[0]));
    expect(row.approval).toBe('Approve');
    expect(row.approval_by).toBe(2); // dm01
    // Approve TIDAK cascade ke approval_actual
    expect(row.approval_actual).toBeNull();
  });

  it('200 batch reject — cascade approval_actual = Reject', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingPlans();
    const { token } = await loginAs('dm01');
    const { body } = await request<SuccessBody<{ rejected: number }>>(
      'POST',
      '/api/approval/call-plan/batch',
      {
        token,
        headers: VERSION_HEADERS,
        body: {
          approvals: [{ id: ids[0], approval: 'Reject', approval_comment: 'tolak ya' }],
        },
      },
    );
    expect(body.data.rejected).toBe(1);

    const { db } = await import('../../src/config/database');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({
        approval: call_plan_actual.approval,
        approval_comment: call_plan_actual.approval_comment,
        approval_actual: call_plan_actual.approval_actual,
        approval_actual_by: call_plan_actual.approval_actual_by,
        approval_actual_date: call_plan_actual.approval_actual_date,
      })
      .from(call_plan_actual)
      .where(eq(call_plan_actual.id, ids[0]));
    expect(row.approval).toBe('Reject');
    expect(row.approval_comment).toBe('tolak ya');
    // Cascade: legacy lines 783-787
    expect(row.approval_actual).toBe('Reject');
    expect(row.approval_actual_by).toBe(2);
    expect(row.approval_actual_date).not.toBeNull();
  });

  it('200 mixed batch (1 approve + 1 reject)', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingPlans();
    const { token } = await loginAs('dm01');
    const { body } = await request<SuccessBody<{ approved: number; rejected: number }>>(
      'POST',
      '/api/approval/call-plan/batch',
      {
        token,
        headers: VERSION_HEADERS,
        body: {
          approvals: [
            { id: ids[0], approval: 'Approve' },
            { id: ids[1], approval: 'Reject', approval_comment: 'nope' },
          ],
        },
      },
    );
    expect(body.data.approved).toBe(1);
    expect(body.data.rejected).toBe(1);
  });

  it('comment auto-null saat Approve', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingPlans();
    const { token } = await loginAs('dm01');
    await request('POST', '/api/approval/call-plan/batch', {
      token,
      headers: VERSION_HEADERS,
      body: {
        approvals: [{ id: ids[0], approval: 'Approve', approval_comment: 'should-be-dropped' }],
      },
    });

    const { db } = await import('../../src/config/database');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({ comment: call_plan_actual.approval_comment })
      .from(call_plan_actual)
      .where(eq(call_plan_actual.id, ids[0]));
    expect(row.comment).toBeNull();
  });

  it('422 APPROVAL_PLAN_EXPIRED kalau tgl_plan di masa lalu', async () => {
    await deleteAllCallPlanActual();
    const { db } = await import('../../src/config/database');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');
    const [{ id }] = await db
      .insert(call_plan_actual)
      .values({
        id_peg: 1,
        id_ff: 'MR0001',
        nama_ff: 'MR Satu',
        divisi: 'ETHICAL',
        id_mcl: 1,
        nama_dokter: 'dr. Past',
        spec: 'Umum',
        segmen_md: 1,
        class: 'A',
        institusi: 'RS Lama',
        alamat_praktek: 'Jl. Lama',
        tgl_plan: TGL_PLAN_PAST,
        waktu: '09:00:00',
      })
      .returning({ id: call_plan_actual.id });

    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-plan/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id, approval: 'Approve' }] },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('APPROVAL_PLAN_EXPIRED');
  });

  it('426 tanpa X-App-Version', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingPlans();
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-plan/batch', {
      token,
      body: { approvals: [{ id: ids[0], approval: 'Approve' }] },
    });
    expect(status).toBe(426);
    expect(body.error.code).toBe('VERSION_OUTDATED');
  });

  it('401 tanpa token', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingPlans();
    const { status } = await request('POST', '/api/approval/call-plan/batch', {
      headers: VERSION_HEADERS,
      body: { approvals: [{ id: ids[0], approval: 'Approve' }] },
    });
    expect(status).toBe(401);
  });

  it('403 kalau jabatan MR', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingPlans();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-plan/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id: ids[0], approval: 'Approve' }] },
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('403 NOT_APPROVER_FOR_ROW kalau row.id_peg di luar scope', async () => {
    await deleteAllCallPlanActual();
    const { db } = await import('../../src/config/database');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');
    // Insert plan dengan id_peg=3 (RSM01) — di luar scope DM01.
    const [{ id }] = await db
      .insert(call_plan_actual)
      .values({
        id_peg: 3,
        id_ff: 'RSM0001',
        nama_ff: 'RSM Satu',
        divisi: 'ETHICAL',
        id_mcl: 1,
        nama_dokter: 'dr. RSM Owner',
        spec: 'Umum',
        segmen_md: 1,
        class: 'A',
        institusi: 'RS X',
        alamat_praktek: 'Jl. X',
        tgl_plan: TGL_PLAN_FUTURE_1,
        waktu: '09:00:00',
      })
      .returning({ id: call_plan_actual.id });

    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-plan/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id, approval: 'Approve' }] },
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe('NOT_APPROVER_FOR_ROW');
  });

  it('422 VALIDATION_ERROR untuk empty approvals array', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-plan/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [] },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 VALIDATION_ERROR untuk approval enum salah', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingPlans();
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-plan/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id: ids[0], approval: 'maybe' }] },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 mixed periode batch', async () => {
    await deleteAllCallPlanActual();
    const { db } = await import('../../src/config/database');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');
    const inserted = await db
      .insert(call_plan_actual)
      .values([
        {
          id_peg: 1,
          id_ff: 'MR0001',
          nama_ff: 'MR Satu',
          divisi: 'ETHICAL',
          id_mcl: 1,
          nama_dokter: 'dr. Bulan A',
          spec: 'Umum',
          segmen_md: 1,
          class: 'A',
          institusi: 'RS A',
          alamat_praktek: 'Jl. A',
          tgl_plan: '2099-12-15',
          waktu: '09:00:00',
        },
        {
          id_peg: 1,
          id_ff: 'MR0001',
          nama_ff: 'MR Satu',
          divisi: 'ETHICAL',
          id_mcl: 2,
          nama_dokter: 'dr. Bulan B',
          spec: 'Anak',
          segmen_md: 1,
          class: 'A',
          institusi: 'RS B',
          alamat_praktek: 'Jl. B',
          tgl_plan: '2099-11-15',
          waktu: '10:00:00',
        },
      ])
      .returning({ id: call_plan_actual.id });

    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-plan/batch', {
      token,
      headers: VERSION_HEADERS,
      body: {
        approvals: inserted.map((r) => ({ id: r.id, approval: 'Approve' as const })),
      },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('multiple periode');
  });

  it('silent skip kalau ID tidak ada di DB — return summary 0', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<
      SuccessBody<{ total: number; approved: number; rejected: number }>
    >('POST', '/api/approval/call-plan/batch', {
      token,
      headers: VERSION_HEADERS,
      body: {
        approvals: [{ id: '00000000-0000-0000-0000-000000000000', approval: 'Approve' }],
      },
    });
    expect(status).toBe(200);
    expect(body.data).toEqual({ total: 0, approved: 0, rejected: 0 });
  });
});
