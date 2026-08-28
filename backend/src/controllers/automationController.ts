import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { AutomationRule, Device } from '../types';
import { mqttBridge } from '../services/MqttBridge';

async function pushRulesToHardware(targetDeviceId: string): Promise<void> {
  try {
    const device = await db.queryOne<Device>('SELECT id, device_uid FROM devices WHERE id = ? OR device_uid = ?', [targetDeviceId, targetDeviceId]);
    const deviceUid = device ? device.device_uid : (targetDeviceId || 'WPC-A81F29');
    const dbDeviceId = device ? device.id : targetDeviceId;

    const rules = await db.query<AutomationRule>(
      'SELECT * FROM automation_rules WHERE device_id = ? OR device_id = ? ORDER BY priority ASC, created_at ASC',
      [dbDeviceId, deviceUid]
    );

    mqttBridge.syncDeviceRules(deviceUid, rules);
    console.log(`[Automation API] Synced ${rules.length} rules to hardware device ${deviceUid}`);
  } catch (err: any) {
    console.warn('[Automation API] Could not push rules to hardware:', err.message);
  }
}

export async function getRules(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawDevId = req.params.deviceId || req.query.deviceId as string || '';
    let targetDeviceId = rawDevId;

    if (rawDevId) {
      const device = await db.queryOne<Device>('SELECT id FROM devices WHERE id = ? OR device_uid = ?', [rawDevId, rawDevId]);
      if (device) targetDeviceId = device.id;
    } else {
      const firstDev = await db.queryOne<Device>('SELECT id FROM devices LIMIT 1');
      if (firstDev) targetDeviceId = firstDev.id;
    }

    const rules = await db.query<AutomationRule>(
      'SELECT * FROM automation_rules WHERE device_id = ? OR device_id = ? ORDER BY priority ASC, created_at ASC',
      [targetDeviceId, rawDevId]
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
    const rawDevId = req.params.deviceId || req.body.device_id || req.body.deviceId || '';
    let targetDeviceId = rawDevId;

    if (rawDevId) {
      const device = await db.queryOne<Device>('SELECT id FROM devices WHERE id = ? OR device_uid = ?', [rawDevId, rawDevId]);
      if (device) targetDeviceId = device.id;
    } else {
      const firstDev = await db.queryOne<Device>('SELECT id FROM devices LIMIT 1');
      if (firstDev) targetDeviceId = firstDev.id;
    }

    const ruleId = uuidv4();
    await db.execute(
      `INSERT INTO automation_rules (id, device_id, rule_name, condition_json, action_json, enabled, priority, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        ruleId,
        targetDeviceId,
        rule_name,
        JSON.stringify(condition_json || {}),
        JSON.stringify(action_json || {}),
        enabled !== false ? 1 : 0,
        priority || 1
      ]
    );

    await pushRulesToHardware(targetDeviceId);

    res.status(201).json({ success: true, data: { id: ruleId, rule_name, enabled: enabled !== false, device_id: targetDeviceId } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function toggleRule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { enabled } = req.body;
    const ruleId = req.params.ruleId || req.params.id;
    if (!ruleId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing ruleId parameter' } });
      return;
    }

    const rule = await db.queryOne<AutomationRule>('SELECT device_id FROM automation_rules WHERE id = ?', [ruleId]);
    const targetDevId = rule ? rule.device_id : (req.params.deviceId || '97511f3d-e3b7-4b75-876f-b11b259f86d5');

    const isEnabled = enabled === true || enabled === 1 || enabled === 'true';
    await db.execute(
      'UPDATE automation_rules SET enabled = ? WHERE id = ?',
      [isEnabled ? 1 : 0, ruleId]
    );

    console.log(`[Automation API] Rule ${ruleId} toggled to: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
    await pushRulesToHardware(targetDevId);

    res.json({ success: true, message: `Rule ${isEnabled ? 'enabled' : 'disabled'}`, enabled: isEnabled });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function deleteRule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const ruleId = req.params.ruleId || req.params.id;
    if (!ruleId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing ruleId parameter' } });
      return;
    }

    const rule = await db.queryOne<AutomationRule>('SELECT device_id FROM automation_rules WHERE id = ?', [ruleId]);
    const targetDevId = rule ? rule.device_id : (req.params.deviceId || '97511f3d-e3b7-4b75-876f-b11b259f86d5');

    await db.execute('DELETE FROM automation_rules WHERE id = ?', [ruleId]);
    console.log(`[Automation API] Rule ${ruleId} deleted successfully.`);
    await pushRulesToHardware(targetDevId);

    res.json({ success: true, message: 'Rule deleted successfully', ruleId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}
