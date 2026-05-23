import type { Context } from 'hono';
import { getCurrentUser } from '../middleware/auth';
import {
  getCallActualDetails,
  listCallActual,
  saveActual,
  saveUnplannedActual,
} from '../services/call-actual.service';
import { getValidJson, getValidParam, getValidQuery, sendSuccess } from '../utils/response';
import type {
  CallActualIdParam,
  CallActualListQuery,
  CallActualSaveBody,
  CallActualUnplanBody,
} from '../validations/call-actual.validation';

export async function list(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<CallActualListQuery>(c);
  const data = await listCallActual({
    viewerIdPeg: payload.id_peg,
    viewerJabatan: payload.jabatan,
    periode: q.periode,
    date: q.date,
    search: q.search,
  });
  return sendSuccess(c, data);
}

export async function details(c: Context) {
  const { id } = getValidParam<CallActualIdParam>(c);
  const data = await getCallActualDetails(id);
  return sendSuccess(c, data);
}

export async function save(c: Context) {
  const payload = getCurrentUser(c);
  const { id } = getValidParam<CallActualIdParam>(c);
  const body = getValidJson<CallActualSaveBody>(c);
  const data = await saveActual({
    callPlanId: id,
    viewerIdPeg: payload.id_peg,
    koorVisit: body.koor_visit,
    tglActual: body.tgl_actual,
    waktuActual: body.waktu_actual,
    status: body.status,
    sttKoor: body.stt_koor,
    keterangan: body.keterangan,
    joinVisit: body.join_visit,
    joinVisitId: body.join_visit_id,
    foto: body.foto,
    tandaTangan: body.tanda_tangan,
  });
  return sendSuccess(c, data);
}

export async function unplan(c: Context) {
  const payload = getCurrentUser(c);
  const body = getValidJson<CallActualUnplanBody>(c);
  const data = await saveUnplannedActual({
    viewerIdPeg: payload.id_peg,
    idMcl: body.id_mcl,
    namaDokter: body.nama_dokter,
    spec: body.spec,
    segmenMd: body.segmen_md,
    class: body.class,
    institusi: body.institusi,
    alamatPraktek: body.alamat_praktek,
    koordinatInstitusi: body.koordinat_institusi,
    koorVisit: body.koor_visit,
    tglActual: body.tgl_actual,
    waktuActual: body.waktu_actual,
    status: body.status,
    sttKoor: body.stt_koor,
    keterangan: body.keterangan,
    joinVisit: body.join_visit,
    joinVisitId: body.join_visit_id,
    productList: body.product_list,
    foto: body.foto,
    tandaTangan: body.tanda_tangan,
  });
  return sendSuccess(c, data, 201);
}
