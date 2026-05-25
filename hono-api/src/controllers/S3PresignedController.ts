import type { Context } from 'hono';
import { customAlphabet } from 'nanoid';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sql } from '../config/database';
import { env } from '../config/env';

const randomStr = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 8);

function makeS3Client(): S3Client {
  return new S3Client({
    endpoint: env.AWS_S3_ENDPOINT,
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

function buildPublicUrl(s3Key: string): string {
  return `https://${env.AWS_S3_BUCKET}.is3.cloudhost.id/${s3Key}`;
}

export async function getPresignedUrl(c: Context) {
  const body = await c.req.json();
  const { extensi, size, type } = body;

  // Validasi sederhana (sesuai Laravel validate)
  if (!body.nama_file || typeof body.nama_file !== 'string' || body.nama_file.length > 255) {
    return c.json({ success: false, message: 'Invalid nama_file' }, 422);
  }
  if (!['jpg', 'jpeg', 'png'].includes(String(extensi).toLowerCase())) {
    return c.json({ success: false, message: 'Invalid extensi (jpg, jpeg, png)' }, 422);
  }
  if (!Number.isInteger(size) || size < 1 || size > 10 * 1024 * 1024) {
    return c.json({ success: false, message: 'Invalid size (max 10MB)' }, 422);
  }
  if (!['photo', 'signature'].includes(type)) {
    return c.json({ success: false, message: 'Invalid type (photo, signature)' }, 422);
  }

  const folder = type === 'signature' ? 'ttd' : 'photos';
  const prefix = type === 'signature' ? 'ttd_' : 'foto_';
  const ext = String(extensi).toLowerCase();
  const s3Key = `${folder}/${prefix}${Math.floor(Date.now() / 1000)}_${randomStr()}.${ext}`;
  const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  const s3 = makeS3Client();
  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: s3Key,
    ContentType: mimeType,
    ACL: 'public-read',
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 120 * 60 });
  const publicUrl = buildPublicUrl(s3Key);

  return c.json({
    success: true,
    presigned_url: presignedUrl,
    s3_key: s3Key,
    public_url: publicUrl,
    mime_type: mimeType,
  });
}

export async function confirmUpload(c: Context) {
  const { id, s3_key, type } = await c.req.json();

  if (!id) {
    return c.json({ success: false, message: 'Invalid id' }, 422);
  }
  if (!s3_key || typeof s3_key !== 'string' || s3_key.length > 500) {
    return c.json({ success: false, message: 'Invalid s3_key' }, 422);
  }
  if (!['photo', 'signature'].includes(type)) {
    return c.json({ success: false, message: 'Invalid type' }, 422);
  }

  const exists = await sql`SELECT id FROM call_plan_actual WHERE id = ${id} LIMIT 1`;
  if (exists.length === 0) {
    return c.json({ success: false, message: 'call_plan_actual not found' }, 422);
  }

  const publicUrl = buildPublicUrl(s3_key);
  const column = type === 'photo' ? 'foto_link' : 'ttd_link';

  await sql`
    UPDATE call_plan_actual
    SET ${sql(column)} = ${publicUrl}
    WHERE id = ${id}
  `;

  return c.json({
    success: true,
    public_url: publicUrl,
  });
}

export async function deleteObject(c: Context) {
  const { s3_key } = await c.req.json();

  if (!s3_key || typeof s3_key !== 'string' || s3_key.length > 500) {
    return c.json({ success: false, message: 'Invalid s3_key' }, 422);
  }

  try {
    const s3 = makeS3Client();
    await s3.send(
      new DeleteObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: s3_key,
      }),
    );
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, message: e?.message ?? 'delete failed' }, 200);
  }
}
