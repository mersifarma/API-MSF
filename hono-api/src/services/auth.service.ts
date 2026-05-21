import { and, eq, asc } from 'drizzle-orm';
import { db } from '../config/database';
import { data_pegawai, users } from '../db/schema/master';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../lib/errors';

export type UserRow = typeof users.$inferSelect;
export type PegawaiRow = typeof data_pegawai.$inferSelect;

export type SafeUser = Omit<UserRow, 'password' | 'password_view' | 'remember_token'>;

export function stripUser(user: UserRow): SafeUser {
  const { password, password_view, remember_token, ...rest } = user;
  return rest;
}

export async function verifyCredentials(username: string, password: string): Promise<UserRow> {
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (!user) {
    throw new UnauthorizedError('Username atau password salah');
  }

  if (user.status && user.status.toUpperCase() !== 'ACTIVE') {
    throw new UnauthorizedError('Akun tidak aktif');
  }

  const ok = await Bun.password.verify(password, user.password);
  if (!ok) {
    throw new UnauthorizedError('Username atau password salah');
  }

  return user;
}

export async function getPegawaiByUserId(userId: number): Promise<PegawaiRow[]> {
  return db
    .select()
    .from(data_pegawai)
    .where(eq(data_pegawai.id_user, userId))
    .orderBy(asc(data_pegawai.rowid));
}

export async function getPegawaiForUser(userId: number, idPeg: number): Promise<PegawaiRow> {
  const [peg] = await db
    .select()
    .from(data_pegawai)
    .where(and(eq(data_pegawai.id_user, userId), eq(data_pegawai.rowid, idPeg)))
    .limit(1);

  if (!peg) {
    throw new ForbiddenError('Pegawai ini bukan milik user yang sedang login');
  }
  return peg;
}

export async function getPegawaiById(idPeg: number): Promise<PegawaiRow> {
  const [peg] = await db.select().from(data_pegawai).where(eq(data_pegawai.rowid, idPeg)).limit(1);

  if (!peg) {
    throw new NotFoundError(`Pegawai dengan rowid ${idPeg} tidak ditemukan`);
  }
  return peg;
}

export async function getUserById(userId: number): Promise<UserRow> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new NotFoundError(`User dengan id ${userId} tidak ditemukan`);
  }
  return user;
}
