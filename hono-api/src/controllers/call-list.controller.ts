import type { Context } from 'hono';
import { getCurrentUser } from '../middleware/auth';
import {
  createCallList,
  deleteCallList,
  getCallListCount,
  getCallTarget,
  getPendingApprovalCount,
  listCallList,
  listCallListHistory,
  listEligibleDokter,
  updateCallList,
} from '../services/call-list.service';
import { currentPeriode } from '../utils/date';
import { getValidJson, getValidParam, getValidQuery, sendSuccess } from '../utils/response';
import type {
  CallListCountQuery,
  CallListCreateBody,
  CallListEligibleQuery,
  CallListIdParam,
  CallListListQuery,
  CallListTargetQuery,
  CallListUpdateBody,
} from '../validations/call-list.validation';

export async function list(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<CallListListQuery>(c);
  const data = await listCallList(payload.id_peg, q.periode);
  return sendSuccess(c, data);
}

export async function eligible(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<CallListEligibleQuery>(c);
  const data = await listEligibleDokter({
    viewerIdPeg: payload.id_peg,
    viewerJabatan: payload.jabatan,
    periode: q.periode,
    search: q.search,
    limit: q.limit,
  });
  return sendSuccess(c, data);
}

export async function count(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<CallListCountQuery>(c);
  const data = await getCallListCount(
    payload.jabatan,
    payload.divisi ?? '',
    payload.id_peg,
    q.periode,
  );
  return sendSuccess(c, data);
}

export async function target(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<CallListTargetQuery>(c);
  const periode = q.periode ?? currentPeriode();
  const t = await getCallTarget(payload.jabatan, payload.divisi ?? '', periode);
  return sendSuccess(c, {
    periode,
    jabatan: payload.jabatan,
    divisi: payload.divisi,
    target_dokter: t?.dokter ?? null,
    target_non_dokter: t?.non_dokter ?? null,
  });
}

export async function pendingCount(c: Context) {
  const payload = getCurrentUser(c);
  const data = await getPendingApprovalCount(payload.id_peg);
  return sendSuccess(c, data);
}

export async function history(c: Context) {
  const payload = getCurrentUser(c);
  const { id } = getValidParam<CallListIdParam>(c);
  const data = await listCallListHistory(id, payload.id_peg);
  return sendSuccess(c, data);
}

export async function create(c: Context) {
  const payload = getCurrentUser(c);
  const body = getValidJson<CallListCreateBody>(c);
  const data = await createCallList({
    idPeg: payload.id_peg,
    jabatan: payload.jabatan,
    divisi: payload.divisi ?? '',
    idMcl: body.id_mcl,
    periode: body.periode,
  });
  return sendSuccess(c, data, 201);
}

export async function update(c: Context) {
  const payload = getCurrentUser(c);
  const { id } = getValidParam<CallListIdParam>(c);
  const body = getValidJson<CallListUpdateBody>(c);
  const data = await updateCallList({
    callListId: id,
    viewerIdPeg: payload.id_peg,
    viewerJabatan: payload.jabatan,
    viewerDivisi: payload.divisi ?? '',
    idMcl: body.id_mcl,
    reason: body.reason,
    ipAddress:
      c.req.header('X-Forwarded-For') ??
      c.req.header('x-forwarded-for') ??
      c.req.header('X-Real-IP') ??
      c.req.header('x-real-ip') ??
      null,
    userAgent: c.req.header('User-Agent') ?? c.req.header('user-agent') ?? null,
  });
  return sendSuccess(c, data);
}

export async function remove(c: Context) {
  const payload = getCurrentUser(c);
  const { id } = getValidParam<CallListIdParam>(c);
  const data = await deleteCallList({
    callListId: id,
    viewerIdPeg: payload.id_peg,
  });
  return sendSuccess(c, data);
}
