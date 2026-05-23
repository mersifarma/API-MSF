import { Hono } from 'hono';
import { confirm, get, list, presign, remove } from '../controllers/upload.controller';
import { requireAuth } from '../middleware/auth';
import { validateJson, validateParams, validateQuery } from '../middleware/validator';
import { requireAppVersion } from '../middleware/version-gate';
import type { AppEnv } from '../types/app-env';
import {
  uploadAssetIdParamSchema,
  uploadListQuerySchema,
  uploadPresignBodySchema,
} from '../validations/upload.validation';

const upload = new Hono<AppEnv>();

upload.use('*', requireAuth);

upload.get('/', validateQuery(uploadListQuerySchema), list);
upload.get('/:id', validateParams(uploadAssetIdParamSchema), get);

upload.post('/presign', requireAppVersion, validateJson(uploadPresignBodySchema), presign);
upload.post('/:id/confirm', requireAppVersion, validateParams(uploadAssetIdParamSchema), confirm);
upload.delete('/:id', requireAppVersion, validateParams(uploadAssetIdParamSchema), remove);

export default upload;
