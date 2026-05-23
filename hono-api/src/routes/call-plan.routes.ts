import { Hono } from 'hono';
import {
  create,
  eligibleDoctors,
  institutions,
  list,
  remove,
} from '../controllers/call-plan.controller';
import { requireAuth } from '../middleware/auth';
import { validateJson, validateParams, validateQuery } from '../middleware/validator';
import { requireAppVersion } from '../middleware/version-gate';
import type { AppEnv } from '../types/app-env';
import {
  callPlanCreateBodySchema,
  callPlanEligibleDoctorsQuerySchema,
  callPlanIdParamSchema,
  callPlanInstitutionsQuerySchema,
  callPlanListQuerySchema,
} from '../validations/call-plan.validation';

const callPlan = new Hono<AppEnv>();

callPlan.use('*', requireAuth);

// Static paths dulu (sebelum :id param route) supaya tidak ambiguous.
callPlan.get(
  '/eligible-doctors',
  validateQuery(callPlanEligibleDoctorsQuerySchema),
  eligibleDoctors,
);
callPlan.get('/institutions', validateQuery(callPlanInstitutionsQuerySchema), institutions);
callPlan.get('/', validateQuery(callPlanListQuerySchema), list);

// Write endpoints — gated X-App-Version.
callPlan.post('/', requireAppVersion, validateJson(callPlanCreateBodySchema), create);
callPlan.delete('/:id', requireAppVersion, validateParams(callPlanIdParamSchema), remove);

export default callPlan;
