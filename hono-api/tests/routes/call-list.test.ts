import { beforeAll, describe, expect, it } from 'bun:test';
import { request } from '../helpers/app';
import { loginAs } from '../helpers/auth';
import { seedCallTargets, seedDokterVisit } from '../helpers/seed';

type SuccessBody<T> = { success: true; data: T };
type ErrorBody = { success: false; error: { message: string; code: string; details?: unknown } };

// Periode masa depan supaya deadline belum lewat (untuk test write nanti),
// dan supaya seed call_list yang sengaja kita masukan tidak collide dengan periode sekarang.
const PERIODE = '2026-08';
const PERIODE_ISO = '2026-08-01';

async function seedCallListRows() {
  const { db } = await import('../../src/config/database');
  const { call_list } = await import('../../src/db/schema/transactional');

  await db.insert(call_list).values([
    {
      id_mcl: 1, // FK ke list_dokter_visit_new.ID (bukan ID_MCL meskipun namanya id_mcl)
      periode: PERIODE_ISO,
      nama_dokter: 'dr. Andi Praktisi',
      spec: 'Umum',
      segmen: 'Doctor',
      class: 'A',
      target_visit: 1,
      wilayah: 'Dalam Kota',
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
      approval: null, // pending
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
      approval: null, // pending
    },
  ]);
}

beforeAll(async () => {
  await seedDokterVisit();
  await seedCallTargets();
  await seedCallListRows();
});

describe('GET /api/call-list', () => {
  it('returns rows for current user at the given periode', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<Array<{ id_mcl: number; nama_dokter: string; segmen: string }>>
    >('GET', `/api/call-list?periode=${PERIODE}`, { token });
    expect(status).toBe(200);
    expect(body.data.length).toBe(3);
    expect(body.data.map((r) => r.id_mcl).sort()).toEqual([1, 2, 3]);
  });

  it('returns 422 for invalid periode format', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('GET', '/api/call-list?periode=08-2026', {
      token,
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without token', async () => {
    const { status } = await request('GET', `/api/call-list?periode=${PERIODE}`);
    expect(status).toBe(401);
  });

  it('returns empty array for periode tanpa data', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      '/api/call-list?periode=2026-09',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });
});

describe('GET /api/call-list/eligible', () => {
  it('returns dokter yang BELUM ada di call_list periode itu', async () => {
    // Total dokter MR = 5 (id 1..5). Yang sudah di-list di PERIODE: 1, 2, 3.
    // Eligible = 4 dan 5.
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<Array<{ id: number; nama_dokter: string }>>
    >('GET', `/api/call-list/eligible?periode=${PERIODE}`, { token });
    expect(status).toBe(200);
    expect(body.data.length).toBe(2);
    expect(body.data.map((r) => r.id).sort()).toEqual([4, 5]);
  });

  it('search filter narrows the eligible list', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<Array<{ nama_dokter: string }>>>(
      'GET',
      `/api/call-list/eligible?periode=${PERIODE}&search=Eko`,
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].nama_dokter).toContain('Eko');
  });

  it('returns full master for periode kosong (semua dokter eligible)', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      '/api/call-list/eligible?periode=2026-09',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(5);
  });
});

describe('GET /api/call-list/count', () => {
  it('returns count + target untuk periode itu', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<{
        count_dokter: number;
        count_non_dokter: number;
        target_dokter: number;
        target_non_dokter: number;
        sisa_dokter: number;
        sisa_non_dokter: number;
      }>
    >('GET', `/api/call-list/count?periode=${PERIODE}`, { token });
    expect(status).toBe(200);
    // Seed: 2 baris Doctor + 1 baris Non-Doctor (segmen)
    expect(body.data.count_dokter).toBe(2);
    expect(body.data.count_non_dokter).toBe(1);
    // Target MR ETHICAL: dokter=50, non_dokter=10
    expect(body.data.target_dokter).toBe(50);
    expect(body.data.target_non_dokter).toBe(10);
    expect(body.data.sisa_dokter).toBe(48);
    expect(body.data.sisa_non_dokter).toBe(9);
  });
});

