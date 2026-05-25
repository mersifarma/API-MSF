import { Hono } from 'hono';
import mainMenu from './main-menu';
import visit from './visit';
import approval from './approval';
import joinVisit from './join-visit';
import s3 from './s3-presigned';

const api = new Hono();

api.route('/', mainMenu);
api.route('/', visit);
api.route('/', approval);
api.route('/', joinVisit);
api.route('/s3', s3);

export default api;
