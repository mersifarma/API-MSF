import { Hono } from 'hono';
import * as JoinVisitController from '../controllers/JoinVisitController';

const router = new Hono();

router.get('/get-app-config', JoinVisitController.getAppConfig);
router.post('/call-join-visit', JoinVisitController.callJoinVisit);
router.post('/approval-join-visit', JoinVisitController.approvalJoinVisit);
router.post('/approval-join-details', JoinVisitController.joinVisitDetails);
router.post('/copy-join-visit', JoinVisitController.copyJoinVisit);

export default router;
