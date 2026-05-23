import type { Context } from 'hono';
import { getCurrentUser } from '../middleware/auth';
import { listSupervisors } from '../services/join-visit.service';
import { sendSuccess } from '../utils/response';

export async function getSupervisors(c: Context) {
  const payload = getCurrentUser(c);
  const data = await listSupervisors(payload.id_peg, payload.jabatan);
  return sendSuccess(c, data);
}
