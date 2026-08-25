import { Router } from 'express';
import { scanBleDevices, provisionDevice } from '../controllers/provisionController';

const router = Router();

// Allow device discovery and initial provisioning without blocking setup
router.get('/ble/scan', scanBleDevices);
router.post('/complete', provisionDevice);

export default router;
