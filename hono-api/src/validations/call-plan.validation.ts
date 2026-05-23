import { z } from 'zod';
import { periodeSchema } from './call-list.validation';

const dateIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus 'YYYY-MM-DD'");

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Format waktu harus 'HH:MM' atau 'HH:MM:SS'");

export const callPlanListQuerySchema = z.object({
  periode: periodeSchema.optional(),
  date: dateIsoSchema.optional(),
  search: z.string().trim().min(1).optional(),
});
export type CallPlanListQuery = z.infer<typeof callPlanListQuerySchema>;

export const callPlanEligibleDoctorsQuerySchema = z.object({
  periode: periodeSchema.optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
});
export type CallPlanEligibleDoctorsQuery = z.infer<typeof callPlanEligibleDoctorsQuerySchema>;

export const callPlanInstitutionsQuerySchema = z.object({
  id_mcl: z.coerce.number().int().positive(),
});
export type CallPlanInstitutionsQuery = z.infer<typeof callPlanInstitutionsQuerySchema>;

export const callPlanIdParamSchema = z.object({
  id: z.string().uuid('id harus UUID v4'),
});
export type CallPlanIdParam = z.infer<typeof callPlanIdParamSchema>;

export const callPlanCreateBodySchema = z.object({
  id_mcl: z.number().int().positive(),
  tgl_plan: dateIsoSchema,
  waktu: timeSchema,
  institusi: z.string().trim().max(200).optional(),
  alamat_praktek: z.string().trim().max(250).optional(),
  koordinat_institusi: z.string().trim().max(100).optional(),
  product_list: z.array(z.number().int().positive()).optional(),
  keterangan: z.string().trim().max(500).optional(),
});
export type CallPlanCreateBody = z.infer<typeof callPlanCreateBodySchema>;
