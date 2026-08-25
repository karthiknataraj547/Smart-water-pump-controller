import { Router } from 'express';
import { getLatestSensorReading, getSensorHistory, postTelemetry } from '../controllers/sensorController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/telemetry', postTelemetry); // Ingests from device or simulator
router.get('/:deviceId/latest', authenticateToken, getLatestSensorReading);
router.get('/:deviceId/history', authenticateToken, getSensorHistory);

export default router;
