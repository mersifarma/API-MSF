import { Hono } from 'hono';
import {
  batchApprove,
  listDetails,
  listPegawai,
} from '../controllers/approval-call-plan.controller';
import { requireAuth } from '../middleware/auth';
import { requireJabatan } from '../middleware/rbac';
import { validateJson, validateQuery } from '../middleware/validator';
import { requireAppVersion } from '../middleware/version-gate';
import type { AppEnv } from '../types/app-env';
import {
  approvalPlanBatchBodySchema,
  approvalPlanDetailsQuerySchema,
  approvalPlanPegawaiQuerySchema,
} from '../validations/approval-call-plan.validation';

const approvalCallPlan = new Hono<AppEnv>();

// Semua endpoint butuh auth + jabatan approver (DM/ACT. DM/RSM/MM).
approvalCallPlan.use('*', requireAuth);
approvalCallPlan.use('*', requireJabatan(['DM', 'ACT. DM', 'RSM', 'MM']));

// Static path dulu (sebelum '/').
approvalCallPlan.get('/pegawai', validateQuery(approvalPlanPegawaiQuerySchema), listPegawai);
approvalCallPlan.get('/', validateQuery(approvalPlanDetailsQuerySchema), listDetails);

// Write — gated X-App-Version.
approvalCallPlan.post(
  '/batch',
  requireAppVersion,
  validateJson(approvalPlanBatchBodySchema),
  batchApprove,
);

export default approvalCallPlan;
