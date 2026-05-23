import { Hono } from 'hono';
import { serverDate } from '../controllers/master.controller';

const utility = new Hono();

utility.get('/server-date', serverDate);

export default utility;
