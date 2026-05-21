import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { AUTH_COOKIE_NAME, type AuthPayload, verifyToken } from '../config/auth';
import { UnauthorizedError } from '../lib/errors';
import type { AppEnv } from '../types/app-env';

export function extractToken(c: Context<AppEnv>): string | null {
  const authHeader = c.req.header('Authorization') ?? c.req.header('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  return getCookie(c, AUTH_COOKIE_NAME) ?? null;
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = extractToken(c);
  if (!token) {
    throw new UnauthorizedError('Authentication required');
  }

  try {
    const payload = await verifyToken(token);
    c.set('user', payload);
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  await next();
};

export function getCurrentUser(c: Context<AppEnv>): AuthPayload {
  const user = c.get('user');
  if (!user) {
    throw new UnauthorizedError('Not authenticated');
  }
  return user;
}
