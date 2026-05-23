import { Hono } from 'hono';
import {
  batchApprove,
  listDetails,
  listPegawai,
} from '../controllers/approval-call-actual.controller';
import { requireAuth } from '../middleware/auth';
import { requireJabatan } from '../middleware/rbac';
import { validateJson, validateQuery } from '../middleware/validator';
import { requireAppVersion } from '../middleware/version-gate';
import type { AppEnv } from '../types/app-env';
import {
  approvalActualBatchBodySchema,
  approvalActualDetailsQuerySchema,
  approvalActualPegawaiQuerySchema,
} from '../validations/approval-call-actual.validation';

const approvalCallActual = new Hono<AppEnv>();

approvalCallActual.use('*', requireAuth);
approvalCallActual.use('*', requireJabatan(['DM', 'ACT. DM', 'RSM', 'MM']));

approvalCallActual.get('/pegawai', validateQuery(approvalActualPegawaiQuerySchema), listPegawai);
approvalCallActual.get('/', validateQuery(approvalActualDetailsQuerySchema), listDetails);

approvalCallActual.post(
  '/batch',
  requireAppVersion,
  validateJson(approvalActualBatchBodySchema),
  batchApprove,
);

export default approvalCallActual;
