import type { MiddlewareHandler } from 'hono';
import { VersionOutdatedError } from '../lib/errors';
import type { AppEnv } from '../types/app-env';

/**
 * Middleware gate yang mewajibkan header `X-App-Version` ada di request.
 *
 * Legacy behavior: nilainya tidak divalidasi, hanya presence-check. Jika hilang,
 * server tolak dengan HTTP 426 VERSION_OUTDATED — mobile harus update APK.
 *
 * Dipasang di semua write endpoint (POST/PATCH/DELETE) yang menyangkut data
 * call_list / call_plan / call_actual / approval. Lihat
 * `legacy/DOCS-BACKEND/06-business-logic.md` §1 untuk daftar endpoint terkait.
 */
export const requireAppVersion: MiddlewareHandler<AppEnv> = async (c, next) => {
  const version = c.req.header('X-App-Version') ?? c.req.header('x-app-version');
  if (!version || version.trim() === '') {
    throw new VersionOutdatedError();
  }
  await next();
};
