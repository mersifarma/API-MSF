import type { Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { AUTH_COOKIE_NAME, cookieOptions, signToken } from '../config/auth';
import { env } from '../config/env';
import { getCurrentUser } from '../middleware/auth';
import {
  getPegawaiById,
  getPegawaiByUserId,
  getPegawaiForUser,
  getUserById,
  stripUser,
  verifyCredentials,
} from '../services/auth.service';
import { getValidJson, sendSuccess } from '../utils/response';
import type { LoginInput, SwitchPegawaiInput } from '../validations/auth.validation';

function tokenResponse(token: string) {
  return {
    access_token: token,
    token_type: 'Bearer' as const,
    expires_in: env.JWT_EXPIRES_IN,
  };
}

export async function login(c: Context) {
  const { username, password } = getValidJson<LoginInput>(c);

  const user = await verifyCredentials(username, password);
  const pegawaiList = await getPegawaiByUserId(user.id);
  const defaultPegawai = pegawaiList[0] ?? null;

  const token = await signToken({
    sub: user.id,
    name: user.name,
    username: user.username,
    id_peg: defaultPegawai?.rowid ?? 0,
    jabatan: defaultPegawai?.jabatan ?? '',
    divisi: defaultPegawai?.divisi ?? null,
  });

  setCookie(c, AUTH_COOKIE_NAME, token, cookieOptions);

  return sendSuccess(c, {
    user: stripUser(user),
    pegawai: defaultPegawai,
    pegawaiList,
    ...tokenResponse(token),
  });
}

export async function me(c: Context) {
  const payload = getCurrentUser(c);
  const [user, pegawai, pegawaiList] = await Promise.all([
    getUserById(payload.sub),
    payload.id_peg > 0 ? getPegawaiById(payload.id_peg) : Promise.resolve(null),
    getPegawaiByUserId(payload.sub),
  ]);

  return sendSuccess(c, {
    user: stripUser(user),
    pegawai,
    pegawaiList,
  });
}

export async function switchPegawai(c: Context) {
  const payload = getCurrentUser(c);
  const { id_peg } = getValidJson<SwitchPegawaiInput>(c);

  const pegawai = await getPegawaiForUser(payload.sub, id_peg);
  const user = await getUserById(payload.sub);

  const token = await signToken({
    sub: user.id,
    name: user.name,
    username: user.username,
    id_peg: pegawai.rowid,
    jabatan: pegawai.jabatan,
    divisi: pegawai.divisi ?? null,
  });

  setCookie(c, AUTH_COOKIE_NAME, token, cookieOptions);

  return sendSuccess(c, {
    user: stripUser(user),
    pegawai,
    ...tokenResponse(token),
  });
}

export async function logout(c: Context) {
  deleteCookie(c, AUTH_COOKIE_NAME, { path: '/' });
  return sendSuccess(c, { message: 'Logged out. Client harus hapus token.' });
}
