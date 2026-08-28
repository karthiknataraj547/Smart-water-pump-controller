import { Router } from 'express';
import { getRules, createRule, toggleRule, deleteRule } from '../controllers/automationController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Query rules
router.get('/:deviceId', getRules);
router.get('/', getRules);

// Create rule
router.post('/:deviceId', requireRole(['admin', 'operator', 'technician']), createRule);
router.post('/', requireRole(['admin', 'operator', 'technician']), createRule);

// Toggle rule
router.patch('/:deviceId/rules/:ruleId/toggle', requireRole(['admin', 'operator', 'technician']), toggleRule);
router.patch('/rules/:ruleId/toggle', requireRole(['admin', 'operator', 'technician']), toggleRule);
router.patch('/:ruleId/toggle', requireRole(['admin', 'operator', 'technician']), toggleRule);

// Delete rule
router.delete('/:deviceId/rules/:ruleId', requireRole(['admin', 'operator', 'technician']), deleteRule);
router.delete('/rules/:ruleId', requireRole(['admin', 'operator', 'technician']), deleteRule);
router.delete('/:ruleId', requireRole(['admin', 'operator', 'technician']), deleteRule);

export default router;
