import { Hono } from 'hono';
import { login, logout, me, switchPegawai } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { validateJson } from '../middleware/validator';
import { loginSchema, switchPegawaiSchema } from '../validations/auth.validation';

const auth = new Hono();

auth.post('/login', validateJson(loginSchema), login);
auth.get('/me', requireAuth, me);
auth.post('/switch-pegawai', requireAuth, validateJson(switchPegawaiSchema), switchPegawai);
auth.post('/logout', requireAuth, logout);

export default auth;
