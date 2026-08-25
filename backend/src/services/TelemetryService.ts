import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { wsHub } from './WebSocketHub';
import { automationEngine } from './AutomationEngine';
import { Device, DeviceNode, SensorReading, TelemetryPayload } from '../types';

export class TelemetryService {
  private static instance: TelemetryService;

  private constructor() {}

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public async ingestTelemetry(payload: TelemetryPayload): Promise<void> {
    const device = await db.queryOne<Device>('SELECT * FROM devices WHERE device_uid = ?', [payload.device_uid]);
    if (!device) {
      console.warn(`[TelemetryService] Received telemetry for unknown device: ${payload.device_uid}`);
      return;
    }

    const rawLevel = payload.water_level_pct !== undefined ? payload.water_level_pct : (payload as any).water_level_percentage;
    const waterLevelPct = isNaN(Number(rawLevel)) ? 0.0 : Math.min(100.0, Math.max(0.0, Number(rawLevel)));
    const tankCapacity = device.tank_capacity_liters || 1000.0;
    const rawLiters = payload.water_liters !== undefined ? payload.water_liters : (payload as any).water_level_liters;
    const waterLiters = isNaN(Number(rawLiters)) ? (waterLevelPct / 100.0) * tankCapacity : Number(rawLiters);

    const flowRate = Math.max(0.0, Number(payload.flow_rate_lpm || (payload as any).inflow_rate_lpm || 0.0));
    const totalInflow = Math.max(0.0, Number(payload.total_inflow_liters || (payload as any).total_inflow_l || 0.0));
    const tdsPpm = Math.max(0.0, Number(payload.tds_ppm || 0.0));
    const tempC = Number(payload.temperature_c || 0.0);
    const sensorStatus = (payload.sensor_health_mask === undefined || payload.sensor_health_mask === 0) ? 'HEALTHY' : 'DEGRADED';

    const readingId = uuidv4();

    // Insert time-series sensor reading
    await db.execute(
      `INSERT INTO sensor_readings (id, device_id, water_level_percentage, water_level_liters, inflow_rate_lpm, total_inflow_liters, tds_ppm, temperature_c, sensor_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [readingId, device.id, waterLevelPct, waterLiters, flowRate, totalInflow, tdsPpm, tempC, sensorStatus]
    );

    // Update main device last_seen and status
    await db.execute(
      `UPDATE devices SET status = 'online', last_seen = datetime('now') WHERE id = ?`,
      [device.id]
    );

    // Update Sub Node if provided
    let subnodeOnline = true;
    if (payload.node_uid) {
      const subnode = await db.queryOne<DeviceNode>(
        'SELECT * FROM device_nodes WHERE node_uid = ? AND main_device_id = ?',
        [payload.node_uid, device.id]
      );
      if (subnode) {
        await db.execute(
          `UPDATE device_nodes 
           SET communication_status = 'connected', rssi = ?, battery_level = ?, last_seen = datetime('now') 
           WHERE id = ?`,
          [payload.rssi || -65, payload.battery_mv ? (payload.battery_mv / 42.0) : 100.0, subnode.id]
        );
      }
    }

    // Broadcast live telemetry to all connected clients (Web, Mobile, Windows Projector)
    const telemetryBroadcast = {
      readingId,
      deviceUid: device.device_uid,
      deviceId: device.id,
      waterLevelPercentage: waterLevelPct,
      waterLevelLiters: waterLiters,
      inflowRateLpm: flowRate,
      totalInflowLiters: totalInflow,
      tdsPpm,
      temperatureC: tempC,
      sensorStatus,
      rssi: payload.rssi || -65,
      batteryMv: payload.battery_mv || 3300,
      timestamp: new Date().toISOString()
    };

    wsHub.broadcastTelemetry(device.device_uid, telemetryBroadcast);

    // Evaluate Automation rules
    await automationEngine.evaluateRules(device.id, {
      water_level_pct: waterLevelPct,
      flow_rate_lpm: flowRate,
      subnode_online: subnodeOnline
    });
  }

  public async getLatestReading(deviceId: string): Promise<SensorReading | null> {
    return db.queryOne<SensorReading>(
      'SELECT * FROM sensor_readings WHERE device_id = ? ORDER BY created_at DESC LIMIT 1',
      [deviceId]
    );
  }

  public async getHistory(deviceId: string, hours: number = 24): Promise<SensorReading[]> {
    return db.query<SensorReading>(
      `SELECT * FROM sensor_readings 
       WHERE device_id = ? AND created_at >= datetime('now', ? || ' hours')
       ORDER BY created_at ASC`,
      [deviceId, `-${hours}`]
    );
  }
}

export const telemetryService = TelemetryService.getInstance();
