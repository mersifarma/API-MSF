import { beforeAll, describe, expect, it } from 'bun:test';
import { request } from '../helpers/app';
import { loginAs } from '../helpers/auth';
import { seedDokterVisit } from '../helpers/seed';

type SuccessBody<T> = { success: true; data: T };
type ErrorBody = { success: false; error: { message: string; code: string; details?: unknown } };

const VERSION_HEADERS = { 'X-App-Version': '1.0.0' } as const;

/** Today di WIB sesuai logika `todayWIB(now)` di src/lib/timezone.ts. */
function todayWIB(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/** HH:MM:SS sekarang di WIB — dipakai untuk save Actual happy path. */
function nowTimeWIB(): string {
  const wib = new Date(Date.now() + 7 * 3_600_000).toISOString();
  return wib.slice(11, 19);
}

async function deleteAllActuals() {
  const { db } = await import('../../src/config/database');
  const { call_plan_actual } = await import('../../src/db/schema/transactional');
  await db.delete(call_plan_actual);
}

async function seedPlanRow(opts: {
  idPeg?: number;
  idMcl?: number;
  tglPlan?: string;
  status?: string | null;
  tglActual?: string | null;
} = {}): Promise<string> {
  const { db } = await import('../../src/config/database');
  const { call_plan_actual } = await import('../../src/db/schema/transactional');
  const [row] = await db
    .insert(call_plan_actual)
    .values({
      id_peg: opts.idPeg ?? 1,
      id_ff: 'MR0001',
      nama_ff: 'MR Satu',
      divisi: 'ETHICAL',
      id_mcl: opts.idMcl ?? 1,
      nama_dokter: 'dr. Andi Praktisi',
      spec: 'Umum',
      segmen_md: 1,
      class: 'A',
      institusi: 'Klinik Sehat A',
      tgl_plan: opts.tglPlan ?? todayWIB(),
      waktu: '10:00:00',
      status: opts.status ?? null,
      tgl_actual: opts.tglActual ?? null,
    })
    .returning({ id: call_plan_actual.id });
  return row.id;
}

beforeAll(async () => {
  await seedDokterVisit();
});

// =============================================================================
// GET /api/call-actual
// =============================================================================
describe('GET /api/call-actual', () => {
  beforeAll(async () => {
    await deleteAllActuals();
    await seedPlanRow({ idMcl: 1, status: 'Visit', tglActual: todayWIB() });
    await seedPlanRow({ idMcl: 2, status: 'Offline', tglActual: todayWIB() });
    // Row ini tidak boleh muncul — status NULL = belum visit
    await seedPlanRow({ idMcl: 3, status: null });
  });

  it('returns rows yang sudah punya status (Visit/Offline/dll.)', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<Array<{ id_mcl: number; status: string }>>>(
      'GET',
      '/api/call-actual',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(2);
    expect(body.data.map((r) => r.id_mcl).sort()).toEqual([1, 2]);
  });

  it('returns 401 tanpa token', async () => {
    const { status } = await request('GET', '/api/call-actual');
    expect(status).toBe(401);
  });
});

// =============================================================================
// GET /api/call-actual/:id
// =============================================================================
describe('GET /api/call-actual/:id', () => {
  it('returns details + join_visit_names kosong kalau tidak ada join visit', async () => {
    await deleteAllActuals();
    const id = await seedPlanRow({ idMcl: 1, status: 'Visit', tglActual: todayWIB() });
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<{ id: string; join_visit_names: string[] }>
    >('GET', `/api/call-actual/${id}`, { token });
    expect(status).toBe(200);
    expect(body.data.id).toBe(id);
    expect(body.data.join_visit_names).toEqual([]);
  });

  it('returns 404 untuk id tidak ada', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      '/api/call-actual/00000000-0000-0000-0000-000000000000',
      { token },
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 422 untuk id bukan UUID', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('GET', '/api/call-actual/not-uuid', {
      token,
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// =============================================================================
// PATCH /api/call-actual/:id — saveActual
// =============================================================================
describe('PATCH /api/call-actual/:id', () => {
  it('200 happy path — UPDATE row dengan koor + status', async () => {
    await deleteAllActuals();
    const id = await seedPlanRow();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<{ id: string }>>(
      'PATCH',
      `/api/call-actual/${id}`,
      {
        token,
        headers: VERSION_HEADERS,
        body: {
          koor_visit: '-6.2,106.8',
          tgl_actual: todayWIB(),
          waktu_actual: nowTimeWIB(),
          status: 'Visit',
        },
      },
    );
    expect(status).toBe(200);
    expect(body.data.id).toBe(id);
  });

  it('422 INVALID_TIME_SETTING kalau tgl_actual bukan today', async () => {
    await deleteAllActuals();
    const id = await seedPlanRow();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('PATCH', `/api/call-actual/${id}`, {
      token,
      headers: VERSION_HEADERS,
      body: {
        koor_visit: '-6.2,106.8',
        tgl_actual: '2020-01-01',
        status: 'Visit',
      },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('INVALID_TIME_SETTING');
  });

  it('422 VISIT_TIME_EXPIRED kalau offline status & waktu > 1 jam lalu', async () => {
    await deleteAllActuals();
    const id = await seedPlanRow();
    const { token } = await loginAs('mr01');
    // Pakai waktu 2 jam lalu di WIB
    const twoHoursAgoWIB = new Date(Date.now() - 2 * 3_600_000 + 7 * 3_600_000)
      .toISOString()
      .slice(11, 19);
    const { status, body } = await request<ErrorBody>('PATCH', `/api/call-actual/${id}`, {
      token,
      headers: VERSION_HEADERS,
      body: {
        koor_visit: '-6.2,106.8',
        tgl_actual: todayWIB(),
        waktu_actual: twoHoursAgoWIB,
        status: 'Visit Offline',
      },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VISIT_TIME_EXPIRED');
  });

  it('403 kalau save milik pegawai lain', async () => {
    await deleteAllActuals();
    const id = await seedPlanRow({ idPeg: 1 }); // milik MR
    const { token } = await loginAs('dm01'); // login as DM, beda owner
    const { status, body } = await request<ErrorBody>('PATCH', `/api/call-actual/${id}`, {
      token,
      headers: VERSION_HEADERS,
      body: {
        koor_visit: '-6.2,106.8',
        tgl_actual: todayWIB(),
        status: 'Visit',
      },
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('426 tanpa X-App-Version', async () => {
    await deleteAllActuals();
    const id = await seedPlanRow();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('PATCH', `/api/call-actual/${id}`, {
      token,
      body: {
        koor_visit: '-6.2,106.8',
        tgl_actual: todayWIB(),
        status: 'Visit',
      },
    });
    expect(status).toBe(426);
    expect(body.error.code).toBe('VERSION_OUTDATED');
  });

  it('422 VALIDATION_ERROR untuk koor_visit format salah', async () => {
    await deleteAllActuals();
    const id = await seedPlanRow();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('PATCH', `/api/call-actual/${id}`, {
      token,
      headers: VERSION_HEADERS,
      body: {
        koor_visit: 'not-koor',
        tgl_actual: todayWIB(),
        status: 'Visit',
      },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Join Visit copy: 1 atasan → INSERT 1 row baru status=join_visit', async () => {
    await deleteAllActuals();
    const id = await seedPlanRow();
    const { token } = await loginAs('mr01');
    const res = await request<SuccessBody<{ id: string }>>('PATCH', `/api/call-actual/${id}`, {
      token,
      headers: VERSION_HEADERS,
      body: {
        koor_visit: '-6.2,106.8',
        tgl_actual: todayWIB(),
        waktu_actual: nowTimeWIB(),
        status: 'Visit',
        join_visit: 1,
        join_visit_id: '2', // DM (id_peg=2)
      },
    });
    expect(res.status).toBe(200);

    const { db } = await import('../../src/config/database');
    const { call_plan_actual } = await import('../../src/db/schema/transactional');
    const { eq } = await import('drizzle-orm');
    const joinRows = await db
      .select()
      .from(call_plan_actual)
      .where(eq(call_plan_actual.status, 'join_visit'));
    expect(joinRows.length).toBe(1);
    expect(joinRows[0].id_peg).toBe(2);
    expect(joinRows[0].join_visit_id).toBe(id);
    expect(joinRows[0].koor_visit).toBeNull();
  });
});

// =============================================================================
// POST /api/call-actual/unplan
// =============================================================================
describe('POST /api/call-actual/unplan', () => {
  it('201 happy path — INSERT row baru tanpa tgl_plan', async () => {
    await deleteAllActuals();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<{ id: string }>>(
      'POST',
      '/api/call-actual/unplan',
      {
        token,
        headers: VERSION_HEADERS,
        body: {
          id_mcl: 4,
          nama_dokter: 'dr. Dewi Anggraeni, Sp.KK',
          spec: 'Kulit & Kelamin',
          segmen_md: 2,
          class: 'B',
          institusi: 'Klinik Kulit Cantik',
          koor_visit: '-6.2,106.8',
          tgl_actual: todayWIB(),
          waktu_actual: nowTimeWIB(),
          status: 'Visit',
        },
      },
    );
    expect(status).toBe(201);
    expect(body.data.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('409 ALREADY_VISITED_TODAY untuk duplikasi (id_peg, id_mcl, tgl_actual)', async () => {
    await deleteAllActuals();
    const { token } = await loginAs('mr01');
    const payload = {
      id_mcl: 4,
      nama_dokter: 'dr. Dewi Anggraeni, Sp.KK',
      spec: 'Kulit & Kelamin',
      segmen_md: 2,
      class: 'B',
      institusi: 'Klinik Kulit Cantik',
      koor_visit: '-6.2,106.8',
      tgl_actual: todayWIB(),
      waktu_actual: nowTimeWIB(),
      status: 'Visit',
    };
    await request('POST', '/api/call-actual/unplan', {
      token,
      headers: VERSION_HEADERS,
      body: payload,
    });
    const { status, body } = await request<ErrorBody>('POST', '/api/call-actual/unplan', {
      token,
      headers: VERSION_HEADERS,
      body: payload,
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe('ALREADY_VISITED_TODAY');
  });

  it('422 INVALID_TIME_SETTING untuk tgl_actual bukan today', async () => {
    await deleteAllActuals();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/call-actual/unplan', {
      token,
      headers: VERSION_HEADERS,
      body: {
        id_mcl: 4,
        nama_dokter: 'dr. Dewi',
        spec: 'Umum',
        segmen_md: 2,
        koor_visit: '-6.2,106.8',
        tgl_actual: '2020-01-01',
        status: 'Visit',
      },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('INVALID_TIME_SETTING');
  });

  it('426 tanpa X-App-Version', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/call-actual/unplan', {
      token,
      body: {
        id_mcl: 4,
        nama_dokter: 'dr. Dewi',
        spec: 'Umum',
        segmen_md: 2,
        koor_visit: '-6.2,106.8',
        tgl_actual: todayWIB(),
        status: 'Visit',
      },
    });
    expect(status).toBe(426);
    expect(body.error.code).toBe('VERSION_OUTDATED');
  });

  it('401 tanpa token', async () => {
    const { status } = await request('POST', '/api/call-actual/unplan', {
      headers: VERSION_HEADERS,
      body: {
        id_mcl: 4,
        nama_dokter: 'dr. Dewi',
        spec: 'Umum',
        segmen_md: 2,
        koor_visit: '-6.2,106.8',
        tgl_actual: todayWIB(),
        status: 'Visit',
      },
    });
    expect(status).toBe(401);
  });
});
