import { Hono } from 'hono';
import approvalCallActualRoutes from './approval-call-actual.routes';
import approvalCallListRoutes from './approval-call-list.routes';
import approvalCallPlanRoutes from './approval-call-plan.routes';
import authRoutes from './auth.routes';
import callActualRoutes from './call-actual.routes';
import callListRoutes from './call-list.routes';
import callPlanRoutes from './call-plan.routes';
import customerRoutes from './customer.routes';
import joinVisitRoutes from './join-visit.routes';
import masterRoutes from './master.routes';
import uploadRoutes from './upload.routes';
import utilityRoutes from './utility.routes';

const api = new Hono();

api.route('/', utilityRoutes); // /server-date
api.route('/auth', authRoutes);
api.route('/master', masterRoutes);
api.route('/customer', customerRoutes);
api.route('/call-list', callListRoutes);
api.route('/call-plan', callPlanRoutes);
api.route('/call-actual', callActualRoutes);
api.route('/upload', uploadRoutes);
api.route('/approval/call-list', approvalCallListRoutes);
api.route('/approval/call-plan', approvalCallPlanRoutes);
api.route('/approval/call-actual', approvalCallActualRoutes);
api.route('/join-visit', joinVisitRoutes);

// Modul berikutnya tinggal di-mount di sini:
// api.route("/report", reportRoutes)

export default api;
