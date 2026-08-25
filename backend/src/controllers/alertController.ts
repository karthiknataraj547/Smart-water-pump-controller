import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { alertService } from '../services/AlertService';

export async function getAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const alerts = await alertService.getAlerts(deviceId, limit);
    res.json({ success: true, data: alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function acknowledgeAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const success = await alertService.acknowledgeAlert(req.params.alertId, req.user!.id);
    if (!success) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Alert not found' } });
      return;
    }
    res.json({ success: true, message: 'Alert acknowledged' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}
