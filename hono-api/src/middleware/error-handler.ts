import type { ErrorHandler, Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const errorHandler: ErrorHandler = (err, c) => {
  console.error('[error]', err);
  if (err instanceof HTTPException) {
    return c.json({ message: err.message || 'HTTP error' }, err.status);
  }
  return c.json({ message: err.message ?? 'Internal error' }, 500);
};

export const notFoundHandler = (c: Context) =>
  c.json({ message: `Route not found: ${c.req.method} ${c.req.path}` }, 404);
