import { z } from 'zod';

export const customerListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  spec: z.string().trim().min(1).optional(),
  class: z.string().trim().min(1).max(5).optional(),
  segmen: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  include_inactive: z.coerce.boolean().default(false),
});
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
