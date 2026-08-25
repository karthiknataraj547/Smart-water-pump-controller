import { Router } from 'express';
import { register, login, getProfile } from '../controllers/authController';
import { authenticateToken, rateLimiter } from '../middleware/auth';

const router = Router();

router.post('/register', rateLimiter(20, 60000), register);
router.post('/login', rateLimiter(30, 60000), login);
router.get('/profile', authenticateToken, getProfile);

export default router;
