import type { MiddlewareHandler } from 'hono';
import { ForbiddenError } from '../lib/errors';
import { getCurrentUser } from './auth';

export function requireJabatan(allowed: readonly string[]): MiddlewareHandler {
  return async (c, next) => {
    const user = getCurrentUser(c);
    if (!allowed.includes(user.jabatan)) {
      throw new ForbiddenError(`Endpoint ini hanya untuk jabatan: ${allowed.join(', ')}`, {
        current: user.jabatan,
        required: allowed,
      });
    }
    await next();
  };
}

/**
 * Variant per divisi — kalau endpoint cuma untuk divisi tertentu.
 * Mis. fitur OTC-only tidak boleh diakses ETHICAL.
 */
export function requireDivisi(allowed: readonly string[]): MiddlewareHandler {
  return async (c, next) => {
    const user = getCurrentUser(c);
    if (!user.divisi || !allowed.includes(user.divisi)) {
      throw new ForbiddenError(`Endpoint ini hanya untuk divisi: ${allowed.join(', ')}`, {
        current: user.divisi,
        required: allowed,
      });
    }
    await next();
  };
}
