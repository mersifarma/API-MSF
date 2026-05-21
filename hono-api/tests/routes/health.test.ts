import { describe, expect, it } from 'bun:test';
import { request } from '../helpers/app';

describe('GET /health', () => {
  it('returns 200 and ok status', async () => {
    const { status, body } = await request<{
      success: boolean;
      data: { status: string; ts: number };
    }>('GET', '/health');

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(typeof body.data.ts).toBe('number');
  });

  it('returns 404 for unknown route with consistent error shape', async () => {
    const { status, body } = await request<{
      success: boolean;
      error: { message: string; code: string };
    }>('GET', '/this-route-does-not-exist');

    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
