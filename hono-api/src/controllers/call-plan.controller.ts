import type { Context } from 'hono';
import { getCurrentUser } from '../middleware/auth';
import {
  createCallPlan,
  deleteCallPlan,
  listCallPlan,
  listEligibleDoctors,
  listInstitutions,
} from '../services/call-plan.service';
import { getValidJson, getValidParam, getValidQuery, sendSuccess } from '../utils/response';
import type {
  CallPlanCreateBody,
  CallPlanEligibleDoctorsQuery,
  CallPlanIdParam,
  CallPlanInstitutionsQuery,
  CallPlanListQuery,
} from '../validations/call-plan.validation';

export async function list(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<CallPlanListQuery>(c);
  const data = await listCallPlan({
    viewerIdPeg: payload.id_peg,
    viewerJabatan: payload.jabatan,
    periode: q.periode,
    date: q.date,
    search: q.search,
  });
  return sendSuccess(c, data);
}

export async function eligibleDoctors(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<CallPlanEligibleDoctorsQuery>(c);
  const data = await listEligibleDoctors({
    viewerIdPeg: payload.id_peg,
    viewerJabatan: payload.jabatan,
    periode: q.periode,
    search: q.search,
    limit: q.limit,
  });
  return sendSuccess(c, data);
}

export async function institutions(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<CallPlanInstitutionsQuery>(c);
  const data = await listInstitutions({
    viewerIdPeg: payload.id_peg,
    viewerJabatan: payload.jabatan,
    idMcl: q.id_mcl,
  });
  return sendSuccess(c, data);
}

export async function create(c: Context) {
  const payload = getCurrentUser(c);
  const body = getValidJson<CallPlanCreateBody>(c);
  const data = await createCallPlan({
    idPeg: payload.id_peg,
    idMcl: body.id_mcl,
    tglPlan: body.tgl_plan,
    waktu: body.waktu,
    institusi: body.institusi,
    alamatPraktek: body.alamat_praktek,
    koordinatInstitusi: body.koordinat_institusi,
    productList: body.product_list,
    keterangan: body.keterangan,
  });
  return sendSuccess(c, data, 201);
}

export async function remove(c: Context) {
  const payload = getCurrentUser(c);
  const { id } = getValidParam<CallPlanIdParam>(c);
  const data = await deleteCallPlan({
    callPlanId: id,
    viewerIdPeg: payload.id_peg,
  });
  return sendSuccess(c, data);
}
