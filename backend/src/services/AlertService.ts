import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { wsHub } from './WebSocketHub';
import { Alert, AlertSeverity } from '../types';

export class AlertService {
  private static instance: AlertService;

  private constructor() {}

  public static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  public async createAlert(params: {
    deviceId: string;
    severity: AlertSeverity;
    title: string;
    message: string;
  }): Promise<Alert> {
    const alertId = uuidv4();
    await db.execute(
      `INSERT INTO alerts (id, device_id, severity, title, message, acknowledged, created_at)
       VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`,
      [alertId, params.deviceId, params.severity, params.title, params.message]
    );

    const createdAlert: Alert = {
      id: alertId,
      device_id: params.deviceId,
      severity: params.severity,
      title: params.title,
      message: params.message,
      acknowledged: false,
      created_at: new Date().toISOString()
    };

    wsHub.broadcastAlert(createdAlert);
    console.log(`[AlertService] [${params.severity.toUpperCase()}] ${params.title}: ${params.message}`);
    return createdAlert;
  }

  public async getAlerts(deviceId?: string, limit: number = 50): Promise<Alert[]> {
    if (deviceId) {
      return db.query<Alert>(
        'SELECT * FROM alerts WHERE device_id = ? ORDER BY created_at DESC LIMIT ?',
        [deviceId, limit]
      );
    }
    return db.query<Alert>('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?', [limit]);
  }

  public async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    const result = await db.execute(
      `UPDATE alerts SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = datetime('now') WHERE id = ?`,
      [userId, alertId]
    );
    wsHub.broadcast('ALERT_ACKNOWLEDGED', { alertId, acknowledgedBy: userId });
    return (result.changes || result.affectedRows) > 0;
  }
}

export const alertService = AlertService.getInstance();
