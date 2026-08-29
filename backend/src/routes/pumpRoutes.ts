import { Router } from 'express';
import { getPumpStatus, startPump, stopPump, setMode, emergencyStop, resetLockout, handleHardwareAckHttp } from '../controllers/pumpController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Direct Hardware HTTP REST API Endpoint for state ACK
router.post('/ack', handleHardwareAckHttp);

router.use(authenticateToken);
router.get('/:deviceId/status', getPumpStatus);
router.post('/:deviceId/start', requireRole(['admin', 'operator']), startPump);
router.post('/:deviceId/stop', requireRole(['admin', 'operator']), stopPump);
router.post('/:deviceId/mode', requireRole(['admin', 'operator']), setMode);
router.post('/:deviceId/emergency-stop', emergencyStop); // Any authenticated user can trigger emergency stop
router.post('/:deviceId/reset', requireRole(['admin', 'operator']), resetLockout);

export default router;
