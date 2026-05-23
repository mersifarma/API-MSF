import { z } from 'zod';

const assetTypeSchema = z.enum(['image', 'document', 'presentation', 'spreadsheet']);

export const uploadPresignBodySchema = z.object({
  asset_type: assetTypeSchema,
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(255).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
});
export type UploadPresignBody = z.infer<typeof uploadPresignBodySchema>;

export const uploadAssetIdParamSchema = z.object({
  id: z.string().uuid('id harus UUID v4'),
});
export type UploadAssetIdParam = z.infer<typeof uploadAssetIdParamSchema>;

export const uploadListQuerySchema = z.object({
  asset_type: assetTypeSchema.optional(),
  status: z.enum(['pending', 'active']).optional(),
  mine: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type UploadListQuery = z.infer<typeof uploadListQuerySchema>;
