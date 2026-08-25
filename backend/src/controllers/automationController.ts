import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { AutomationRule } from '../types';

export async function getRules(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rules = await db.query<AutomationRule>(
      'SELECT * FROM automation_rules WHERE device_id = ? ORDER BY priority ASC',
      [req.params.deviceId]
    );
    const parsed = rules.map(r => ({
      ...r,
      condition_json: typeof r.condition_json === 'string' ? JSON.parse(r.condition_json) : r.condition_json,
      action_json: typeof r.action_json === 'string' ? JSON.parse(r.action_json) : r.action_json,
      enabled: Boolean(r.enabled)
    }));
    res.json({ success: true, data: parsed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function createRule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { rule_name, condition_json, action_json, priority, enabled } = req.body;
    const ruleId = uuidv4();
    await db.execute(
      `INSERT INTO automation_rules (id, device_id, rule_name, condition_json, action_json, enabled, priority, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        ruleId,
        req.params.deviceId,
        rule_name,
        JSON.stringify(condition_json || {}),
        JSON.stringify(action_json || {}),
        enabled !== false ? 1 : 0,
        priority || 1
      ]
    );
    res.status(201).json({ success: true, data: { id: ruleId, rule_name } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function toggleRule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { enabled } = req.body;
    await db.execute(
      'UPDATE automation_rules SET enabled = ? WHERE id = ?',
      [enabled ? 1 : 0, req.params.ruleId]
    );
    res.json({ success: true, message: `Rule ${enabled ? 'enabled' : 'disabled'}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function deleteRule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await db.execute('DELETE FROM automation_rules WHERE id = ?', [req.params.ruleId]);
    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}
