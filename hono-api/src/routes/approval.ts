import { Hono } from 'hono';
import * as VisitApprovalController from '../controllers/VisitApprovalController';

const router = new Hono();

// Call List
router.post('/dm-approval-list-name', VisitApprovalController.DmApprovalListName);
router.post('/dm-approval-list-details', VisitApprovalController.DmApprovalListDetails);
router.post('/dm-approval-list-save', VisitApprovalController.DmApprovalListSave);

// Call Plan
router.post('/dm-approval-plan-name', VisitApprovalController.DmApprovalPlanName);
router.post('/dm-approval-plan-details', VisitApprovalController.DmApprovalPlanDetails);
router.post('/dm-approval-plan-save', VisitApprovalController.DmApprovalPlanSave);

// Call Actual
router.post('/dm-approval-actual-name', VisitApprovalController.DmApprovalActualName);
router.post('/dm-approval-actual-details', VisitApprovalController.DmApprovalActualDetails);
router.post('/dm-approval-actual-save', VisitApprovalController.DmApprovalActualSave);
router.post('/dm-approval-actual-single', VisitApprovalController.DmApprovalActualSingle);

// Notification
router.post('/dm-approval-notification-summary', VisitApprovalController.DmApprovalNotificationSummary);

export default router;
