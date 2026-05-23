import { z } from 'zod';
import { periodeSchema } from './call-list.validation';

export const approvalPlanPegawaiQuerySchema = z.object({
  periode: periodeSchema,
});
export type ApprovalPlanPegawaiQuery = z.infer<typeof approvalPlanPegawaiQuerySchema>;

export const approvalPlanDetailsQuerySchema = z.object({
  id_peg: z.coerce.number().int().positive(),
  periode: periodeSchema,
});
export type ApprovalPlanDetailsQuery = z.infer<typeof approvalPlanDetailsQuerySchema>;

const approvalPlanDecisionSchema = z.object({
  id: z.string().uuid('id harus UUID v4'),
  approval: z.enum(['Approve', 'Reject']),
  approval_comment: z.string().trim().max(500).optional(),
});

export const approvalPlanBatchBodySchema = z.object({
  approvals: z.array(approvalPlanDecisionSchema).min(1).max(500),
});
export type ApprovalPlanBatchBody = z.infer<typeof approvalPlanBatchBodySchema>;
export type ApprovalPlanDecision = z.infer<typeof approvalPlanDecisionSchema>;
