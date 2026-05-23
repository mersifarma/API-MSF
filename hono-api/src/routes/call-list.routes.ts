import { Hono } from 'hono';
import {
  count,
  create,
  eligible,
  history,
  list,
  pendingCount,
  remove,
  target,
  update,
} from '../controllers/call-list.controller';
import { requireAuth } from '../middleware/auth';
import { validateJson, validateParams, validateQuery } from '../middleware/validator';
import { requireAppVersion } from '../middleware/version-gate';
import type { AppEnv } from '../types/app-env';
import {
  callListCountQuerySchema,
  callListCreateBodySchema,
  callListEligibleQuerySchema,
  callListIdParamSchema,
  callListListQuerySchema,
  callListTargetQuerySchema,
  callListUpdateBodySchema,
} from '../validations/call-list.validation';

const callList = new Hono<AppEnv>();

callList.use('*', requireAuth);

// Static paths dulu (sebelum :id parameter route) supaya tidak ambiguous.
callList.get('/eligible', validateQuery(callListEligibleQuerySchema), eligible);
callList.get('/count', validateQuery(callListCountQuerySchema), count);
callList.get('/target', validateQuery(callListTargetQuerySchema), target);
callList.get('/pending-count', pendingCount);
callList.get('/:id/history', validateParams(callListIdParamSchema), history);
callList.get('/', validateQuery(callListListQuerySchema), list);

// Write endpoints — semua gated `X-App-Version` (legacy parity).
callList.post('/', requireAppVersion, validateJson(callListCreateBodySchema), create);
callList.patch(
  '/:id',
  requireAppVersion,
  validateParams(callListIdParamSchema),
  validateJson(callListUpdateBodySchema),
  update,
);
callList.delete('/:id', requireAppVersion, validateParams(callListIdParamSchema), remove);

export default callList;
