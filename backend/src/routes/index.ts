import { Router } from 'express';
import authRoutes from './authRoutes';
import deviceRoutes from './deviceRoutes';
import pumpRoutes from './pumpRoutes';
import sensorRoutes from './sensorRoutes';
import automationRoutes from './automationRoutes';
import alertRoutes from './alertRoutes';
import provisionRoutes from './provisionRoutes';
import firmwareRoutes from './firmwareRoutes';
import adminRoutes from './adminRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/users', adminRoutes);
router.use('/devices', deviceRoutes);
router.use('/pumps', pumpRoutes);
router.use('/pump', pumpRoutes);
router.use('/sensors', sensorRoutes);
router.use('/telemetry', sensorRoutes);
router.use('/automation', automationRoutes);
router.use('/alerts', alertRoutes);
router.use('/provision', provisionRoutes);
router.use('/firmware', firmwareRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Smart IoT Water Pump Control Gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;
