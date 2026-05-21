import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { DomainError } from '../lib/errors';

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginatedMeta;
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export function sendSuccess<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json<SuccessResponse<T>>({ success: true, data }, status);
}

export function sendPaginated<T>(
  c: Context,
  data: T[],
  meta: PaginatedMeta,
  status: ContentfulStatusCode = 200,
) {
  return c.json<PaginatedResponse<T>>({ success: true, data, meta }, status);
}

export function sendError(
  c: Context,
  err: DomainError | Error,
  fallbackStatus: ContentfulStatusCode = 500,
) {
  if (err instanceof DomainError) {
    return c.json<ErrorResponse>(
      {
        success: false,
        error: {
          message: err.message,
          code: err.code,
          details: err.details,
        },
      },
      err.statusCode as ContentfulStatusCode,
    );
  }

  return c.json<ErrorResponse>(
    {
      success: false,
      error: {
        message: err.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    },
    fallbackStatus,
  );
}

export function getValidJson<T>(c: Context): T {
  return c.req.valid('json' as never) as T;
}

export function getValidParam<T>(c: Context): T {
  return c.req.valid('param' as never) as T;
}

export function getValidQuery<T>(c: Context): T {
  return c.req.valid('query' as never) as T;
}
