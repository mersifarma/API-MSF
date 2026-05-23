import { z } from 'zod';
import { periodeSchema } from './call-list.validation';

export const approvalActualPegawaiQuerySchema = z.object({
  periode: periodeSchema,
});
export type ApprovalActualPegawaiQuery = z.infer<typeof approvalActualPegawaiQuerySchema>;

export const approvalActualDetailsQuerySchema = z.object({
  id_peg: z.coerce.number().int().positive(),
  periode: periodeSchema,
});
export type ApprovalActualDetailsQuery = z.infer<typeof approvalActualDetailsQuerySchema>;

const approvalActualDecisionSchema = z.object({
  id: z.string().uuid('id harus UUID v4'),
  approval_actual: z.enum(['Approve', 'Reject']),
  approval_actual_comment: z.string().trim().max(500).optional(),
});

export const approvalActualBatchBodySchema = z.object({
  approvals: z.array(approvalActualDecisionSchema).min(1).max(500),
});
export type ApprovalActualBatchBody = z.infer<typeof approvalActualBatchBodySchema>;
export type ApprovalActualDecision = z.infer<typeof approvalActualDecisionSchema>;
