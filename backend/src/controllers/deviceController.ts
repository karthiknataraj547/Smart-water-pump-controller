import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { deviceService } from '../services/DeviceService';

export async function listDevices(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const devices = await deviceService.getDevices(req.user!.id, req.user!.role);
    res.json({ success: true, data: devices });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function getDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const device = await deviceService.getDeviceById(req.params.id);
    if (!device) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } });
      return;
    }
    const nodes = await deviceService.getDeviceNodes(device.id);
    res.json({ success: true, data: { ...device, nodes } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function updateDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const updated = await deviceService.updateDevice(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}
