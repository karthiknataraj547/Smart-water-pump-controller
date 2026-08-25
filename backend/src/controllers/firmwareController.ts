import { Response } from 'express';
import { AuthenticatedRequest, logAudit } from '../middleware/auth';
import { pumpControlService } from '../services/PumpControlService';

export async function checkFirmwareVersion(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({
    success: true,
    data: {
      latestVersion: 'v1.4.2',
      releaseNotes: 'Enhanced ESP-NOW packet validation with CRC16, dry-run protection response time improved to 120s, BLE provisioning speed boost.',
      binaryUrl: 'https://updates.waterpump.io/firmware/v1.4.2/esp32_firmware_signed.bin',
      sha256Checksum: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      minRequiredHardwareRev: 'REV_2.0'
    }
  });
}

export async function triggerOtaUpdate(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { deviceId, version, binaryUrl } = req.body;
    if (!deviceId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'deviceId is required' } });
      return;
    }

    const result = await pumpControlService.sendPumpCommand({
      deviceId,
      commandType: 'OTA_START' as any,
      payload: {
        target_version: version || 'v1.4.2',
        download_url: binaryUrl || 'https://updates.waterpump.io/firmware/v1.4.2/esp32_firmware_signed.bin'
      },
      requestedBy: req.user?.name || 'ADMIN_USER',
      source: 'web'
    });

    await logAudit('FIRMWARE_OTA_TRIGGERED', 'web', {
      userId: req.user?.id,
      deviceId,
      details: `Target version: ${version || 'v1.4.2'}`
    });

    res.json({
      success: true,
      message: 'OTA Firmware update command issued to hardware controller',
      data: result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}
