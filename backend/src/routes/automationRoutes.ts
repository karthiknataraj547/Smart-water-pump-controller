import { Router } from 'express';
import { getRules, createRule, toggleRule, deleteRule } from '../controllers/automationController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/:deviceId', getRules);
router.post('/:deviceId', requireRole(['admin', 'operator']), createRule);
router.patch('/:deviceId/rules/:ruleId/toggle', requireRole(['admin', 'operator']), toggleRule);
router.delete('/:deviceId/rules/:ruleId', requireRole(['admin']), deleteRule);

export default router;
