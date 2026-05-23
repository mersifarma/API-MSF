import type { Context } from 'hono';
import { JOIN_VISIT_RADIUS_METERS, BATAS_HARI_KERJA_LIST } from '../lib/constants';
import { getCurrentUser } from '../middleware/auth';
import {
  getLatestAppVersion,
  getModulesForUser,
  listDokter,
  listDokterNonTarget,
  listDokterSpecs,
  listProducts,
  lookupPegawai,
} from '../services/master.service';
import { getValidQuery, sendPaginated, sendSuccess } from '../utils/response';
import type {
  DokterListQuery,
  DokterNonTargetQuery,
  PegawaiLookupQuery,
  ProductListQuery,
} from '../validations/master.validation';

// GET /api/server-date
export function serverDate(c: Context) {
  const now = new Date();
  return sendSuccess(c, {
    iso: now.toISOString(),
    epoch_ms: now.getTime(),
    timezone: 'Asia/Jakarta',
    tz_offset_minutes: 420, // WIB = UTC+7
  });
}

// GET /api/master/app-version
export async function appVersion(c: Context) {
  const data = await getLatestAppVersion();
  return sendSuccess(c, data);
}

// GET /api/master/modul — pakai user dari JWT (jangan terima id di URL)
export async function modulForCurrentUser(c: Context) {
  const payload = getCurrentUser(c);
  const data = await getModulesForUser(payload.sub);
  return sendSuccess(c, data);
}

// GET /api/master/app-config
export function appConfig(c: Context) {
  return sendSuccess(c, {
    join_visit_radius_meters: JOIN_VISIT_RADIUS_METERS,
    batas_hari_kerja_list: BATAS_HARI_KERJA_LIST,
    // Field-field di bawah akan diisi saat cluster terkait di-port:
    // notification_interval_minutes: ...   (cluster 5)
    // batas_jam_plan: ...                  (cluster 3)
    // batas_hari_actual / batas_jam_actual (cluster 4)
    // unvisit_days_back / unvisit_days_forward (cluster 4)
  });
}

// GET /api/master/dokter/specs
export async function dokterSpecs(c: Context) {
  const data = await listDokterSpecs();
  return sendSuccess(c, data);
}

// GET /api/master/products
export async function products(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<ProductListQuery>(c);
  const data = await listProducts({
    search: q.search,
    divisi: q.divisi ?? payload.divisi ?? undefined,
    includeInactive: q.include_inactive,
  });
  return sendSuccess(c, data);
}

// GET /api/master/pegawai/lookup
export async function pegawaiLookup(c: Context) {
  const q = getValidQuery<PegawaiLookupQuery>(c);
  const data = await lookupPegawai(q.id_peg);
  return sendSuccess(c, data);
}

// GET /api/master/dokter
export async function dokter(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<DokterListQuery>(c);
  const { rows, total } = await listDokter({
    viewerIdPeg: payload.id_peg,
    viewerJabatan: payload.jabatan,
    search: q.search,
    spec: q.spec,
    class: q.class,
    segmen: q.segmen,
    page: q.page,
    limit: q.limit,
    includeInactive: q.include_inactive,
  });
  return sendPaginated(c, rows, { total, page: q.page, limit: q.limit });
}

// GET /api/master/dokter/non-target
export async function dokterNonTarget(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<DokterNonTargetQuery>(c);
  const data = await listDokterNonTarget({
    viewerIdPeg: payload.id_peg,
    search: q.search,
    limit: q.limit,
  });
  return sendSuccess(c, data);
}
