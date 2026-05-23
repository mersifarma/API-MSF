import { beforeAll, describe, expect, it } from 'bun:test';
import { request } from '../helpers/app';
import { loginAs } from '../helpers/auth';
import {
  seedAppModuls,
  seedCallVersion,
  seedDokterVisit,
  seedProduct,
} from '../helpers/seed';

type SuccessBody<T> = { success: true; data: T };
type PaginatedBody<T> = { success: true; data: T[]; meta: { total: number; page: number; limit: number } };
type ErrorBody = { success: false; error: { message: string; code: string; details?: unknown } };

describe('GET /api/server-date', () => {
  it('returns ISO timestamp + WIB metadata (no auth needed)', async () => {
    const { status, body } = await request<
      SuccessBody<{ iso: string; epoch_ms: number; timezone: string; tz_offset_minutes: number }>
    >('GET', '/api/server-date');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.timezone).toBe('Asia/Jakarta');
    expect(body.data.tz_offset_minutes).toBe(420);
    expect(typeof body.data.epoch_ms).toBe('number');
    expect(body.data.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('GET /api/master/app-version', () => {
  beforeAll(async () => {
    await seedCallVersion();
  });

  it('returns latest version from call_version', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<{ version: string; link_apk: string }>>(
      'GET',
      '/api/master/app-version',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.version).toBe('2.0.0');
    expect(body.data.link_apk).toContain('msf-mobile.apk');
  });

  it('returns 401 without token', async () => {
    const { status } = await request('GET', '/api/master/app-version');
    expect(status).toBe(401);
  });
});

describe('GET /api/master/app-config', () => {
  it('returns business constants', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<{ join_visit_radius_meters: number; batas_hari_kerja_list: number }>
    >('GET', '/api/master/app-config', { token });
    expect(status).toBe(200);
    expect(body.data.join_visit_radius_meters).toBe(100);
    expect(body.data.batas_hari_kerja_list).toBe(5);
  });
});

describe('GET /api/master/modul', () => {
  beforeAll(async () => {
    await seedAppModuls();
  });

  it('returns modul list for the currently authenticated user (MR)', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<Array<{ id_modul: number; nama_modul: string }>>
    >('GET', '/api/master/modul', { token });

    expect(status).toBe(200);
    const namaList = body.data.map((m) => m.nama_modul).sort();
    // MR di seed punya Visit, Reports, Profile
    expect(namaList).toEqual(['Profile', 'Reports', 'Visit']);
  });

  it('returns 401 without token', async () => {
    const { status } = await request('GET', '/api/master/modul');
    expect(status).toBe(401);
  });
});

describe('GET /api/master/dokter/specs', () => {
  beforeAll(async () => {
    await seedDokterVisit();
  });

  it('returns distinct specs', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<Array<{ id: number; spec: string; gelar: string | null }>>
    >('GET', '/api/master/dokter/specs', { token });
    expect(status).toBe(200);
    expect(body.data.length).toBeGreaterThanOrEqual(5);
    expect(body.data.map((s) => s.spec)).toContain('Umum');
    expect(body.data.map((s) => s.spec)).toContain('Anak');
  });
});

describe('GET /api/master/dokter', () => {
  it('MR sees their own 5 dokter', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      PaginatedBody<{ id: number; nama_dokter: string; id_peg: number; spec: string }>
    >('GET', '/api/master/dokter', { token });
    expect(status).toBe(200);
    expect(body.data.length).toBe(5);
    for (const row of body.data) {
      expect(row.id_peg).toBe(1);
    }
    expect(body.meta.total).toBe(5);
  });

  it('search filter narrows result (case-insensitive)', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<PaginatedBody<{ nama_dokter: string }>>(
      'GET',
      '/api/master/dokter?search=andi',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].nama_dokter.toLowerCase()).toContain('andi');
  });

  it('spec filter works', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<PaginatedBody<{ spec: string }>>(
      'GET',
      '/api/master/dokter?spec=Anak',
      { token },
    );
    expect(status).toBe(200);
    for (const r of body.data) expect(r.spec).toBe('Anak');
  });

  it('DM sees MR bawahan dokter (hierarchy expand)', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<PaginatedBody<{ id_peg: number }>>(
      'GET',
      '/api/master/dokter',
      { token },
    );
    expect(status).toBe(200);
    // DM (id_peg=2) → struktur menunjuk MR id_peg=1 sebagai bawahan,
    // jadi semua 5 dokter MR harus terlihat.
    expect(body.data.length).toBe(5);
    for (const r of body.data) expect(r.id_peg).toBe(1);
  });

  it('returns 422 for invalid pagination param', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('GET', '/api/master/dokter?limit=999', {
      token,
    });
    expect(status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/master/products', () => {
  beforeAll(async () => {
    await seedProduct();
  });

  it('returns active products', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<Array<{ id_product: string; nama_product: string; divisi: string }>>
    >('GET', '/api/master/products', { token });
    expect(status).toBe(200);
    expect(body.data.length).toBe(4);
    for (const p of body.data) expect(p.divisi).toBe('ETHICAL');
  });

  it('search filter works', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<Array<{ nama_product: string }>>>(
      'GET',
      '/api/master/products?search=Paracetamol',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].nama_product).toContain('Paracetamol');
  });
});

describe('GET /api/master/pegawai/lookup', () => {
  it('returns pegawai by id_peg', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<{ rowid: number; nama: string; jabatan: string }>
    >('GET', '/api/master/pegawai/lookup?id_peg=2', { token });
    expect(status).toBe(200);
    expect(body.data.rowid).toBe(2);
    expect(body.data.jabatan).toBe('DM');
  });

  it('returns 404 for unknown id_peg', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      '/api/master/pegawai/lookup?id_peg=9999',
      { token },
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 422 without id_peg param', async () => {
    const { token } = await loginAs('mr01');
    const { status } = await request('GET', '/api/master/pegawai/lookup', { token });
    expect(status).toBe(422);
  });
});

describe('GET /api/master/dokter/non-target', () => {
  it('MR sees dokter NOT belonging to themselves', async () => {
    // Seed punya 5 dokter semua ID_PEG=1 (milik MR).
    // Untuk MR sendiri, semua di-exclude → result kosong.
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      '/api/master/dokter/non-target',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(0);
  });

  it('DM sees all dokter (they are not the owner)', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<unknown[]>>(
      'GET',
      '/api/master/dokter/non-target',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(5);
  });
});
