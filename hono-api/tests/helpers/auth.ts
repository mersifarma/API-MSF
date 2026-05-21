/**
 * Auth helper untuk test — login via endpoint dan kembalikan token + user info.
 */

import { request } from './app';

export type LoginResult = {
  token: string;
  user: { id: number; username: string; name: string; [k: string]: unknown };
  pegawai: { rowid: number; nama: string; [k: string]: unknown } | null;
};

type LoginResponseBody = {
  success: boolean;
  data: {
    user: LoginResult['user'];
    pegawai: LoginResult['pegawai'];
    access_token: string;
    token_type: string;
    expires_in: number;
  };
};

export async function loginAs(username: string, password = 'password'): Promise<LoginResult> {
  const { status, body } = await request<LoginResponseBody>('POST', '/api/auth/login', {
    body: { username, password },
  });

  if (status !== 200 || !body?.success) {
    throw new Error(
      `loginAs(${username}) failed: status=${status} body=${JSON.stringify(body)}`,
    );
  }

  return {
    token: body.data.access_token,
    user: body.data.user,
    pegawai: body.data.pegawai,
  };
}
