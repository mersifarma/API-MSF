import { z } from 'zod';

export const dokterListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  spec: z.string().trim().min(1).optional(),
  class: z.string().trim().min(1).max(5).optional(),
  segmen: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  include_inactive: z.coerce.boolean().default(false),
});
export type DokterListQuery = z.infer<typeof dokterListQuerySchema>;

export const productListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  divisi: z.string().trim().min(1).optional(),
  include_inactive: z.coerce.boolean().default(false),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const pegawaiLookupQuerySchema = z.object({
  id_peg: z.coerce.number().int().positive(),
});
export type PegawaiLookupQuery = z.infer<typeof pegawaiLookupQuerySchema>;

export const dokterNonTargetQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});
export type DokterNonTargetQuery = z.infer<typeof dokterNonTargetQuerySchema>;
