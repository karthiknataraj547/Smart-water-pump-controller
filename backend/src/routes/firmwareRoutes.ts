import { Router } from 'express';
import { checkFirmwareVersion, triggerOtaUpdate } from '../controllers/firmwareController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/version', checkFirmwareVersion);
router.post('/ota/trigger', requireRole(['admin']), triggerOtaUpdate);

export default router;
