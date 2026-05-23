import { Hono } from 'hono';
import {
  appConfig,
  appVersion,
  dokter,
  dokterNonTarget,
  dokterSpecs,
  modulForCurrentUser,
  pegawaiLookup,
  products,
} from '../controllers/master.controller';
import { requireAuth } from '../middleware/auth';
import { validateQuery } from '../middleware/validator';
import type { AppEnv } from '../types/app-env';
import {
  dokterListQuerySchema,
  dokterNonTargetQuerySchema,
  pegawaiLookupQuerySchema,
  productListQuerySchema,
} from '../validations/master.validation';

const master = new Hono<AppEnv>();

// Semua endpoint master butuh auth.
master.use('*', requireAuth);

master.get('/app-version', appVersion);
master.get('/app-config', appConfig);
master.get('/modul', modulForCurrentUser);
master.get('/dokter/specs', dokterSpecs);
master.get('/dokter/non-target', validateQuery(dokterNonTargetQuerySchema), dokterNonTarget);
master.get('/dokter', validateQuery(dokterListQuerySchema), dokter);
master.get('/products', validateQuery(productListQuerySchema), products);
master.get('/pegawai/lookup', validateQuery(pegawaiLookupQuerySchema), pegawaiLookup);

export default master;
