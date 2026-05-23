import type { Context } from 'hono';
import { getCurrentUser } from '../middleware/auth';
import {
  batchApproveCallPlan,
  listCallPlanDetailsForPegawai,
  listPegawaiPendingPlan,
} from '../services/approval-call-plan.service';
import { getValidJson, getValidQuery, sendSuccess } from '../utils/response';
import type {
  ApprovalPlanBatchBody,
  ApprovalPlanDetailsQuery,
  ApprovalPlanPegawaiQuery,
} from '../validations/approval-call-plan.validation';

export async function listPegawai(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<ApprovalPlanPegawaiQuery>(c);
  const data = await listPegawaiPendingPlan({
    approverIdPeg: payload.id_peg,
    approverJabatan: payload.jabatan,
    periode: q.periode,
  });
  return sendSuccess(c, data);
}

export async function listDetails(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<ApprovalPlanDetailsQuery>(c);
  const data = await listCallPlanDetailsForPegawai({
    approverIdPeg: payload.id_peg,
    approverJabatan: payload.jabatan,
    targetIdPeg: q.id_peg,
    periode: q.periode,
  });
  return sendSuccess(c, data);
}

export async function batchApprove(c: Context) {
  const payload = getCurrentUser(c);
  const body = getValidJson<ApprovalPlanBatchBody>(c);
  const data = await batchApproveCallPlan({
    approverIdPeg: payload.id_peg,
    approverJabatan: payload.jabatan,
    approvals: body.approvals,
  });
  return sendSuccess(c, data);
}
