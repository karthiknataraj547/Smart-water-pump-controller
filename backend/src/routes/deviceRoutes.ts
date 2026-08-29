import { Router } from 'express';
import { listDevices, getDevice, updateDevice, claimDevice } from '../controllers/deviceController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', listDevices);
router.post('/claim', claimDevice);
router.get('/:id', getDevice);
router.patch('/:id', updateDevice);

export default router;
