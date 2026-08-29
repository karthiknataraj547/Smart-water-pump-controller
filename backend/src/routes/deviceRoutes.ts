import { Router } from 'express';
import { listDevices, getDevice, updateDevice, claimDevice, deleteDevice } from '../controllers/deviceController';
import { authenticateToken, validateDeviceOwnership } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', listDevices);
router.post('/claim', claimDevice);
router.get('/:id', validateDeviceOwnership, getDevice);
router.patch('/:id', validateDeviceOwnership, updateDevice);
router.delete('/:id', validateDeviceOwnership, deleteDevice);

export default router;
