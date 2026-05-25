import { Hono } from 'hono';
import * as VisitController from '../controllers/VisitController';

const router = new Hono();

// Inline misc
router.get('/server-date', VisitController.serverDate);
router.get('/app-version', VisitController.getAppVersion);
router.get('/modul-all', VisitController.modulAll);
router.get('/doctor-spec', VisitController.doctorSpec);

// Call List
router.post('/doctor-list', VisitController.doctorList);
router.post('/call-list-data', VisitController.displayCallList);
router.post('/call-list-get', VisitController.getCallList);
router.post('/call-list-count', VisitController.getMonthlyCount);
router.post('/call-list-save', VisitController.saveCallList);
router.post('/call-list-update', VisitController.updateCallList);
router.post('/call-list-history', VisitController.getCallListHistory);
router.post('/call-list-delete', VisitController.deleteCallList);
router.post('/get-call-list-target', VisitController.getCallListTarget);
router.post('/get-my-pending-call-list-count', VisitController.getMyPendingCallListCount);
router.post('/get-ff-data', VisitController.getFFname);

// Call Plan
router.post('/call-plan-data', VisitController.displayCallPlan);
router.post('/call-plan-doctor', VisitController.callPlanDoctor);
router.post('/call-plan-inst', VisitController.callPlanInst);
router.post('/call-plan-save', VisitController.saveCallPlan);
router.post('/call-plan-delete', VisitController.deleteCallPlan);
router.get('/get-product-list', VisitController.getProductList);

// Actual
router.get('/call-actual-details/:id', VisitController.getActualDetails);
router.post('/call-actual-save', VisitController.saveActual);
router.post('/call-actual-data', VisitController.displayActual);
router.post('/unplan-actual-save', VisitController.saveUnplanned);
router.post('/nt-get-data', VisitController.getNtData);

// Report
router.post('/get-report-reach-prod', VisitController.getReachProdReport);
router.post('/get-report-freq', VisitController.getFreqReport);
router.post('/get-working-days', VisitController.getWorkingDays);
router.post('/get-productivity-target', VisitController.getProductivityTarget);

// Unvisit
router.get('/get-unvisit-alasan', VisitController.getUnvisitAlasan);
router.get('/get-unvisit-config', VisitController.getUnvisitConfig);
router.post('/add-unvisit', VisitController.addUnvisit);
router.post('/get-unvisit-list', VisitController.getUnvisitList);
router.post('/delete-unvisit', VisitController.deleteUnvisit);

// Offline
router.post('/offline-call-plan', VisitController.offlineCallPlan);

export default router;
