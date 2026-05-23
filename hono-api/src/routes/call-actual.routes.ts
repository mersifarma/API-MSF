import { Hono } from 'hono';
import { details, list, save, unplan } from '../controllers/call-actual.controller';
import { requireAuth } from '../middleware/auth';
import { validateJson, validateParams, validateQuery } from '../middleware/validator';
import { requireAppVersion } from '../middleware/version-gate';
import type { AppEnv } from '../types/app-env';
import {
  callActualIdParamSchema,
  callActualListQuerySchema,
  callActualSaveBodySchema,
  callActualUnplanBodySchema,
} from '../validations/call-actual.validation';

const callActual = new Hono<AppEnv>();

callActual.use('*', requireAuth);

callActual.get('/', validateQuery(callActualListQuerySchema), list);
callActual.get('/:id', validateParams(callActualIdParamSchema), details);

callActual.post('/unplan', requireAppVersion, validateJson(callActualUnplanBodySchema), unplan);
callActual.patch(
  '/:id',
  requireAppVersion,
  validateParams(callActualIdParamSchema),
  validateJson(callActualSaveBodySchema),
  save,
);

export default callActual;
