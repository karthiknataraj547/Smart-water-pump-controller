import { Router } from 'express';
import { getAlerts, acknowledgeAlert } from '../controllers/alertController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getAlerts);
router.post('/:alertId/acknowledge', acknowledgeAlert);

export default router;
