import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { request } from '../helpers/app';
import { loginAs } from '../helpers/auth';
import { seedDokterVisit } from '../helpers/seed';

type SuccessBody<T> = { success: true; data: T };
type ErrorBody = { success: false; error: { message: string; code: string; details?: unknown } };

const VERSION_HEADERS = { 'X-App-Version': '1.0.0' } as const;

/**
 * Compute "today WIB" sebagai 'YYYY-MM-DD' supaya tgl_actual happy-path
 * pasti masuk window (jarakHari=0 → boleh approve kapan saja).
 */
function todayWIBIso(): string {
  const wib = new Date(Date.now() + 7 * 3_600_000);
  return wib.toISOString().slice(0, 10);
}

function periodeWIB(): string {
  return todayWIBIso().slice(0, 7);
}

const TODAY = todayWIBIso();
const PERIODE = periodeWIB();

async function deleteAllCallPlanActual() {
  const { db } = await import('../../src/config/database');
  const { call_plan_actual } = await import('../../src/db/schema/transactional');
  await db.delete(call_plan_actual);
}

async function deleteAllCallList() {
  const { db } = await import('../../src/config/database');
  const { call_list, call_list_history } = await import('../../src/db/schema/transactional');
  await db.delete(call_list_history);
  await db.delete(call_list);
}

async function seedPendingActuals(opts?: { withFoto?: boolean }): Promise<string[]> {
  const { db } = await import('../../src/config/database');
  const { call_plan_actual } = await import('../../src/db/schema/transactional');
  const foto = opts?.withFoto !== false ? 'visit_1.jpg' : null;
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
        tgl_actual: TODAY,
        waktu_actual: '09:00:00',
        status: 'plan_visit',
        foto,
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
        tgl_actual: TODAY,
        waktu_actual: '10:00:00',
        status: 'plan_visit',
        foto,
      },
    ])
    .returning({ id: call_plan_actual.id });
  return inserted.map((r) => r.id);
}

beforeAll(async () => {
  await seedDokterVisit();
});

afterAll(async () => {
  await deleteAllCallPlanActual();
  await deleteAllCallList();
});

