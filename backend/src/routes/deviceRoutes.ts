import { Router } from 'express';
import { listDevices, getDevice, updateDevice, claimDevice, deleteDevice } from '../controllers/deviceController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', listDevices);
router.post('/claim', claimDevice);
router.get('/:id', getDevice);
router.patch('/:id', updateDevice);
router.delete('/:id', deleteDevice);

export default router;
