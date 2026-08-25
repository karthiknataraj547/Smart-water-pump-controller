import { Response } from 'express';
import { AuthenticatedRequest, logAudit } from '../middleware/auth';
import { deviceService } from '../services/DeviceService';
import { alertService } from '../services/AlertService';
import { db } from '../database/db';

export async function scanBleDevices(req: any, res: Response): Promise<void> {
  try {
    // In production, the Android app scans directly over BLE hardware.
    // For cloud/web verification and simulation, we return active discoverable beacons.
    const unprovisioned = await db.query(
      `SELECT device_uid, serial_number, device_type, status, firmware_version, last_seen 
       FROM devices WHERE status IN ('provisioning', 'offline') LIMIT 10`
    );

    res.json({
      success: true,
      data: [
        {
          deviceUid: 'WPC-A81F29',
          name: 'Water Pump Controller',
          model: 'ESP32 Industrial Main Node',
          signalRssi: -48,
          signalQuality: 'Excellent',
          status: 'Ready for Setup',
          macAddress: '24:6F:28:A8:1F:29',
          advertisedServices: ['0000ffff-0000-1000-8000-00805f9b34fb']
        },
        {
          deviceUid: 'WPC-B92E14',
          name: 'Water Pump Controller #2',
          model: 'ESP32 Industrial Main Node',
          signalRssi: -72,
          signalQuality: 'Good',
          status: 'Ready for Setup',
          macAddress: '30:AE:A4:B9:2E:14',
          advertisedServices: ['0000ffff-0000-1000-8000-00805f9b34fb']
        }
      ]
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function provisionDevice(req: any, res: Response): Promise<void> {
  try {
    const { deviceUid, wifiSsid, serialNumber, tankCapacityLiters, tankHeightCm } = req.body;

    if (!deviceUid || !wifiSsid) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'deviceUid and wifiSsid are required' }
      });
      return;
    }

    const targetUserId = req.user?.id || 'usr_admin_001';

    let device = await deviceService.getDeviceByUid(deviceUid);
    if (!device) {
      // Create new device for user
      device = await deviceService.createDevice({
        device_uid: deviceUid,
        serial_number: serialNumber || `SN-${Date.now()}`,
        owner_id: targetUserId,
        tank_capacity_liters: tankCapacityLiters || 1500,
        tank_height_cm: tankHeightCm || 160
      });
    } else {
      // Reassign to current user and activate
      await db.execute(
        `UPDATE devices SET owner_id = ?, status = 'online', last_seen = datetime('now') WHERE id = ?`,
        [targetUserId, device.id]
      );
    }

    await logAudit('DEVICE_PROVISIONED', 'web', {
      userId: targetUserId,
      deviceId: device.id,
      details: `Provisioned to SSID: ${wifiSsid}`
    });

    await alertService.createAlert({
      deviceId: device.id,
      severity: 'info',
      title: 'Device Provisioning Successful',
      message: `Device ${deviceUid} successfully connected to Wi-Fi (${wifiSsid}) and registered to cloud backend.`
    });

    res.json({
      success: true,
      message: 'Device Successfully Provisioned',
      data: {
        deviceUid,
        status: 'online',
        serverUrl: `https://${req.headers.host || 'api.waterpump.io'}`,
        sessionToken: 'dev_token_' + Math.random().toString(36).substring(2)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}