describe('GET /api/call-list/target', () => {
  it('returns target untuk user yang sedang login', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<{ target_dokter: number; target_non_dokter: number; jabatan: string }>
    >('GET', '/api/call-list/target', { token });
    expect(status).toBe(200);
    expect(body.data.jabatan).toBe('MR');
    expect(body.data.target_dokter).toBe(50);
    expect(body.data.target_non_dokter).toBe(10);
  });
});

describe('GET /api/call-list/pending-count', () => {
  it('counts only rows with approval IS NULL', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<{ pending: number }>>(
      'GET',
      '/api/call-list/pending-count',
      { token },
    );
    expect(status).toBe(200);
    // Seed: 3 rows total, 1 Approve, 2 pending
    expect(body.data.pending).toBe(2);
  });
});

describe('GET /api/call-list/:id/history', () => {
  it('returns 404 for unknown id', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      '/api/call-list/00000000-0000-0000-0000-000000000000/history',
      { token },
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 422 for invalid UUID', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      '/api/call-list/not-a-uuid/history',
      { token },
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns empty history for existing row tanpa history', async () => {
    const { db } = await import('../../src/config/database');
    const { call_list } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');
    const [row] = await db.select({ id: call_list.id }).from(call_list).where(eq(call_list.id_mcl, 1));
    expect(row).toBeTruthy();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      `/api/call-list/${row.id}/history`,
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });
});

// =============================================================================
// WRITE endpoints — POST / PATCH / DELETE
// =============================================================================

// Periode masa depan dipakai untuk happy-path write (deadline belum lewat).
const PERIODE_FUTURE = '2026-10';
const PERIODE_FUTURE_ISO = '2026-10-01';
// Periode lampau untuk test deadline lewat.
const PERIODE_PAST = '2026-01';

const VERSION_HEADERS = { 'X-App-Version': '1.0.0' } as const;

async function deleteAllCallListForPeriode(periodeIso: string) {
  const { db } = await import('../../src/config/database');
  const { call_list, call_list_history } = await import('../../src/db/schema/transactional');
  const { eq } = await import('drizzle-orm');
  await db.delete(call_list_history);
  await db.delete(call_list).where(eq(call_list.periode, periodeIso));
}

async function setApprovalReject(callListId: string) {
  const { db } = await import('../../src/config/database');
  const { call_list } = await import('../../src/db/schema/transactional');
  const { eq } = await import('drizzle-orm');
  await db
    .update(call_list)
    .set({ approval: 'Reject', approval_by: 2, approval_comment: 'butuh revisi' })
    .where(eq(call_list.id, callListId));
}

async function seedPlanFor(idMcl: number, idPeg: number, tglPlanIso: string) {
  const { db } = await import('../../src/config/database');
  const { call_plan_actual } = await import('../../src/db/schema/transactional');
  await db.insert(call_plan_actual).values({
    id_peg: idPeg,
    id_ff: 'MR0001',
    nama_ff: 'MR Satu',
    divisi: 'ETHICAL',
    id_mcl: idMcl,
    tgl_plan: tglPlanIso,
  });
}

