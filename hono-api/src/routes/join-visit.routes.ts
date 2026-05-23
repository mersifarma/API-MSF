import { Hono } from 'hono';
import { getSupervisors } from '../controllers/join-visit.controller';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types/app-env';

const joinVisit = new Hono<AppEnv>();

joinVisit.use('*', requireAuth);

// GET /api/join-visit/supervisors — list atasan yang bisa diundang join visit.
// Tidak ada RBAC `requireJabatan` — semua jabatan boleh akses; service yang
// tentukan apa yang dikembalikan (MR → DM+RSM, DM → RSM, RSM → MM, MM → []).
joinVisit.get('/supervisors', getSupervisors);

export default joinVisit;