// =============================================================================
// GET /api/approval/call-actual/pegawai
// =============================================================================
describe('GET /api/approval/call-actual/pegawai', () => {
  beforeAll(async () => {
    await deleteAllCallPlanActual();
    await seedPendingActuals();
  });

  it('200 happy path (DM) — list MR bawahan dengan total_request', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<
      SuccessBody<Array<{ id_peg: number; nama_pegawai: string; total_request: number }>>
    >('GET', `/api/approval/call-actual/pegawai?periode=${PERIODE}`, { token });
    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id_peg).toBe(1);
    expect(body.data[0].total_request).toBe(2);
  });

  it('200 empty kalau periode masa lalu (cutoff filter)', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      '/api/approval/call-actual/pegawai?periode=2020-01',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('401 tanpa token', async () => {
    const { status } = await request(
      'GET',
      `/api/approval/call-actual/pegawai?periode=${PERIODE}`,
    );
    expect(status).toBe(401);
  });

  it('403 kalau jabatan MR', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      `/api/approval/call-actual/pegawai?periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('422 invalid periode format', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      '/api/approval/call-actual/pegawai?periode=abc',
      { token },
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// =============================================================================
// GET /api/approval/call-actual
// =============================================================================
describe('GET /api/approval/call-actual', () => {
  beforeAll(async () => {
    await deleteAllCallPlanActual();
    await seedPendingActuals();
  });

  it('200 details by id_peg', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<
      SuccessBody<Array<{ id: string; tgl_actual: string; foto: string | null }>>
    >('GET', `/api/approval/call-actual?id_peg=1&periode=${PERIODE}`, { token });
    expect(status).toBe(200);
    expect(body.data.length).toBe(2);
    expect(body.data.every((r) => r.tgl_actual === TODAY)).toBe(true);
  });

  it('200 empty kalau target di luar scope', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      `/api/approval/call-actual?id_peg=9999&periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('401 tanpa token', async () => {
    const { status } = await request(
      'GET',
      `/api/approval/call-actual?id_peg=1&periode=${PERIODE}`,
    );
    expect(status).toBe(401);
  });

  it('403 kalau jabatan MR', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      `/api/approval/call-actual?id_peg=1&periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('422 tanpa id_peg', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      `/api/approval/call-actual?periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// =============================================================================
// POST /api/approval/call-actual/batch
// =============================================================================
describe('POST /api/approval/call-actual/batch', () => {
  it('200 batch approve — set approval_actual + cascade is_visited di call_list', async () => {
    await deleteAllCallPlanActual();
    await deleteAllCallList();

    // Seed call_list yang akan di-cascade.
    const { db } = await import('../../src/config/database');
    const { call_list, call_plan_actual } = await import('../../src/db/schema/transactional');
    await db.insert(call_list).values({
      id_mcl: 1,
      periode: `${PERIODE}-01`,
      nama_dokter: 'dr. Andi Praktisi',
      spec: 'Umum',
      segmen: 'Doctor',
      class: 'A',
      id_peg: 1,
      id_ff: 'MR0001',
      approval: 'Approve',
      is_visited: false,
    });

    const ids = await seedPendingActuals();
    const { token } = await loginAs('dm01');
    const { status, body } = await request<
      SuccessBody<{ total: number; approved: number; rejected: number }>
    >('POST', '/api/approval/call-actual/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: ids.map((id) => ({ id, approval_actual: 'Approve' })) },
    });
    expect(status).toBe(200);
    expect(body.data).toEqual({ total: 2, approved: 2, rejected: 0 });

    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({
        approval_actual: call_plan_actual.approval_actual,
        by: call_plan_actual.approval_actual_by,
      })
      .from(call_plan_actual)
      .where(eq(call_plan_actual.id, ids[0]));
    expect(row.approval_actual).toBe('Approve');
    expect(row.by).toBe(2); // dm01

    // Cascade: call_list.is_visited = true untuk id_mcl=1.
    const [clRow] = await db
      .select({ is_visited: call_list.is_visited })
      .from(call_list)
      .where(eq(call_list.id_mcl, 1));
    expect(clRow.is_visited).toBe(true);
  });

  it('200 batch reject dengan comment', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingActuals();
    const { token } = await loginAs('dm01');
    const { body } = await request<SuccessBody<{ rejected: number }>>(
      'POST',
      '/api/approval/call-actual/batch',
      {
        token,
        headers: VERSION_HEADERS,
        body: {
          approvals: [
            { id: ids[0], approval_actual: 'Reject', approval_actual_comment: 'foto blur' },
          ],
        },
      },
    );
    expect(body.data.rejected).toBe(1);

    const { db } = await import('../../src/config/database');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({
        approval_actual: call_plan_actual.approval_actual,
        comment: call_plan_actual.approval_actual_comment,
      })
      .from(call_plan_actual)
      .where(eq(call_plan_actual.id, ids[0]));
    expect(row.approval_actual).toBe('Reject');
    expect(row.comment).toBe('foto blur');
  });

  it('422 APPROVAL_ACTUAL_NO_FOTO kalau Approve tanpa foto', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingActuals({ withFoto: false });
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-actual/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id: ids[0], approval_actual: 'Approve' }] },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('APPROVAL_ACTUAL_NO_FOTO');
  });

  it('Reject tanpa foto tetap diizinkan (no foto guard hanya untuk Approve)', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingActuals({ withFoto: false });
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<{ rejected: number }>>(
      'POST',
      '/api/approval/call-actual/batch',
      {
        token,
        headers: VERSION_HEADERS,
        body: {
          approvals: [{ id: ids[0], approval_actual: 'Reject', approval_actual_comment: 'no' }],
        },
      },
    );
    expect(status).toBe(200);
    expect(body.data.rejected).toBe(1);
  });

  it('422 APPROVAL_ACTUAL_EXPIRED kalau tgl_actual >2 hari lalu', async () => {
    await deleteAllCallPlanActual();
    const { db } = await import('../../src/config/database');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');

    // 10 hari lalu pasti > maxHari (BATAS_HARI_ACTUAL=1, max worst-case Senin = +3 → 4).
    const past = new Date(Date.now() - 10 * 24 * 3_600_000);
    const pastIso = new Date(past.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

    const [{ id }] = await db
      .insert(call_plan_actual)
      .values({
        id_peg: 1,
        id_ff: 'MR0001',
        nama_ff: 'MR Satu',
        divisi: 'ETHICAL',
        id_mcl: 1,
        nama_dokter: 'dr. Old',
        spec: 'Umum',
        segmen_md: 1,
        class: 'A',
        institusi: 'RS Lama',
        alamat_praktek: 'Jl. Lama',
        tgl_actual: pastIso,
        waktu_actual: '09:00:00',
        status: 'plan_visit',
        foto: 'old.jpg',
      })
      .returning({ id: call_plan_actual.id });

    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-actual/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id, approval_actual: 'Approve' }] },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('APPROVAL_ACTUAL_EXPIRED');
  });

  it('426 tanpa X-App-Version', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingActuals();
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-actual/batch', {
      token,
      body: { approvals: [{ id: ids[0], approval_actual: 'Approve' }] },
    });
    expect(status).toBe(426);
    expect(body.error.code).toBe('VERSION_OUTDATED');
  });

  it('401 tanpa token', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingActuals();
    const { status } = await request('POST', '/api/approval/call-actual/batch', {
      headers: VERSION_HEADERS,
      body: { approvals: [{ id: ids[0], approval_actual: 'Approve' }] },
    });
    expect(status).toBe(401);
  });

  it('403 kalau jabatan MR', async () => {
    await deleteAllCallPlanActual();
    const ids = await seedPendingActuals();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-actual/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id: ids[0], approval_actual: 'Approve' }] },
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('403 NOT_APPROVER_FOR_ROW', async () => {
    await deleteAllCallPlanActual();
    const { db } = await import('../../src/config/database');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');
    const [{ id }] = await db
      .insert(call_plan_actual)
      .values({
        id_peg: 3, // RSM01 — di luar scope DM01
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
        tgl_actual: TODAY,
        waktu_actual: '09:00:00',
        status: 'plan_visit',
        foto: 'x.jpg',
      })
      .returning({ id: call_plan_actual.id });

    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-actual/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id, approval_actual: 'Approve' }] },
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe('NOT_APPROVER_FOR_ROW');
  });

  it('422 VALIDATION_ERROR untuk empty approvals', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-actual/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [] },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('silent skip kalau ID tidak ada', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<
      SuccessBody<{ total: number; approved: number; rejected: number }>
    >('POST', '/api/approval/call-actual/batch', {
      token,
      headers: VERSION_HEADERS,
      body: {
        approvals: [{ id: '00000000-0000-0000-0000-000000000000', approval_actual: 'Approve' }],
      },
    });
    expect(status).toBe(200);
    expect(body.data).toEqual({ total: 0, approved: 0, rejected: 0 });
  });
});
