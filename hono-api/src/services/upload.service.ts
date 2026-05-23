/**
 * Service untuk Media Upload (presigned URL flow).
 *
 * Flow:
 *   1. requestPresign({ assetType, fileName, mimeType, ... })
 *      → INSERT row dengan status='pending', return { assetId, presignedUrl, ... }
 *   2. Mobile PUT file ke `presignedUrl` (langsung ke S3, tidak lewat server).
 *   3. confirmUpload(assetId, idPeg)
 *      → status='pending' → 'active'. Reject kalau bukan owner / sudah active.
 *   4. Asset URL bisa di-attach ke `call_plan_actual.foto`, dst.
 *
 * Catatan: tidak ada upload langsung lewat server (multipart) — mobile RN
 * pakai presigned URL agar bandwidth server tidak terpakai.
 */

import { and, eq, desc, count as countSql, type SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../config/database';
import { buildS3Url, generatePresignedUrl } from '../config/s3';
import { media_assets, type MediaAsset } from '../db/schema/media-assets';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';

// ---------------------------------------------------------------------------
// MIME whitelist per assetType
// ---------------------------------------------------------------------------

const MIME_WHITELIST: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
  presentation: [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  spreadsheet: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
};

const PRESIGN_EXPIRES_SECONDS = 900; // 15 minutes

function getExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
}

// ---------------------------------------------------------------------------
// REQUEST PRESIGN
// ---------------------------------------------------------------------------

export type RequestPresignInput = {
  createdBy: number; // id_peg pemilik upload
  fileName: string;
  mimeType: string;
  assetType: string;
  title?: string;
  sizeBytes?: number;
};

export type PresignResult = {
  assetId: string;
  presignedUrl: string;
  s3Key: string;
  url: string;
  expiresAt: string;
};

export async function requestPresign(input: RequestPresignInput): Promise<PresignResult> {
  const allowedTypes = MIME_WHITELIST[input.assetType];
  if (!allowedTypes) {
    throw new ValidationError(
      `Invalid assetType: ${input.assetType}. Must be one of: ${Object.keys(MIME_WHITELIST).join(', ')}`,
    );
  }
  if (!allowedTypes.includes(input.mimeType)) {
    throw new ValidationError(
      `MIME type '${input.mimeType}' is not allowed for assetType '${input.assetType}'`,
    );
  }

  const ext = getExtension(input.fileName);
  const s3Key = `uploads/${input.assetType}/${input.createdBy}/${Date.now()}-${nanoid(8)}.${ext}`;
  const url = buildS3Url(s3Key);
  const presignedUrl = await generatePresignedUrl(s3Key, input.mimeType, PRESIGN_EXPIRES_SECONDS);

  const [asset] = await db
    .insert(media_assets)
    .values({
      asset_type: input.assetType,
      original_name: input.fileName,
      s3_key: s3Key,
      url,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes ?? null,
      title: input.title ?? null,
      status: 'pending',
      created_by: input.createdBy,
    })
    .returning();

  const expiresAt = new Date(Date.now() + PRESIGN_EXPIRES_SECONDS * 1000).toISOString();

  return {
    assetId: asset.id,
    presignedUrl,
    s3Key,
    url: asset.url,
    expiresAt,
  };
}

// ---------------------------------------------------------------------------
// CONFIRM UPLOAD — pending → active
// ---------------------------------------------------------------------------

export async function confirmUpload(assetId: string, idPeg: number): Promise<MediaAsset> {
  const [asset] = await db
    .select()
    .from(media_assets)
    .where(and(eq(media_assets.id, assetId), eq(media_assets.is_deleted, false)))
    .limit(1);

  if (!asset) {
    throw new NotFoundError(`Asset ${assetId} tidak ditemukan`);
  }
  if (asset.created_by !== idPeg) {
    throw new ForbiddenError('Tidak boleh confirm asset milik pegawai lain');
  }
  if (asset.status !== 'pending') {
    throw new ConflictError('Asset sudah dikonfirmasi.', 'ALREADY_CONFIRMED');
  }

  const [updated] = await db
    .update(media_assets)
    .set({ status: 'active', updated_at: new Date() })
    .where(eq(media_assets.id, assetId))
    .returning();

  return updated;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export type ListAssetsOpts = {
  assetType?: string;
  status?: string;
  createdBy?: number; // filter ke owner tertentu (default: viewer)
  page: number;
  limit: number;
};

export async function listAssets(opts: ListAssetsOpts): Promise<{
  data: MediaAsset[];
  total: number;
  page: number;
  limit: number;
}> {
  const conds: SQL[] = [eq(media_assets.is_deleted, false)];
  if (opts.assetType) conds.push(eq(media_assets.asset_type, opts.assetType));
  if (opts.status) conds.push(eq(media_assets.status, opts.status));
  if (opts.createdBy != null) conds.push(eq(media_assets.created_by, opts.createdBy));

  const [{ n }] = await db
    .select({ n: countSql() })
    .from(media_assets)
    .where(and(...conds));
  const total = Number(n ?? 0);

  const data = await db
    .select()
    .from(media_assets)
    .where(and(...conds))
    .orderBy(desc(media_assets.created_at))
    .limit(opts.limit)
    .offset((opts.page - 1) * opts.limit);

  return { data, total, page: opts.page, limit: opts.limit };
}

// ---------------------------------------------------------------------------
// GET BY ID
// ---------------------------------------------------------------------------

export async function getAssetById(id: string): Promise<MediaAsset> {
  const [asset] = await db
    .select()
    .from(media_assets)
    .where(and(eq(media_assets.id, id), eq(media_assets.is_deleted, false)))
    .limit(1);
  if (!asset) {
    throw new NotFoundError(`Asset ${id} tidak ditemukan`);
  }
  return asset;
}

// ---------------------------------------------------------------------------
// SOFT DELETE — owner only
// ---------------------------------------------------------------------------

export async function softDeleteAsset(
  id: string,
  idPeg: number,
): Promise<{ id: string; deleted: true }> {
  const [asset] = await db
    .select()
    .from(media_assets)
    .where(and(eq(media_assets.id, id), eq(media_assets.is_deleted, false)))
    .limit(1);

  if (!asset) {
    throw new NotFoundError(`Asset ${id} tidak ditemukan`);
  }
  if (asset.created_by !== idPeg) {
    throw new ForbiddenError('Tidak boleh delete asset milik pegawai lain');
  }

  await db
    .update(media_assets)
    .set({
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: idPeg,
      updated_at: new Date(),
    })
    .where(eq(media_assets.id, id));

  return { id, deleted: true };
}
