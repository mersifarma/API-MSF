import { API_BASE_URL, APP_VERSION } from './env';
import type { ApiErrorBody, ApiPaginated, ApiSuccess } from '../types/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Options = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
};

export async function appFetch<T>(path: string, opts: Options = {}): Promise<T> {
  const { body, headers = {}, token, ...rest } = opts;

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    'X-App-Version': APP_VERSION,
    ...headers,
  };

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: ApiSuccess<T> | ApiErrorBody | null = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as ApiSuccess<T> | ApiErrorBody;
    } catch {
      throw new ApiError(response.status, 'INVALID_JSON', `Non-JSON response: ${text.slice(0, 200)}`);
    }
  }

  if (!response.ok || !payload || payload.success === false) {
    const err = payload && payload.success === false ? payload.error : null;
    throw new ApiError(
      response.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? `Request failed (${response.status})`,
      err?.details,
    );
  }

  return payload.data;
}

export async function appFetchPaginated<T>(
  path: string,
  opts: Options = {},
): Promise<{ data: T[]; meta: { total: number; page: number; limit: number } }> {
  const { body, headers = {}, token, ...rest } = opts;

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    'X-App-Version': APP_VERSION,
    ...headers,
  };

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: ApiPaginated<T> | ApiErrorBody | null = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as ApiPaginated<T> | ApiErrorBody;
    } catch {
      throw new ApiError(response.status, 'INVALID_JSON', `Non-JSON response: ${text.slice(0, 200)}`);
    }
  }

  if (!response.ok || !payload || payload.success === false) {
    const err = payload && payload.success === false ? payload.error : null;
    throw new ApiError(
      response.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? `Request failed (${response.status})`,
      err?.details,
    );
  }

  return { data: payload.data, meta: payload.meta };
}
