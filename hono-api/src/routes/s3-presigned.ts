import { Hono } from 'hono';
import * as S3PresignedController from '../controllers/S3PresignedController';

const router = new Hono();

router.post('/presigned-url', S3PresignedController.getPresignedUrl);
router.post('/confirm-upload', S3PresignedController.confirmUpload);
router.delete('/delete-object', S3PresignedController.deleteObject);

export default router;
