import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { telemetryService } from '../services/TelemetryService';

export async function getLatestSensorReading(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reading = await telemetryService.getLatestReading(req.params.deviceId);
    if (!reading) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No readings found for this device' } });
      return;
    }
    res.json({ success: true, data: reading });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function getSensorHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const hours = parseInt((req.query.hours as string) || '24', 10);
    const history = await telemetryService.getHistory(req.params.deviceId, hours);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function postTelemetry(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body;
    if (!payload.device_uid || payload.water_level_pct === undefined) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'device_uid and water_level_pct are required' } });
      return;
    }
    await telemetryService.ingestTelemetry(payload);
    res.json({ success: true, message: 'Telemetry processed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}
