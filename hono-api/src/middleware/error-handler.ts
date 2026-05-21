import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { env } from '../config/env';
import { DomainError } from '../lib/errors';
import { sendError } from '../utils/response';

export const errorHandler: ErrorHandler = (err, c) => {
  // Skip stack-dump di production (noise) DAN test (banyak error yang memang
  // di-expect oleh assertion — print-nya bikin output bun test sulit dibaca).
  if (env.NODE_ENV === 'development') {
    console.error('[error]', err);
  }
  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        error: {
          message: err.message || 'HTTP error',
          code: `HTTP_${err.status}`,
        },
      },
      err.status,
    );
  }

  return sendError(c, err);
};

export const notFoundHandler = (c: import('hono').Context) =>
  c.json(
    {
      success: false,
      error: {
        message: `Route not found: ${c.req.method} ${c.req.path}`,
        code: 'NOT_FOUND',
      },
    },
    404,
  );
