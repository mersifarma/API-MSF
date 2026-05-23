import type { Context } from 'hono';
import { getCurrentUser } from '../middleware/auth';
import {
  batchApproveCallActual,
  listCallActualDetailsForPegawai,
  listPegawaiPendingActual,
} from '../services/approval-call-actual.service';
import { getValidJson, getValidQuery, sendSuccess } from '../utils/response';
import type {
  ApprovalActualBatchBody,
  ApprovalActualDetailsQuery,
  ApprovalActualPegawaiQuery,
} from '../validations/approval-call-actual.validation';

export async function listPegawai(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<ApprovalActualPegawaiQuery>(c);
  const data = await listPegawaiPendingActual({
    approverIdPeg: payload.id_peg,
    approverJabatan: payload.jabatan,
    periode: q.periode,
  });
  return sendSuccess(c, data);
}

export async function listDetails(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<ApprovalActualDetailsQuery>(c);
  const data = await listCallActualDetailsForPegawai({
    approverIdPeg: payload.id_peg,
    approverJabatan: payload.jabatan,
    targetIdPeg: q.id_peg,
    periode: q.periode,
  });
  return sendSuccess(c, data);
}

export async function batchApprove(c: Context) {
  const payload = getCurrentUser(c);
  const body = getValidJson<ApprovalActualBatchBody>(c);
  const data = await batchApproveCallActual({
    approverIdPeg: payload.id_peg,
    approverJabatan: payload.jabatan,
    approvals: body.approvals,
  });
  return sendSuccess(c, data);
}
