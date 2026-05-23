import { Hono } from 'hono';
import { getCustomers, getSummary } from '../controllers/customer.controller';
import { requireAuth } from '../middleware/auth';
import { validateQuery } from '../middleware/validator';
import type { AppEnv } from '../types/app-env';
import { customerListQuerySchema } from '../validations/customer.validation';

const customer = new Hono<AppEnv>();

customer.use('*', requireAuth);

customer.get('/summary', getSummary);
customer.get('/', validateQuery(customerListQuerySchema), getCustomers);

export default customer;
