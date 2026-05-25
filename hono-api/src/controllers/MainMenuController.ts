import type { Context } from 'hono';
import { sql } from '../config/database';

export async function login(c: Context) {
  const { username, password } = await c.req.json();

  const userRows = await sql`
    SELECT id, username, name, password
    FROM users
    WHERE username = ${username}
    LIMIT 1
  `;

  if (userRows.length === 0) {
    return c.json({
      success: false,
      message: 'Incorrect username/password.',
    });
  }

  const user = userRows[0];

  const ok = await Bun.password.verify(password, user.password);
  if (!ok) {
    return c.json({
      success: false,
      message: 'Incorrect username/password.',
    });
  }

  const pegawai = await sql`
    SELECT rowid, id, divisi, jabatan
    FROM data_pegawai
    WHERE id_user = ${user.id}
      AND COALESCE(status, 'Exist') = 'Exist'
  `;

  const rowidList = pegawai.map((p: any) => p.rowid);
  const idList = pegawai.map((p: any) => p.id);

  const divisiList = [
    ...new Set(pegawai.map((p: any) => p.divisi).filter((d: any) => d)),
  ];
  const divisi = divisiList.join(',');
  const jabatan = pegawai[0]?.jabatan ?? '';

  return c.json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: 'user',
      id_peg: rowidList,
      id_ff: idList,
      divisi,
      jabatan,
    },
  });
}

export async function getModulesByUser(c: Context) {
  const id_user = c.req.param('id_user');

  const modules = await sql`
    SELECT DISTINCT am.id_modul, am.nama_modul, am.icons2
    FROM app_role_menu arm
    JOIN app_modul am ON am.id_modul = arm.id_modul
    WHERE arm.id_user = ${id_user}
  `;

  return c.json({
    success: true,
    modules,
  });
}
