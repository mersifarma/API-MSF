import { Hono } from 'hono';
import {
  batchApprove,
  listDetails,
  listPegawai,
} from '../controllers/approval-call-list.controller';
import { requireAuth } from '../middleware/auth';
import { requireJabatan } from '../middleware/rbac';
import { validateJson, validateQuery } from '../middleware/validator';
import { requireAppVersion } from '../middleware/version-gate';
import type { AppEnv } from '../types/app-env';
import {
  approvalBatchBodySchema,
  approvalDetailsQuerySchema,
  approvalPegawaiQuerySchema,
} from '../validations/approval-call-list.validation';

const approvalCallList = new Hono<AppEnv>();

// Semua endpoint butuh auth + jabatan approver (DM/ACT. DM/RSM/MM).
approvalCallList.use('*', requireAuth);
approvalCallList.use('*', requireJabatan(['DM', 'ACT. DM', 'RSM', 'MM']));

// Static path dulu (sebelum '/').
approvalCallList.get('/pegawai', validateQuery(approvalPegawaiQuerySchema), listPegawai);
approvalCallList.get('/', validateQuery(approvalDetailsQuerySchema), listDetails);

// Write — gated X-App-Version.
approvalCallList.post(
  '/batch',
  requireAppVersion,
  validateJson(approvalBatchBodySchema),
  batchApprove,
);

export default approvalCallList;
