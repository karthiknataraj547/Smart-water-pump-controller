import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getAuditLogs,
  getAdminStats,
  updateDeviceConfig
} from '../controllers/adminController';

const router = Router();

// All administrative routes require JWT Authentication & Strict 'admin' Role
router.use(authenticateToken);
router.use(requireRole(['admin']));

// User Database CRUD
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// System Logs & Telemetry Stats
router.get('/logs', getAuditLogs);
router.get('/stats', getAdminStats);

// Device Fleet Config
router.put('/devices/:id/config', updateDeviceConfig);

export default router;
