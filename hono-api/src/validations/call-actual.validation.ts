import { z } from 'zod';
import { periodeSchema } from './call-list.validation';

const dateIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus 'YYYY-MM-DD'");

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Format waktu harus 'HH:MM' atau 'HH:MM:SS'");

// Koordinat 'lat,long' dengan optional spaces. Max 100 char (mirror legacy).
const koordinatSchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/, "Format koordinat harus 'lat,long'");

// CSV id_peg (mis. '4001,4002'). Boleh kosong/optional.
const csvIntSchema = z
  .string()
  .trim()
  .max(255)
  .regex(/^\d+(\s*,\s*\d+)*$/, "Format harus CSV integer (mis. '4001,4002')");

const idParamSchema = z.object({
  id: z.string().uuid('id harus UUID v4'),
});

export const callActualIdParamSchema = idParamSchema;
export type CallActualIdParam = z.infer<typeof callActualIdParamSchema>;

export const callActualListQuerySchema = z.object({
  periode: periodeSchema.optional(),
  date: dateIsoSchema.optional(),
  search: z.string().trim().min(1).optional(),
});
export type CallActualListQuery = z.infer<typeof callActualListQuerySchema>;

// ---------------------------------------------------------------------------
// PATCH /:id — update existing Plan dengan data Actual
// ---------------------------------------------------------------------------
export const callActualSaveBodySchema = z.object({
  koor_visit: koordinatSchema,
  tgl_actual: dateIsoSchema,
  waktu_actual: timeSchema.optional(),
  status: z.string().trim().min(1).max(30),
  stt_koor: z.number().int().nonnegative().optional(),
  keterangan: z.string().trim().max(500).optional(),
  join_visit: z.union([z.literal(0), z.literal(1)]).optional(),
  join_visit_id: csvIntSchema.optional(),
  foto: z.string().trim().max(250).optional(),
  tanda_tangan: z.string().trim().max(250).optional(),
});
export type CallActualSaveBody = z.infer<typeof callActualSaveBodySchema>;

// ---------------------------------------------------------------------------
// POST /unplan — INSERT row baru untuk visit non-planned (NT/Unplan)
// ---------------------------------------------------------------------------
export const callActualUnplanBodySchema = z.object({
  // Customer snapshot
  id_mcl: z.number().int().positive(),
  nama_dokter: z.string().trim().min(1).max(150),
  spec: z.string().trim().min(1).max(50),
  segmen_md: z.number().int().nonnegative(),
  class: z.string().trim().max(5).optional(),
  institusi: z.string().trim().max(200).optional(),
  alamat_praktek: z.string().trim().max(250).optional(),
  koordinat_institusi: z.string().trim().max(100).optional(),
  // Visit data
  koor_visit: koordinatSchema,
  tgl_actual: dateIsoSchema,
  waktu_actual: timeSchema.optional(),
  status: z.string().trim().min(1).max(30),
  stt_koor: z.number().int().nonnegative().optional(),
  keterangan: z.string().trim().max(500).optional(),
  // Join visit
  join_visit: z.union([z.literal(0), z.literal(1)]).optional(),
  join_visit_id: csvIntSchema.optional(),
  // Optional product list
  product_list: z.array(z.number().int().positive()).optional(),
  // Photos (filename atau URL dari /upload)
  foto: z.string().trim().max(250).optional(),
  tanda_tangan: z.string().trim().max(250).optional(),
});
export type CallActualUnplanBody = z.infer<typeof callActualUnplanBodySchema>;
