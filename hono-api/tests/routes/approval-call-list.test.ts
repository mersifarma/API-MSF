import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { request } from '../helpers/app';
import { loginAs } from '../helpers/auth';
import { seedDokterVisit } from '../helpers/seed';

type SuccessBody<T> = { success: true; data: T };
type ErrorBody = { success: false; error: { message: string; code: string; details?: unknown } };

const VERSION_HEADERS = { 'X-App-Version': '1.0.0' } as const;

// Periode di-isolasi dari test file lain supaya unique key (id_mcl, periode, id_ff)
// tidak bentrok saat semua test file jalan di temp DB yang sama per run.
const PERIODE = '2026-06';
const PERIODE_ISO = '2026-06-01';

async function deleteAllCallList() {
  const { db } = await import('../../src/config/database');
  const { call_list, call_list_history } = await import(
    '../../src/db/schema/transactional'
  );
  await db.delete(call_list_history);
  await db.delete(call_list);
}

async function seedPendingCallList(): Promise<string[]> {
  const { db } = await import('../../src/config/database');
  const { call_list } = await import('../../src/db/schema/transactional');
  const inserted = await db
    .insert(call_list)
    .values([
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
        approval: null,
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
        approval: null,
      },
    ])
    .returning({ id: call_list.id });
  return inserted.map((r) => r.id);
}

beforeAll(async () => {
  await seedDokterVisit();
});

// Bersihkan call_list residue agar tidak collide dengan unique idx
// (id_mcl, periode, id_ff) di test file lain (call-list / call-plan) yang share DB.
afterAll(async () => {
  await deleteAllCallList();
});