describe('POST /api/call-list', () => {
  it('201 happy path — insert + auto-snapshot dokter dari master', async () => {
    await deleteAllCallListForPeriode(PERIODE_FUTURE_ISO);
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<{ id: string; id_mcl: number; segmen: string; wilayah: string | null }>
    >('POST', '/api/call-list', {
      token,
      headers: VERSION_HEADERS,
      body: { id_mcl: 1, periode: PERIODE_FUTURE },
    });
    expect(status).toBe(201);
    expect(body.data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.data.id_mcl).toBe(1);
    // Master seed: ID=1 punya SEGMEN_MD=1 → Doctor
    expect(body.data.segmen).toBe('Doctor');
    // Master seed: dokter ID=1 tidak set WILAYAH → null
    expect(body.data.wilayah).toBeNull();
  });

  it('409 DUPLICATE_DOCTOR kalau (id_peg, id_mcl, periode) sudah ada', async () => {
    const { token } = await loginAs('mr01');
    // Pertama
    await request('POST', '/api/call-list', {
      token,
      headers: VERSION_HEADERS,
      body: { id_mcl: 2, periode: PERIODE_FUTURE },
    });
    // Kedua — duplikat
    const { status, body } = await request<ErrorBody>('POST', '/api/call-list', {
      token,
      headers: VERSION_HEADERS,
      body: { id_mcl: 2, periode: PERIODE_FUTURE },
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe('DUPLICATE_DOCTOR');
  });

  it('422 ADD_CALL_LIST_EXPIRED kalau periode bulan lalu', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/call-list', {
      token,
      headers: VERSION_HEADERS,
      body: { id_mcl: 1, periode: PERIODE_PAST },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('ADD_CALL_LIST_EXPIRED');
  });

  it('426 VERSION_OUTDATED kalau X-App-Version header hilang', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/call-list', {
      token,
      body: { id_mcl: 1, periode: PERIODE_FUTURE },
    });
    expect(status).toBe(426);
    expect(body.error.code).toBe('VERSION_OUTDATED');
  });

  it('401 tanpa token', async () => {
    const { status } = await request('POST', '/api/call-list', {
      headers: VERSION_HEADERS,
      body: { id_mcl: 1, periode: PERIODE_FUTURE },
    });
    expect(status).toBe(401);
  });

  it('422 VALIDATION_ERROR untuk periode invalid', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/call-list', {
      token,
      headers: VERSION_HEADERS,
      body: { id_mcl: 1, periode: '2026-13' },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('404 kalau id_mcl tidak ada di master', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/call-list', {
      token,
      headers: VERSION_HEADERS,
      body: { id_mcl: 99999, periode: PERIODE_FUTURE },
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /api/call-list/:id', () => {
  let rowId: string;

  beforeAll(async () => {
    // Siapkan satu row dengan approval=Reject untuk diedit.
    await deleteAllCallListForPeriode(PERIODE_FUTURE_ISO);
    const { token } = await loginAs('mr01');
    const { body } = await request<SuccessBody<{ id: string }>>('POST', '/api/call-list', {
      token,
      headers: VERSION_HEADERS,
      body: { id_mcl: 1, periode: PERIODE_FUTURE },
    });
    rowId = body.data.id;
    await setApprovalReject(rowId);
  });

  it('200 update sukses, reset approval ke NULL, insert history row', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<{ id: string; changes: number }>>(
      'PATCH',
      `/api/call-list/${rowId}`,
      {
        token,
        headers: VERSION_HEADERS,
        body: { id_mcl: 2, reason: 'salah pilih dokter' },
      },
    );
    expect(status).toBe(200);
    expect(body.data.changes).toBeGreaterThan(0);

    // Cek state row sekarang: approval = null, id_mcl=2, snapshot ter-update.
    const { db } = await import('../../src/config/database');
    const { call_list, call_list_history } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');
    const [updated] = await db.select().from(call_list).where(eq(call_list.id, rowId));
    expect(updated.approval).toBeNull();
    expect(updated.id_mcl).toBe(2);
    expect(updated.nama_dokter).toContain('Budi');

    // History row tertulis
    const histories = await db
      .select()
      .from(call_list_history)
      .where(eq(call_list_history.call_list_id, rowId));
    expect(histories.length).toBe(1);
    expect(histories[0].action_type).toBe('edit');
    expect(histories[0].old_id_mcl).toBe(1);
    expect(histories[0].new_id_mcl).toBe(2);
    expect(histories[0].reason).toBe('salah pilih dokter');
  });

  it('403 kalau status approval bukan Reject', async () => {
    // Bikin row baru (approval=null) — bukan Reject → tolak.
    const { token } = await loginAs('mr01');
    const { body: created } = await request<SuccessBody<{ id: string }>>(
      'POST',
      '/api/call-list',
      {
        token,
        headers: VERSION_HEADERS,
        body: { id_mcl: 3, periode: PERIODE_FUTURE },
      },
    );
    const { status, body } = await request<ErrorBody>(
      'PATCH',
      `/api/call-list/${created.data.id}`,
      {
        token,
        headers: VERSION_HEADERS,
        body: { id_mcl: 4 },
      },
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('404 kalau id tidak ditemukan', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'PATCH',
      '/api/call-list/00000000-0000-0000-0000-000000000000',
      {
        token,
        headers: VERSION_HEADERS,
        body: { id_mcl: 1 },
      },
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/call-list/:id', () => {
  it('200 delete sukses dan history ikut cascade', async () => {
    await deleteAllCallListForPeriode(PERIODE_FUTURE_ISO);
    const { token } = await loginAs('mr01');
    const { body: created } = await request<SuccessBody<{ id: string }>>(
      'POST',
      '/api/call-list',
      {
        token,
        headers: VERSION_HEADERS,
        body: { id_mcl: 1, periode: PERIODE_FUTURE },
      },
    );

    const { status, body } = await request<SuccessBody<{ deleted: boolean }>>(
      'DELETE',
      `/api/call-list/${created.data.id}`,
      { token, headers: VERSION_HEADERS },
    );
    expect(status).toBe(200);
    expect(body.data.deleted).toBe(true);

    // Verify benar-benar terhapus
    const { db } = await import('../../src/config/database');
    const { call_list } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(call_list).where(eq(call_list.id, created.data.id));
    expect(rows.length).toBe(0);
  });

  it('409 CALL_PLAN_EXISTS kalau sudah ada call_plan_actual untuk periode itu', async () => {
    await deleteAllCallListForPeriode(PERIODE_FUTURE_ISO);
    const { token } = await loginAs('mr01');
    const { body: created } = await request<SuccessBody<{ id: string }>>(
      'POST',
      '/api/call-list',
      {
        token,
        headers: VERSION_HEADERS,
        body: { id_mcl: 1, periode: PERIODE_FUTURE },
      },
    );

    // Seed plan untuk dokter+periode yang sama
    await seedPlanFor(1, 1, '2026-10-15');

    const { status, body } = await request<ErrorBody>(
      'DELETE',
      `/api/call-list/${created.data.id}`,
      { token, headers: VERSION_HEADERS },
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('CALL_PLAN_EXISTS');

    // cleanup plan biar tidak ganggu test lain
    const { db } = await import('../../src/config/database');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');
    await db.delete(call_plan_actual).where(eq(call_plan_actual.id_mcl, 1));
  });

  it('409 CANNOT_DELETE_REJECTED kalau status Reject', async () => {
    await deleteAllCallListForPeriode(PERIODE_FUTURE_ISO);
    const { token } = await loginAs('mr01');
    const { body: created } = await request<SuccessBody<{ id: string }>>(
      'POST',
      '/api/call-list',
      {
        token,
        headers: VERSION_HEADERS,
        body: { id_mcl: 1, periode: PERIODE_FUTURE },
      },
    );
    await setApprovalReject(created.data.id);

    const { status, body } = await request<ErrorBody>(
      'DELETE',
      `/api/call-list/${created.data.id}`,
      { token, headers: VERSION_HEADERS },
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('CANNOT_DELETE_REJECTED');
  });

  it('404 kalau id tidak ditemukan', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'DELETE',
      '/api/call-list/00000000-0000-0000-0000-000000000000',
      { token, headers: VERSION_HEADERS },
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('426 VERSION_OUTDATED kalau X-App-Version header hilang', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'DELETE',
      '/api/call-list/00000000-0000-0000-0000-000000000000',
      { token },
    );
    expect(status).toBe(426);
    expect(body.error.code).toBe('VERSION_OUTDATED');
  });
});
