import { describe, expect, it } from 'bun:test';
import { request } from '../helpers/app';
import { loginAs } from '../helpers/auth';

type SuccessBody<T> = { success: true; data: T };
type ErrorBody = { success: false; error: { message: string; code: string } };

type Supervisor = { id_peg: number; nama: string; jabatan: string | null };

describe('GET /api/join-visit/supervisors', () => {
  it('200 MR sees DM + RSM', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<Supervisor[]>>(
      'GET',
      '/api/join-visit/supervisors',
      { token },
    );
    expect(status).toBe(200);
    const namaList = body.data.map((s) => s.nama).sort();
    expect(namaList).toEqual(['DM Satu', 'RSM Satu']);
    expect(body.data.find((s) => s.nama === 'DM Satu')?.id_peg).toBe(2);
    expect(body.data.find((s) => s.nama === 'RSM Satu')?.id_peg).toBe(3);
  });

  it('200 DM sees RSM only', async () => {
    const { token } = await loginAs('dm01');
    const { status, body } = await request<SuccessBody<Supervisor[]>>(
      'GET',
      '/api/join-visit/supervisors',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].nama).toBe('RSM Satu');
    expect(body.data[0].id_peg).toBe(3);
  });

  it('200 RSM sees empty (no MM seeded)', async () => {
    const { token } = await loginAs('rsm01');
    const { status, body } = await request<SuccessBody<Supervisor[]>>(
      'GET',
      '/api/join-visit/supervisors',
      { token },
    );
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('200 RSM sees MM kalau ada di struktur', async () => {
    const { db } = await import('../../src/config/database');
    const { data_pegawai, struktur } = await import('../../src/db/schema/master');
    const { eq } = await import('drizzle-orm');

    await db.insert(data_pegawai).values({
      rowid: 30,
      id: 'MM0030',
      nama: 'MM Tiga Puluh',
      jabatan: 'MM',
      divisi: 'ETHICAL',
      status: 'ACTIVE',
    });
    await db
      .update(struktur)
      .set({ id_peg_mm: 30, id_mm: 'MM0030' })
      .where(eq(struktur.id, 1));

    const { token } = await loginAs('rsm01');
    const { body } = await request<SuccessBody<Supervisor[]>>(
      'GET',
      '/api/join-visit/supervisors',
      { token },
    );
    expect(body.data.length).toBe(1);
    expect(body.data[0].nama).toBe('MM Tiga Puluh');

    // Cleanup
    await db
      .update(struktur)
      .set({ id_peg_mm: null, id_mm: null })
      .where(eq(struktur.id, 1));
    await db.delete(data_pegawai).where(eq(data_pegawai.rowid, 30));
  });

  it('401 tanpa token', async () => {
    const { status, body } = await request<ErrorBody>('GET', '/api/join-visit/supervisors');
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});
