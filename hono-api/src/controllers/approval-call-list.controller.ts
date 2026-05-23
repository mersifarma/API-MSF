import type { Context } from 'hono';
import { getCurrentUser } from '../middleware/auth';
import {
  batchApproveCallList,
  listCallListDetailsForPegawai,
  listPegawaiPending,
} from '../services/approval-call-list.service';
import { getValidJson, getValidQuery, sendSuccess } from '../utils/response';
import type {
  ApprovalBatchBody,
  ApprovalDetailsQuery,
  ApprovalPegawaiQuery,
} from '../validations/approval-call-list.validation';

export async function listPegawai(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<ApprovalPegawaiQuery>(c);
  const data = await listPegawaiPending({
    approverIdPeg: payload.id_peg,
    approverJabatan: payload.jabatan,
    periode: q.periode,
  });
  return sendSuccess(c, data);
}

export async function listDetails(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<ApprovalDetailsQuery>(c);
  const data = await listCallListDetailsForPegawai({
    approverIdPeg: payload.id_peg,
    approverJabatan: payload.jabatan,
    targetIdPeg: q.id_peg,
    periode: q.periode,
  });
  return sendSuccess(c, data);
}

export async function batchApprove(c: Context) {
  const payload = getCurrentUser(c);
  const body = getValidJson<ApprovalBatchBody>(c);
  const data = await batchApproveCallList({
    approverIdPeg: payload.id_peg,
    approverJabatan: payload.jabatan,
    approvals: body.approvals,
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
