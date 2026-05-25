import { Hono } from 'hono';
import * as MainMenuController from '../controllers/MainMenuController';

const router = new Hono();

router.post('/login', MainMenuController.login);
router.get('/modul-user/:id_user', MainMenuController.getModulesByUser);

export default router;
