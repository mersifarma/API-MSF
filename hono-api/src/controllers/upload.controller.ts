import type { Context } from 'hono';
import { getCurrentUser } from '../middleware/auth';
import {
  confirmUpload,
  getAssetById,
  listAssets,
  requestPresign,
  softDeleteAsset,
} from '../services/upload.service';
import {
  getValidJson,
  getValidParam,
  getValidQuery,
  sendPaginated,
  sendSuccess,
} from '../utils/response';
import type {
  UploadAssetIdParam,
  UploadListQuery,
  UploadPresignBody,
} from '../validations/upload.validation';

export async function presign(c: Context) {
  const payload = getCurrentUser(c);
  const body = getValidJson<UploadPresignBody>(c);
  const data = await requestPresign({
    createdBy: payload.id_peg,
    assetType: body.asset_type,
    fileName: body.file_name,
    mimeType: body.mime_type,
    title: body.title,
    sizeBytes: body.size_bytes,
  });
  return sendSuccess(c, data, 201);
}

export async function confirm(c: Context) {
  const payload = getCurrentUser(c);
  const { id } = getValidParam<UploadAssetIdParam>(c);
  const data = await confirmUpload(id, payload.id_peg);
  return sendSuccess(c, data);
}

export async function get(c: Context) {
  const { id } = getValidParam<UploadAssetIdParam>(c);
  const data = await getAssetById(id);
  return sendSuccess(c, data);
}

export async function list(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<UploadListQuery>(c);
  const { data, total, page, limit } = await listAssets({
    assetType: q.asset_type,
    status: q.status,
    createdBy: q.mine ? payload.id_peg : undefined,
    page: q.page,
    limit: q.limit,
  });
  return sendPaginated(c, data, { total, page, limit });
}

export async function remove(c: Context) {
  const payload = getCurrentUser(c);
  const { id } = getValidParam<UploadAssetIdParam>(c);
  const data = await softDeleteAsset(id, payload.id_peg);
  return sendSuccess(c, data);
}
