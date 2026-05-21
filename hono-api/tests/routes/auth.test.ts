import { describe, expect, it } from 'bun:test';
import { request } from '../helpers/app';
import { loginAs } from '../helpers/auth';

type SuccessBody<T> = { success: true; data: T };
type ErrorBody = { success: false; error: { message: string; code: string; details?: unknown } };

describe('POST /api/auth/login', () => {
  it('returns 200 + access_token for valid credentials', async () => {
    const { status, body } = await request<
      SuccessBody<{
        user: { username: string; id: number };
        pegawai: { rowid: number } | null;
        access_token: string;
        token_type: string;
        expires_in: number;
      }>
    >('POST', '/api/auth/login', {
      body: { username: 'mr01', password: 'password' },
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.user.username).toBe('mr01');
    expect(body.data.access_token).toBeTruthy();
    expect(body.data.token_type).toBe('Bearer');
    expect(typeof body.data.expires_in).toBe('number');
  });

  it('returns 401 UNAUTHORIZED for wrong password', async () => {
    const { status, body } = await request<ErrorBody>('POST', '/api/auth/login', {
      body: { username: 'mr01', password: 'wrong-password' },
    });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 422 VALIDATION_ERROR for empty body', async () => {
    const { status, body } = await request<ErrorBody>('POST', '/api/auth/login', {
      body: {},
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without token', async () => {
    const { status, body } = await request<ErrorBody>('GET', '/api/auth/me');
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 + current user when authenticated', async () => {
    const { token } = await loginAs('mr01', 'password');

    const { status, body } = await request<
      SuccessBody<{
        user: { username: string };
        pegawai: { rowid: number; nama: string } | null;
        pegawaiList: Array<{ rowid: number }>;
      }>
    >('GET', '/api/auth/me', { token });

    expect(status).toBe(200);
    expect(body.data.user.username).toBe('mr01');
    expect(Array.isArray(body.data.pegawaiList)).toBe(true);
  });
});

describe('POST /api/auth/switch-pegawai', () => {
  it('returns 403 FORBIDDEN when id_peg is not owned by user', async () => {
    const { token } = await loginAs('mr01', 'password');

    // pegawai rowid=2 milik dm01 (lihat _fixtures.ts) — bukan milik mr01.
    const { status, body } = await request<ErrorBody>('POST', '/api/auth/switch-pegawai', {
      token,
      body: { id_peg: 2 },
    });

    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 422 for missing id_peg', async () => {
    const { token } = await loginAs('mr01', 'password');

    const { status, body } = await request<ErrorBody>('POST', '/api/auth/switch-pegawai', {
      token,
      body: {},
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200 when authenticated', async () => {
    const { token } = await loginAs('mr01', 'password');

    const { status, body } = await request<SuccessBody<{ message: string }>>(
      'POST',
      '/api/auth/logout',
      { token },
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 401 without token', async () => {
    const { status } = await request('POST', '/api/auth/logout');
    expect(status).toBe(401);
  });
});
