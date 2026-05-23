import { z } from 'zod';
import { periodeSchema } from './call-list.validation';

export const approvalPegawaiQuerySchema = z.object({
  periode: periodeSchema,
});
export type ApprovalPegawaiQuery = z.infer<typeof approvalPegawaiQuerySchema>;

export const approvalDetailsQuerySchema = z.object({
  id_peg: z.coerce.number().int().positive(),
  periode: periodeSchema,
});
export type ApprovalDetailsQuery = z.infer<typeof approvalDetailsQuerySchema>;

const approvalDecisionSchema = z.object({
  id: z.string().uuid('id harus UUID v4'),
  approval: z.enum(['Approve', 'Reject']),
  approval_comment: z.string().trim().max(100).optional(),
});

export const approvalBatchBodySchema = z.object({
  approvals: z.array(approvalDecisionSchema).min(1).max(500),
});
export type ApprovalBatchBody = z.infer<typeof approvalBatchBodySchema>;
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
