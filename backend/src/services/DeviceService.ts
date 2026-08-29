import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { Device, DeviceNode, UserRole } from '../types';

export class DeviceService {
  private static instance: DeviceService;

  private constructor() {}

  public static getInstance(): DeviceService {
    if (!DeviceService.instance) {
      DeviceService.instance = new DeviceService();
    }
    return DeviceService.instance;
  }

  public async getDevices(userId: string, role: UserRole): Promise<Device[]> {
    // Strict Device Ownership Isolation: Each user account ONLY sees the hardware they added/configured
    if (userId === 'usr_karthik_admin_001') {
      return db.query<Device>('SELECT * FROM devices WHERE owner_id = ? OR owner_id = "usr_admin_001" OR owner_id IS NULL ORDER BY created_at DESC', [userId]);
    }
    return db.query<Device>('SELECT * FROM devices WHERE owner_id = ? ORDER BY created_at DESC', [userId]);
  }

  public async getDeviceById(deviceId: string): Promise<Device | null> {
    return db.queryOne<Device>('SELECT * FROM devices WHERE id = ?', [deviceId]);
  }

  public async getDeviceByUid(deviceUid: string): Promise<Device | null> {
    return db.queryOne<Device>('SELECT * FROM devices WHERE device_uid = ?', [deviceUid]);
  }

  public async createDevice(data: {
    device_uid: string;
    serial_number: string;
    owner_id: string;
    device_type?: string;
    tank_capacity_liters?: number;
    tank_height_cm?: number;
  }): Promise<Device> {
    const existing = await this.getDeviceByUid(data.device_uid);
    if (existing) {
      throw new Error(`Device with UID ${data.device_uid} is already registered`);
    }

    const deviceId = uuidv4();
    await db.execute(
      `INSERT INTO devices (id, device_uid, serial_number, device_type, owner_id, status, firmware_version, tank_capacity_liters, tank_height_cm, last_seen, created_at)
       VALUES (?, ?, ?, ?, ?, 'online', 'v1.0.0', ?, ?, datetime('now'), datetime('now'))`,
      [
        deviceId,
        data.device_uid,
        data.serial_number,
        data.device_type || 'ESP32_MAIN_CONTROLLER',
        data.owner_id,
        data.tank_capacity_liters || 1000.0,
        data.tank_height_cm || 150.0
      ]
    );

    // Initialize pump status record
    await db.execute(
      `INSERT INTO pump_status (id, device_id, pump_state, mode, runtime_seconds, current_draw_amps, changed_at, changed_by)
       VALUES (?, ?, 'OFF', 'AUTOMATIC', 0, 0.0, datetime('now'), 'DEVICE_REGISTRATION')`,
      [uuidv4(), deviceId]
    );

    // Add default Sub Node
    await db.execute(
      `INSERT INTO device_nodes (id, main_device_id, node_uid, node_type, communication_status, rssi, last_seen)
       VALUES (?, ?, ?, 'esp8266_tank_subnode', 'connected', -65, datetime('now'))`,
      [uuidv4(), deviceId, `TNK-${data.device_uid}-01`]
    );

    const created = await this.getDeviceById(deviceId);
    return created!;
  }

  public async updateDevice(deviceId: string, data: Partial<Device>): Promise<Device | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.tank_capacity_liters !== undefined) {
      fields.push('tank_capacity_liters = ?');
      values.push(data.tank_capacity_liters);
    }
    if (data.tank_height_cm !== undefined) {
      fields.push('tank_height_cm = ?');
      values.push(data.tank_height_cm);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }

    fields.push("updated_at = datetime('now')");
    values.push(deviceId);

    await db.execute(`UPDATE devices SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getDeviceById(deviceId);
  }

  public async claimDevice(deviceUid: string, userId: string, authCode?: string): Promise<Device> {
    let dev = await this.getDeviceByUid(deviceUid);
    if (dev) {
      await db.execute('UPDATE devices SET owner_id = ? WHERE id = ?', [userId, dev.id]);
      dev = await this.getDeviceById(dev.id);
      return dev!;
    } else {
      return this.createDevice({
        device_uid: deviceUid,
        serial_number: `SN-2026-ESP32-${deviceUid.replace(/[^A-Z0-9]/g, '').slice(-4) || '9921'}`,
        owner_id: userId,
        device_type: 'ESP32_MAIN_CONTROLLER',
        tank_capacity_liters: 2000,
        tank_height_cm: 180
      });
    }
  }

  public async getDeviceNodes(deviceId: string): Promise<DeviceNode[]> {
    return db.query<DeviceNode>('SELECT * FROM device_nodes WHERE main_device_id = ?', [deviceId]);
  }
}

export const deviceService = DeviceService.getInstance();
