import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { pumpControlService } from '../services/PumpControlService';

export async function getPumpStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const status = await pumpControlService.getPumpStatus(req.params.deviceId);
    if (!status) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Pump status record not found' } });
      return;
    }
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function startPump(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const source = (req.body.source || 'web') as any;
    const result = await pumpControlService.sendPumpCommand({
      deviceId: req.params.deviceId,
      commandType: 'START_PUMP',
      payload: req.body.payload || {},
      requestedBy: req.user?.name || req.user?.email || 'USER',
      source
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'COMMAND_ERROR', message: err.message } });
  }
}

export async function stopPump(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const source = (req.body.source || 'web') as any;
    const result = await pumpControlService.sendPumpCommand({
      deviceId: req.params.deviceId,
      commandType: 'STOP_PUMP',
      payload: req.body.payload || {},
      requestedBy: req.user?.name || req.user?.email || 'USER',
      source
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'COMMAND_ERROR', message: err.message } });
  }
}

export async function setMode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { mode } = req.body;
    if (!mode || !['MANUAL', 'AUTOMATIC', 'SCHEDULED', 'EMERGENCY_STOP'].includes(mode)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid pump mode' } });
      return;
    }

    const source = (req.body.source || 'web') as any;
    const result = await pumpControlService.sendPumpCommand({
      deviceId: req.params.deviceId,
      commandType: 'SET_MODE',
      payload: { mode },
      requestedBy: req.user?.name || req.user?.email || 'USER',
      source
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'COMMAND_ERROR', message: err.message } });
  }
}

export async function emergencyStop(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const source = (req.body.source || 'web') as any;
    const result = await pumpControlService.sendPumpCommand({
      deviceId: req.params.deviceId,
      commandType: 'EMERGENCY_STOP',
      payload: { reason: req.body.reason || 'Manual Emergency Stop Button Triggered' },
      requestedBy: req.user?.name || req.user?.email || 'OPERATOR',
      source
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'COMMAND_ERROR', message: err.message } });
  }
}

export async function handleHardwareAckHttp(req: any, res: Response): Promise<void> {
  try {
    const { device_uid, status, confirmed_state, current_amps, runtime_seconds, error_message, command_id } = req.body;
    if (!device_uid || !confirmed_state) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ACK', message: 'Missing device_uid or confirmed_state' } });
      return;
    }
    await pumpControlService.handleHardwareAck(device_uid, {
      command_id,
      status: status || 'successful',
      confirmed_state,
      current_amps,
      runtime_seconds,
      error_message
    });
    res.json({ success: true, message: 'Hardware state synchronized & pushed to app' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

