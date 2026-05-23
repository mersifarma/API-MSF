import { z } from 'zod';

export const periodeSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format periode harus 'YYYY-MM'");

export const callListListQuerySchema = z.object({
  periode: periodeSchema,
});
export type CallListListQuery = z.infer<typeof callListListQuerySchema>;

export const callListEligibleQuerySchema = z.object({
  periode: periodeSchema,
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
});
export type CallListEligibleQuery = z.infer<typeof callListEligibleQuerySchema>;

export const callListCountQuerySchema = z.object({
  periode: periodeSchema,
});
export type CallListCountQuery = z.infer<typeof callListCountQuerySchema>;

export const callListTargetQuerySchema = z.object({
  periode: periodeSchema.optional(),
});
export type CallListTargetQuery = z.infer<typeof callListTargetQuerySchema>;

export const callListIdParamSchema = z.object({
  id: z.string().uuid('id harus UUID v4'),
});
export type CallListIdParam = z.infer<typeof callListIdParamSchema>;

// ---------------------------------------------------------------------------
// Write bodies — sisanya di-derive dari master & JWT
// ---------------------------------------------------------------------------

export const callListCreateBodySchema = z.object({
  id_mcl: z.number().int().positive(),
  periode: periodeSchema,
});
export type CallListCreateBody = z.infer<typeof callListCreateBodySchema>;

export const callListUpdateBodySchema = z.object({
  id_mcl: z.number().int().positive(),
  reason: z.string().trim().max(255).optional(),
});
export type CallListUpdateBody = z.infer<typeof callListUpdateBodySchema>;
