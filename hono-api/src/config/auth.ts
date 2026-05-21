import { sign, verify } from 'hono/jwt';
import { env } from './env';

export const AUTH_COOKIE_NAME = 'auth_token';

export interface AuthPayload {
  sub: number;
  name: string;
  username: string;
  id_peg: number;
  jabatan: string;
  divisi: string | null;
  // Standard JWT claims
  iat?: number;
  exp?: number;
}

export async function signToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      ...payload,
      iat: now,
      exp: now + env.JWT_EXPIRES_IN,
    },
    env.JWT_SECRET,
    'HS256',
  );
}

export async function verifyToken(token: string): Promise<AuthPayload> {
  const decoded = await verify(token, env.JWT_SECRET, 'HS256');
  return decoded as unknown as AuthPayload;
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'Lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/',
  maxAge: env.JWT_EXPIRES_IN,
};
