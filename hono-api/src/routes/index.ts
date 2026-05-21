import { Hono } from 'hono';
import authRoutes from './auth.routes';

const api = new Hono();

api.route('/auth', authRoutes);

// Modul berikutnya tinggal di-mount di sini:
// api.route("/master", masterRoutes)
// api.route("/call-list", callListRoutes)
// api.route("/call-plan", callPlanRoutes)
// api.route("/call-actual", callActualRoutes)
// api.route("/approval", approvalRoutes)
// api.route("/report", reportRoutes)

export default api;
