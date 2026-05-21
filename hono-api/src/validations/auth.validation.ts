import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const switchPegawaiSchema = z.object({
  id_peg: z.coerce.number().int().positive(),
});

export type SwitchPegawaiInput = z.infer<typeof switchPegawaiSchema>;
