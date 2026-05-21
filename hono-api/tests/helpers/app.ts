/**
 * Thin wrapper di atas Hono `app.request()` — tidak perlu spin up HTTP server.
 *
 * Pakai:
 *   const { status, body } = await request('POST', '/api/auth/login', {
 *     body: { username: 'mr01', password: 'password' },
 *   });
 *   expect(status).toBe(200);
 *   expect(body.data.access_token).toBeDefined();
 */

import { createApp } from '../../src/app';

let cached: ReturnType<typeof createApp> | null = null;

export function getApp() {
  if (!cached) cached = createApp();
  return cached;
}

export type RequestOptions = {
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
};

export type TestResponse<T = unknown> = {
  status: number;
  body: T;
  raw: Response;
};

export async function request<T = unknown>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<TestResponse<T>> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const init: RequestInit = { method };

  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  if (opts.token) {
    headers['Authorization'] = `Bearer ${opts.token}`;
  }

  init.headers = headers;

  const raw = await getApp().request(path, init);

  // Hindari .json() crash di response tanpa body (e.g. 204)
  const text = await raw.text();
  const body = text ? (JSON.parse(text) as T) : (undefined as T);

  return { status: raw.status, body, raw };
}
