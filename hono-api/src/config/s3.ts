import type { ObjectCannedACL } from '@aws-sdk/client-s3';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from './env';

export interface S3StreamResult {
  stream: ReadableStream;
  contentType: string;
  contentLength: number;
}

export enum ACL {
  PUBLIC_READ = 'public-read',

  PRIVATE = 'private',
}

interface UploadProps {
  bucket: string;
  key: string;
  body: File | Buffer | Uint8Array;
  contentType: string;
  acl: ACL;
}

const s3Client = new S3Client({
  endpoint: env.AWS_S3_ENDPOINT,
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

export async function uploadToS3({
  bucket,
  key,
  body,
  contentType,
  acl,
}: UploadProps): Promise<void> {
  let bodyBuffer: Buffer | Uint8Array;
  if (body instanceof File) {
    const arrayBuffer = await body.arrayBuffer();
    bodyBuffer = Buffer.from(arrayBuffer);
  } else {
    bodyBuffer = body;
  }

  const putObjectCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bodyBuffer,
    ContentType: contentType,
    ACL: acl as ObjectCannedACL,
  });

  await s3Client.send(putObjectCommand);
}

export function buildS3Url(key: string): string {
  return `${env.AWS_S3_ENDPOINT.replace(/\/+$/, '')}/${env.AWS_S3_BUCKET}/${key}`;
}

/**
 * Extract S3 key from full URL
 */
export function extractS3KeyFromUrl(url: string): string {
  const bucketUrl = `${env.AWS_S3_ENDPOINT.replace(/\/+$/, '')}/${env.AWS_S3_BUCKET}/`;
  return url.replace(bucketUrl, '');
}

/**
 * Generate presigned URL for direct client upload to S3
 * @param key - S3 object key
 * @param contentType - MIME type of the file to be uploaded
 * @param expiresIn - URL expiration time in seconds (default: 900 = 15 minutes)
 */
export async function generatePresignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 900,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ACL: ACL.PUBLIC_READ,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return presignedUrl;
}
