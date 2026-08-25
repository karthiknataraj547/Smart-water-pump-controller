import { Router } from 'express';
import { listDevices, getDevice, updateDevice } from '../controllers/deviceController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', listDevices);
router.get('/:id', getDevice);
router.patch('/:id', updateDevice);

export default router;
