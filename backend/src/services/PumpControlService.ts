import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { wsHub } from './WebSocketHub';
import { mqttBridge } from './MqttBridge';
import { logAudit } from '../middleware/auth';
import { Device, DeviceCommand, PumpMode, PumpState, PumpStatus } from '../types';

export class PumpControlService {
  private static instance: PumpControlService;

  private constructor() {}

  public static getInstance(): PumpControlService {
    if (!PumpControlService.instance) {
      PumpControlService.instance = new PumpControlService();
    }
    return PumpControlService.instance;
  }

  public async getPumpStatus(deviceId: string): Promise<PumpStatus | null> {
    return db.queryOne<PumpStatus>(
      'SELECT * FROM pump_status WHERE device_id = ? ORDER BY changed_at DESC LIMIT 1',
      [deviceId]
    );
  }

  public async sendPumpCommand(params: {
    deviceId: string;
    commandType: 'START_PUMP' | 'STOP_PUMP' | 'SET_MODE' | 'EMERGENCY_STOP';
    payload?: Record<string, any>;
    requestedBy: string;
    source: 'web' | 'android' | 'windows' | 'automation';
  }): Promise<{ commandId: string; status: string; message: string }> {
    const device = await db.queryOne<Device>('SELECT * FROM devices WHERE id = ?', [params.deviceId]);
    if (!device) {
      throw new Error(`Device not found for ID ${params.deviceId}`);
    }

    const commandId = uuidv4();
    const payload = params.payload || {};

    // Validate Auto High-Level Cutoff (only blocks in AUTOMATIC mode)
    if (params.commandType === 'START_PUMP') {
      const currentStatus = await this.getPumpStatus(params.deviceId);
      if (currentStatus?.mode === 'AUTOMATIC') {
        const latestReading = await db.queryOne<{ water_level_percentage: number }>(
          'SELECT water_level_percentage FROM sensor_readings WHERE device_id = ? ORDER BY timestamp DESC LIMIT 1',
          [params.deviceId]
        );
        if (latestReading && Number(latestReading.water_level_percentage) >= 95.0) {
          throw new Error(
            `AUTOMATION SAFETY LOCK: Cannot start pump in AUTOMATIC mode because water level (${latestReading.water_level_percentage}%) has reached maximum auto cutoff (>= 95%). Switch to MANUAL mode to override.`
          );
        }
      }
    }

    // Record command in database with status 'pending'
    await db.execute(
      `INSERT INTO device_commands (id, device_id, command_type, payload, status, requested_by, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'))`,
      [commandId, params.deviceId, params.commandType, JSON.stringify(payload), params.requestedBy]
    );

    // Audit log
    await logAudit(`COMMAND_${params.commandType}`, params.source, {
      userId: params.requestedBy,
      deviceId: params.deviceId,
      details: JSON.stringify(payload)
    });

    // Notify connected UI clients that command was initiated
    wsHub.broadcastCommandStatus(commandId, device.device_uid, 'pending', {
      commandType: params.commandType,
      requestedBy: params.requestedBy
    });

    // If setting mode directly, update DB immediately
    if (params.commandType === 'SET_MODE' && payload.mode) {
      await db.execute(
        `UPDATE pump_status SET mode = ?, changed_at = datetime('now'), changed_by = ? WHERE device_id = ?`,
        [payload.mode, params.requestedBy, params.deviceId]
      );
      const updatedStatus = await this.getPumpStatus(params.deviceId);
      if (updatedStatus) {
        wsHub.broadcastPumpState(device.device_uid, updatedStatus);
      }
    }

    // Publish command over MQTT to ESP32 Main Node
    mqttBridge.publishCommand(device.device_uid, {
      command_id: commandId,
      command_type: params.commandType,
      payload,
      timestamp: Date.now()
    });

    // Dual-Path Direct Local HTTP REST dispatch
    if (device.local_ip && (device.local_ip.startsWith('10.') || device.local_ip.startsWith('192.168.'))) {
      const actionMap: Record<string, string> = {
        'START_PUMP': 'START',
        'STOP_PUMP': 'STOP',
        'EMERGENCY_STOP': 'EMERGENCY_STOP'
      };
      const action = actionMap[params.commandType] || params.commandType;
      fetch(`http://${device.local_ip}/api/v1/pump/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Auth': device.serial_number || ''
        },
        body: JSON.stringify({
          action,
          command_type: params.commandType,
          command_id: commandId,
          auth_code: device.serial_number || ''
        }),
        signal: AbortSignal.timeout(2000)
      }).catch(() => {});
    }

    // Update command status to 'sent'
    await db.execute(`UPDATE device_commands SET status = 'sent' WHERE id = ?`, [commandId]);
    wsHub.broadcastCommandStatus(commandId, device.device_uid, 'sent', payload);

    return {
      commandId,
      status: 'sent',
      message: `Command ${params.commandType} dispatched to hardware node ${device.device_uid}`
    };
  }

  public async handleHardwareAck(deviceUid: string, ackData: {
    command_id?: string;
    status: 'successful' | 'failed' | 'executing';
    confirmed_state: PumpState;
    current_amps?: number;
    runtime_seconds?: number;
    error_message?: string;
  }): Promise<void> {
    const device = await db.queryOne<Device>('SELECT * FROM devices WHERE device_uid = ?', [deviceUid]);
    if (!device) return;

    console.log(`[PumpControlService] Received Hardware ACK from ${deviceUid}:`, ackData);

    if (ackData.command_id) {
      await db.execute(
        `UPDATE device_commands SET status = ?, executed_at = datetime('now') WHERE id = ?`,
        [ackData.status, ackData.command_id]
      );
      wsHub.broadcastCommandStatus(ackData.command_id, deviceUid, ackData.status, ackData);
    }

    // Update actual confirmed hardware state and mark device online
    await db.execute(
      `UPDATE devices SET status = 'online', last_seen = datetime('now') WHERE id = ?`,
      [device.id]
    );

    const currentStatus = await this.getPumpStatus(device.id);
    const newPumpState = ackData.confirmed_state || 'OFF';
    const runtime = ackData.runtime_seconds !== undefined ? ackData.runtime_seconds : (currentStatus?.runtime_seconds || 0);
    const amps = ackData.current_amps !== undefined ? ackData.current_amps : 0.0;

    await db.execute(
      `UPDATE pump_status 
       SET pump_state = ?, runtime_seconds = ?, current_draw_amps = ?, changed_at = datetime('now'), changed_by = 'HARDWARE_ACK'
       WHERE device_id = ?`,
      [newPumpState, runtime, amps, device.id]
    );

    const updatedStatus = await this.getPumpStatus(device.id);
    if (updatedStatus) {
      wsHub.broadcastPumpState(deviceUid, updatedStatus);
    }
  }
}

export const pumpControlService = PumpControlService.getInstance();