// =============================================================================
// GET /api/approval/call-list/pegawai
// =============================================================================
describe('GET /api/approval/call-list/pegawai', () => {
  beforeAll(async () => {
    await deleteAllCallList();
    await seedPendingCallList();
  });

  it('200 happy path (DM) — list 1 pegawai bawahan dengan total_request', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<Array<{ id_peg: number; nama_pegawai: string; total_request: number }>>>(
      'GET',
      `/api/approval/call-list/pegawai?periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id_peg).toBe(1);
    expect(body.data[0].nama_pegawai).toBe('MR Satu');
    expect(body.data[0].total_request).toBe(2);
  });

  it('200 empty kalau periode di masa lalu (deadline lewat)', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      '/api/approval/call-list/pegawai?periode=2024-01',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('200 happy path (RSM) — bisa lihat call_list DM bawahan (none kalau no DM pending)', async () => {
    const { token } = await loginAs('rsm01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      `/api/approval/call-list/pegawai?periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(200);
    // Tidak ada call_list dengan id_peg=2 (DM), jadi RSM tidak lihat pegawai.
    expect(body.data).toEqual([]);
  });

  it('401 tanpa token', async () => {
    const { status } = await request(
      'GET',
      `/api/approval/call-list/pegawai?periode=${PERIODE}`,
    );
    expect(status).toBe(401);
  });

  it('403 kalau jabatan MR', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      `/api/approval/call-list/pegawai?periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('422 invalid periode format', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      '/api/approval/call-list/pegawai?periode=06-2026',
      { token },
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('vacancy escalation: DM bisa approve diri sendiri kalau RSM+MM Vacant/Dummy', async () => {
    const { db } = await import('../../src/config/database');
    const { struktur, data_pegawai } = await import('../../src/db/schema/master');
    const { call_list } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');

    // Setup: insert DM02 (id_peg=10), RSM Vacant (id_peg=11), MM Dummy (id_peg=12)
    // dan struktur baru dengan DM02 di id_peg_dm + RSM-Vacant + MM-Dummy.
    await db
      .insert(data_pegawai)
      .values([
        { rowid: 10, id: 'DM0002', nama: 'DM Dua', jabatan: 'DM', divisi: 'ETHICAL', status: 'ACTIVE' },
        { rowid: 11, id: 'RSM0002', nama: 'RSM Vacant', jabatan: 'RSM', divisi: 'ETHICAL', status: 'Vacant' },
        { rowid: 12, id: 'MM0001', nama: 'MM Dummy', jabatan: 'MM', divisi: 'ETHICAL', status: 'Dummy' },
      ]);
    await db.insert(struktur).values({
      id: 99,
      id_mr: 'MR0099',
      id_peg_mr: null,
      rayon_mr: 'Rayon-X',
      golongan: 'DM',
      divisi: 'ETHICAL',
      id_dm: 'DM0002',
      id_peg_dm: 10,
      rayon_dm: 'Distrik-X',
      id_rsm: 'RSM0002',
      id_peg_rsm: 11,
      region: 'Region-2',
      id_mm: 'MM0001',
      id_peg_mm: 12,
      periode_awal: '2026-01-01',
      periode_akhir: '2026-12-31',
    });
    // Pending call_list milik DM02 sendiri.
    await db.insert(call_list).values({
      id_mcl: 4,
      periode: PERIODE_ISO,
      nama_dokter: 'dr. Test Escalation',
      spec: 'Umum',
      segmen: 'Doctor',
      class: 'A',
      id_peg: 10,
      id_ff: 'DM0002',
      approval: null,
    });

    // Buat user untuk DM02 supaya bisa login (skip login, panggil service langsung).
    const { listPegawaiPending } = await import('../../src/services/approval-call-list.service');
    const rows = await listPegawaiPending({
      approverIdPeg: 10,
      approverJabatan: 'DM',
      periode: PERIODE,
    });
    expect(rows.some((r) => r.id_peg === 10)).toBe(true);

    // Cleanup tambahan supaya tidak interfere test lain.
    await db.delete(call_list).where(eq(call_list.id_peg, 10));
    await db.delete(struktur).where(eq(struktur.id, 99));
    await db.delete(data_pegawai).where(eq(data_pegawai.rowid, 10));
    await db.delete(data_pegawai).where(eq(data_pegawai.rowid, 11));
    await db.delete(data_pegawai).where(eq(data_pegawai.rowid, 12));
  });
});

// =============================================================================
// GET /api/approval/call-list
// =============================================================================
describe('GET /api/approval/call-list', () => {
  beforeAll(async () => {
    await deleteAllCallList();
    await seedPendingCallList();
  });

  it('200 details by id_peg', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<Array<{ id: string; nama_dokter: string }>>>(
      'GET',
      `/api/approval/call-list?id_peg=1&periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(2);
    expect(body.data.every((r) => typeof r.id === 'string')).toBe(true);
  });

  it('200 empty kalau target id_peg di luar scope', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      `/api/approval/call-list?id_peg=9999&periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('200 empty kalau deadline lewat', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      '/api/approval/call-list?id_peg=1&periode=2024-01',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('401 tanpa token', async () => {
    const { status } = await request(
      'GET',
      `/api/approval/call-list?id_peg=1&periode=${PERIODE}`,
    );
    expect(status).toBe(401);
  });

  it('403 kalau jabatan MR', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      `/api/approval/call-list?id_peg=1&periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('422 tanpa id_peg', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      `/api/approval/call-list?periode=${PERIODE}`,
      { token },
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// =============================================================================
// POST /api/approval/call-list/batch
// =============================================================================
describe('POST /api/approval/call-list/batch', () => {
  it('200 batch approve happy path + audit history inserted', async () => {
    await deleteAllCallList();
    const ids = await seedPendingCallList();
    const { token } = await loginAs('dm01');
    const { status, body } = await request<
      SuccessBody<{ total: number; approved: number; rejected: number }>
    >('POST', '/api/approval/call-list/batch', {
      token,
      headers: VERSION_HEADERS,
      body: {
        approvals: ids.map((id) => ({ id, approval: 'Approve' })),
      },
    });
    expect(status).toBe(200);
    expect(body.data).toEqual({ total: 2, approved: 2, rejected: 0 });

    // Assert DB state.
    const { db } = await import('../../src/config/database');
    const { call_list, call_list_history } = await import(
      '../../src/db/schema/transactional'
    );
    const { eq } = await import('drizzle-orm');

    const approved = await db
      .select({ approval: call_list.approval, by: call_list.approval_by })
      .from(call_list)
      .where(eq(call_list.id, ids[0]));
    expect(approved[0].approval).toBe('Approve');
    expect(approved[0].by).toBe(2); // dm01 id_peg

    const hist = await db
      .select()
      .from(call_list_history)
      .where(eq(call_list_history.call_list_id, ids[0]));
    expect(hist.length).toBe(1);
    expect(hist[0].action_type).toBe('approve');
    expect(hist[0].id_peg).toBe(2);
  });

  it('200 batch reject dengan comment — comment tersimpan, history reason', async () => {
    await deleteAllCallList();
    const ids = await seedPendingCallList();
    const { token } = await loginAs('dm01');
    const { body } = await request<SuccessBody<{ rejected: number }>>(
      'POST',
      '/api/approval/call-list/batch',
      {
        token,
        headers: VERSION_HEADERS,
        body: {
          approvals: [{ id: ids[0], approval: 'Reject', approval_comment: 'butuh revisi' }],
        },
      },
    );
    expect(body.data.rejected).toBe(1);

    const { db } = await import('../../src/config/database');
    const { call_list, call_list_history } = await import(
      '../../src/db/schema/transactional'
    );
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({ approval: call_list.approval, comment: call_list.approval_comment })
      .from(call_list)
      .where(eq(call_list.id, ids[0]));
    expect(row.approval).toBe('Reject');
    expect(row.comment).toBe('butuh revisi');

    const [hist] = await db
      .select()
      .from(call_list_history)
      .where(eq(call_list_history.call_list_id, ids[0]));
    expect(hist.action_type).toBe('reject');
    expect(hist.reason).toBe('butuh revisi');
  });

  it('200 mixed batch (1 approve + 1 reject)', async () => {
    await deleteAllCallList();
    const ids = await seedPendingCallList();
    const { token } = await loginAs('dm01');
    const { body } = await request<SuccessBody<{ approved: number; rejected: number }>>(
      'POST',
      '/api/approval/call-list/batch',
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

  it('comment auto-null saat Approve (meskipun dikirim)', async () => {
    await deleteAllCallList();
    const ids = await seedPendingCallList();
    const { token } = await loginAs('dm01');
    await request('POST', '/api/approval/call-list/batch', {
      token,
      headers: VERSION_HEADERS,
      body: {
        approvals: [{ id: ids[0], approval: 'Approve', approval_comment: 'should-be-dropped' }],
      },
    });

    const { db } = await import('../../src/config/database');
    const { call_list } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({ comment: call_list.approval_comment })
      .from(call_list)
      .where(eq(call_list.id, ids[0]));
    expect(row.comment).toBeNull();
  });

  it('422 APPROVAL_LIST_EXPIRED kalau periode masa lalu', async () => {
    await deleteAllCallList();
    // Insert call_list dengan periode masa lalu untuk test deadline.
    const { db } = await import('../../src/config/database');
    const { call_list } = await import('../../src/db/schema/transactional');
    const [{ id }] = await db
      .insert(call_list)
      .values({
        id_mcl: 1,
        periode: '2024-01-01',
        nama_dokter: 'dr. Past',
        spec: 'Umum',
        segmen: 'Doctor',
        class: 'A',
        id_peg: 1,
        id_ff: 'MR0001',
        approval: null,
      })
      .returning({ id: call_list.id });

    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-list/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id, approval: 'Approve' }] },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('APPROVAL_LIST_EXPIRED');
  });

  it('426 tanpa X-App-Version', async () => {
    await deleteAllCallList();
    const ids = await seedPendingCallList();
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-list/batch', {
      token,
      body: { approvals: [{ id: ids[0], approval: 'Approve' }] },
    });
    expect(status).toBe(426);
    expect(body.error.code).toBe('VERSION_OUTDATED');
  });

  it('401 tanpa token', async () => {
    await deleteAllCallList();
    const ids = await seedPendingCallList();
    const { status } = await request('POST', '/api/approval/call-list/batch', {
      headers: VERSION_HEADERS,
      body: { approvals: [{ id: ids[0], approval: 'Approve' }] },
    });
    expect(status).toBe(401);
  });

  it('403 kalau jabatan MR', async () => {
    await deleteAllCallList();
    const ids = await seedPendingCallList();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-list/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id: ids[0], approval: 'Approve' }] },
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('403 NOT_APPROVER_FOR_ROW kalau row.id_peg di luar scope', async () => {
    await deleteAllCallList();
    // Insert call_list dengan id_peg=3 (RSM01) — di luar scope DM01.
    const { db } = await import('../../src/config/database');
    const { call_list } = await import('../../src/db/schema/transactional');
    const [{ id }] = await db
      .insert(call_list)
      .values({
        id_mcl: 1,
        periode: PERIODE_ISO,
        nama_dokter: 'dr. RSM Owner',
        spec: 'Umum',
        segmen: 'Doctor',
        class: 'A',
        id_peg: 3,
        id_ff: 'RSM0001',
        approval: null,
      })
      .returning({ id: call_list.id });

    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-list/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id, approval: 'Approve' }] },
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe('NOT_APPROVER_FOR_ROW');
  });

  it('422 VALIDATION_ERROR untuk empty approvals array', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-list/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [] },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 VALIDATION_ERROR untuk approval enum salah', async () => {
    await deleteAllCallList();
    const ids = await seedPendingCallList();
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-list/batch', {
      token,
      headers: VERSION_HEADERS,
      body: { approvals: [{ id: ids[0], approval: 'maybe' }] },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 MIXED_PERIODES kalau batch berisi multiple periode', async () => {
    await deleteAllCallList();
    const { db } = await import('../../src/config/database');
    const { call_list } = await import('../../src/db/schema/transactional');
    // Periode masa depan supaya tidak kena deadline check dulu.
    const inserted = await db
      .insert(call_list)
      .values([
        {
          id_mcl: 1,
          periode: '2026-06-01',
          nama_dokter: 'dr. Periode Juni',
          spec: 'Umum',
          segmen: 'Doctor',
          class: 'A',
          id_peg: 1,
          id_ff: 'MR0001',
          approval: null,
        },
        {
          id_mcl: 1,
          periode: '2026-07-01',
          nama_dokter: 'dr. Periode Juli',
          spec: 'Umum',
          segmen: 'Doctor',
          class: 'A',
          id_peg: 1,
          id_ff: 'MR0001',
          approval: null,
        },
      ])
      .returning({ id: call_list.id });

    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('POST', '/api/approval/call-list/batch', {
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
    >('POST', '/api/approval/call-list/batch', {
      token,
      headers: VERSION_HEADERS,
      body: {
        approvals: [
          { id: '00000000-0000-0000-0000-000000000000', approval: 'Approve' },
        ],
      },
    });
    expect(status).toBe(200);
    expect(body.data).toEqual({ total: 0, approved: 0, rejected: 0 });
  });
});
