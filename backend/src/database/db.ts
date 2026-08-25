import fs from 'fs';
import path from 'path';
import mysql, { Pool } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { ENV } from '../config/env';

interface InMemoryTableStore {
  users: any[];
  devices: any[];
  device_nodes: any[];
  pump_status: any[];
  sensor_readings: any[];
  automation_rules: any[];
  alerts: any[];
  audit_logs: any[];
  device_commands: any[];
}

export class DBManager {
  private static instance: DBManager;
  private mysqlPool?: Pool;
  private memoryStore: InMemoryTableStore = {
    users: [],
    devices: [],
    device_nodes: [],
    pump_status: [],
    sensor_readings: [],
    automation_rules: [],
    alerts: [],
    audit_logs: [],
    device_commands: []
  };
  private storageFile: string;
  public dbType: 'sqlite' | 'mysql';

  private constructor() {
    this.dbType = ENV.DB_TYPE;
    this.storageFile = path.resolve(process.cwd(), './data/water_pump_db.json');
  }

  public static getInstance(): DBManager {
    if (!DBManager.instance) {
      DBManager.instance = new DBManager();
    }
    return DBManager.instance;
  }

  public async init(): Promise<void> {
    if (this.dbType === 'mysql') {
      try {
        console.log('[DB] Connecting to MySQL at', `${ENV.MYSQL.host}:${ENV.MYSQL.port}...`);
        this.mysqlPool = mysql.createPool({
          host: ENV.MYSQL.host,
          port: ENV.MYSQL.port,
          user: ENV.MYSQL.user,
          password: ENV.MYSQL.password,
          database: ENV.MYSQL.database,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0
        });

        const connection = await this.mysqlPool.getConnection();
        connection.release();
        console.log('[DB] MySQL connection established successfully.');
        await this.runMysqlMigrations();
      } catch (err: any) {
        console.warn('[DB] MySQL connection failed. Using local persistent storage engine:', err.message);
        this.dbType = 'sqlite';
        await this.initFileStore();
      }
    } else {
      await this.initFileStore();
    }
  }

  private async initFileStore(): Promise<void> {
    const dir = path.dirname(this.storageFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.storageFile)) {
      try {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        this.memoryStore = { ...this.memoryStore, ...JSON.parse(raw) };
        console.log('[DB] Loaded persistent data store from:', this.storageFile);
      } catch (e) {
        console.warn('[DB] Could not parse existing DB file. Starting fresh.');
      }
    }

    await this.seedInitialData();
  }

  private persistFileStore(): void {
    try {
      fs.writeFileSync(this.storageFile, JSON.stringify(this.memoryStore, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to persist file store:', err);
    }
  }

  private async runMysqlMigrations(): Promise<void> {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const statements = schemaSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const sql of statements) {
      if (this.mysqlPool) {
        await this.mysqlPool.execute(sql);
      }
    }
    await this.seedInitialData();
  }

  private async seedInitialData(): Promise<void> {
    const existingAdmin = await this.queryOne<any>('SELECT * FROM users WHERE email = ?', ['admin@waterpump.io']);
    if (!existingAdmin) {
      console.log('[DB] Seeding default administrator and test controller...');
      const adminId = uuidv4();
      const passHash = bcrypt.hashSync('Admin@123456', 10);
      await this.execute(
        'INSERT INTO users (id, name, email, phone, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))',
        [adminId, 'Chief IoT Operator', 'admin@waterpump.io', '+1-800-555-PUMP', passHash, 'admin', 'active']
      );

      const deviceId = uuidv4();
      const deviceUid = 'WPC-A81F29';
      await this.execute(
        `INSERT INTO devices (id, device_uid, serial_number, device_type, owner_id, status, firmware_version, local_ip, mac_address, tank_capacity_liters, tank_height_cm, last_seen, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [deviceId, deviceUid, 'SN-2026-ESP32-9921', 'ESP32_MAIN_CONTROLLER', adminId, 'online', 'v1.4.2', '192.168.1.145', '24:6F:28:A8:1F:29', 2000.0, 180.0]
      );

      const subnodeId = uuidv4();
      await this.execute(
        `INSERT INTO device_nodes (id, main_device_id, node_uid, node_type, communication_status, rssi, battery_level, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [subnodeId, deviceId, 'TNK-SUB-8266-01', 'esp8266_tank_subnode', 'connected', -62, 98.5]
      );

      const pumpStatusId = uuidv4();
      await this.execute(
        `INSERT INTO pump_status (id, device_id, pump_state, mode, runtime_seconds, current_draw_amps, changed_at, changed_by)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
        [pumpStatusId, deviceId, 'OFF', 'AUTOMATIC', 0, 0.0, 'SYSTEM_INIT']
      );

      await this.execute(
        `INSERT INTO automation_rules (id, device_id, rule_name, condition_json, action_json, enabled, priority, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          uuidv4(),
          deviceId,
          'Auto-Start on Low Tank (< 30%)',
          JSON.stringify({ level_lt: 30, subnode_online: true }),
          JSON.stringify({ pump_action: 'START', generate_alert: true, alert_title: 'Auto-Start: Low Water Threshold Reached' }),
          1,
          1
        ]
      );

      await this.execute(
        `INSERT INTO automation_rules (id, device_id, rule_name, condition_json, action_json, enabled, priority, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          uuidv4(),
          deviceId,
          'Auto-Stop on Tank Full (> 95%)',
          JSON.stringify({ level_gt: 95 }),
          JSON.stringify({ pump_action: 'STOP', generate_alert: true, alert_title: 'Auto-Stop: Tank Capacity Reached (95%)' }),
          1,
          1
        ]
      );

      await this.execute(
        `INSERT INTO automation_rules (id, device_id, rule_name, condition_json, action_json, enabled, priority, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          uuidv4(),
          deviceId,
          'Dry-Run Protection (Zero Inflow for 2 mins)',
          JSON.stringify({ no_flow_timeout_seconds: 120 }),
          JSON.stringify({ pump_action: 'EMERGENCY_STOP', generate_alert: true, alert_severity: 'critical', alert_title: 'DRY RUN PROTECTION: No Water Inflow Detected' }),
          1,
          0
        ]
      );

      await this.execute(
        `INSERT INTO alerts (id, device_id, severity, title, message, acknowledged, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [uuidv4(), deviceId, 'info', 'System Online & Armed', 'Smart Water Pump Controller initialized with local fail-safe automation and ESP-NOW Sub Node link.', 0]
      );

      console.log('[DB] Seeding completed successfully. Default Login: admin@waterpump.io / Admin@123456');
    }

    // Ensure all devices have valid automation rules
    const allDevices = await this.query<any>('SELECT id FROM devices');
    for (const dev of allDevices) {
      const existingRules = await this.query<any>('SELECT * FROM automation_rules WHERE device_id = ?', [dev.id]);
      if (existingRules.length === 0) {
        console.log(`[DB] Seeding default automation rules for device ${dev.id}...`);
        await this.execute(
          `INSERT INTO automation_rules (id, device_id, rule_name, condition_json, action_json, enabled, priority, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            uuidv4(),
            dev.id,
            'Auto-Start on Low Tank (< 30%)',
            JSON.stringify({ level_lt: 30 }),
            JSON.stringify({ pump_action: 'START', generate_alert: true, alert_title: 'Auto-Start: Low Water Threshold (< 30%)' }),
            1,
            1
          ]
        );
        await this.execute(
          `INSERT INTO automation_rules (id, device_id, rule_name, condition_json, action_json, enabled, priority, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            uuidv4(),
            dev.id,
            'Auto-Stop on Tank Full (>= 95%)',
            JSON.stringify({ level_gt: 95 }),
            JSON.stringify({ pump_action: 'STOP', generate_alert: true, alert_title: 'Auto-Stop: Tank Capacity Reached (>= 95%)' }),
            1,
            1
          ]
        );
      }
    }
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.dbType === 'mysql' && this.mysqlPool) {
      const [rows] = await this.mysqlPool.query(sql, params);
      return rows as T[];
    }

    // High performance local query engine
    return this.executeMemoryQuery<T>(sql, params);
  }

  public async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  public async execute(sql: string, params: any[] = []): Promise<any> {
    if (this.dbType === 'mysql' && this.mysqlPool) {
      const [result] = await this.mysqlPool.execute(sql, params);
      return result;
    }

    return this.executeMemoryCommand(sql, params);
  }

  private executeMemoryQuery<T = any>(sql: string, params: any[]): T[] {
    const cleanSql = sql.trim().replace(/\s+/g, ' ');
    const lower = cleanSql.toLowerCase();

    // Determine target table
    const tableMatch = lower.match(/from\s+([a-z_]+)/i);
    if (!tableMatch) return [];
    const tableName = tableMatch[1] as keyof InMemoryTableStore;
    const table = this.memoryStore[tableName] || [];

    let results = [...table];

    // Filter matching
    if (lower.includes('where')) {
      const wherePart = cleanSql.substring(cleanSql.toLowerCase().indexOf('where') + 5).split(/order by|limit/i)[0].trim();
      let paramIdx = 0;

      if (/\bemail\s*=\s*\?/i.test(wherePart)) {
        const val = params[paramIdx++];
        results = results.filter(r => r.email === val);
      }
      if (/\bdevice_uid\s*=\s*\?/i.test(wherePart)) {
        const val = params[paramIdx++];
        results = results.filter(r => r.device_uid === val);
      }
      if (/\bmain_device_id\s*=\s*\?/i.test(wherePart)) {
        const val = params[paramIdx++];
        results = results.filter(r => r.main_device_id === val);
      }
      if (/\bdevice_id\s*=\s*\?/i.test(wherePart)) {
        const val = params[paramIdx++];
        results = results.filter(r => r.device_id === val);
      }
      if (/\bnode_uid\s*=\s*\?/i.test(wherePart)) {
        const val = params[paramIdx++];
        results = results.filter(r => r.node_uid === val);
      }
      if (/\bowner_id\s*=\s*\?/i.test(wherePart)) {
        const val = params[paramIdx++];
        results = results.filter(r => r.owner_id === val);
      }
      if (/(^|[\s(])id\s*=\s*\?/i.test(wherePart) && !/\b(device|owner|main_device|node)_id\s*=\s*\?/i.test(wherePart)) {
        const val = params[paramIdx++];
        results = results.filter(r => r.id === val);
      }
      if (/\benabled\s*=\s*1\b/i.test(wherePart)) {
        results = results.filter(r => r.enabled === 1 || r.enabled === true);
      }
      if (/status\s+in\s*\('provisioning',\s*'offline'\)/i.test(wherePart)) {
        results = results.filter(r => r.status === 'provisioning' || r.status === 'offline');
      }
    }

    // Sorting
    if (lower.includes('order by created_at desc')) {
      results.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } else if (lower.includes('order by priority asc')) {
      results.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    } else if (lower.includes('order by changed_at desc')) {
      results.sort((a, b) => new Date(b.changed_at || 0).getTime() - new Date(a.changed_at || 0).getTime());
    }

    // Limit
    if (lower.includes('limit')) {
      const limitMatch = lower.match(/limit\s+(\d+|\?)/i);
      if (limitMatch) {
        let limitVal = 50;
        if (limitMatch[1] === '?') {
          limitVal = params[params.length - 1] || 50;
        } else {
          limitVal = parseInt(limitMatch[1], 10);
        }
        results = results.slice(0, limitVal);
      }
    }

    return results as T[];
  }

  private executeMemoryCommand(sql: string, params: any[]): any {
    const cleanSql = sql.trim().replace(/\s+/g, ' ');
    const lower = cleanSql.toLowerCase();

    if (lower.startsWith('insert into')) {
      const tableMatch = lower.match(/insert into\s+([a-z_]+)/i);
      if (!tableMatch) return { affectedRows: 0 };
      const tableName = tableMatch[1] as keyof InMemoryTableStore;

      // Extract column names
      const colsMatch = cleanSql.match(/\(([^)]+)\)\s+values/i);
      if (!colsMatch) return { affectedRows: 0 };
      const cols = colsMatch[1].split(',').map(c => c.trim());

      const newRecord: any = {};
      cols.forEach((col, idx) => {
        let val = params[idx];
        if (val === undefined) {
          if (cleanSql.includes("datetime('now')") || cleanSql.includes('datetime("now")')) {
            val = new Date().toISOString();
          }
        }
        newRecord[col] = val;
      });

      if (!newRecord.created_at) newRecord.created_at = new Date().toISOString();
      if (!newRecord.id) newRecord.id = uuidv4();

      if (!this.memoryStore[tableName]) this.memoryStore[tableName] = [];
      this.memoryStore[tableName].push(newRecord);
      this.persistFileStore();
      return { affectedRows: 1, insertId: newRecord.id, changes: 1 };
    }

    if (lower.startsWith('update')) {
      const tableMatch = lower.match(/update\s+([a-z_]+)\s+set\s+(.+?)\s+where\s+(.+)/i);
      if (!tableMatch) return { affectedRows: 0 };
      const tableName = tableMatch[1] as keyof InMemoryTableStore;
      const setClause = tableMatch[2];
      const whereClause = tableMatch[3];
      const table = this.memoryStore[tableName] || [];

      // Parse SET assignments: "status = 'online', last_seen = datetime('now')" or "status = ?, last_seen = ?"
      const assignments = setClause.split(',').map(s => s.trim());
      let paramIdx = 0;
      const updatesToApply: Record<string, any> = {};

      for (const assign of assignments) {
        const parts = assign.split('=').map(p => p.trim());
        if (parts.length === 2) {
          const col = parts[0];
          const valExpr = parts[1];
          if (valExpr === '?') {
            updatesToApply[col] = params[paramIdx++];
          } else if (valExpr.toLowerCase().includes("datetime('now')") || valExpr.toLowerCase().includes('datetime("now")')) {
            updatesToApply[col] = new Date().toISOString();
          } else if (valExpr.startsWith("'") && valExpr.endsWith("'")) {
            updatesToApply[col] = valExpr.substring(1, valExpr.length - 1);
          } else if (valExpr.startsWith('"') && valExpr.endsWith('"')) {
            updatesToApply[col] = valExpr.substring(1, valExpr.length - 1);
          } else if (!isNaN(Number(valExpr))) {
            updatesToApply[col] = Number(valExpr);
          } else {
            updatesToApply[col] = valExpr;
          }
        }
      }

      const whereVal = params[paramIdx] !== undefined ? params[paramIdx] : params[params.length - 1];
      let updatedCount = 0;

      table.forEach(item => {
        const match = (whereClause.includes('id = ?') && (item.id === whereVal || item.device_id === whereVal || item.main_device_id === whereVal)) ||
                      (whereClause.includes('device_id = ?') && item.device_id === whereVal) ||
                      (whereClause.includes('device_uid = ?') && item.device_uid === whereVal) ||
                      (whereClause.includes('main_device_id = ?') && item.main_device_id === whereVal) ||
                      (item.id === whereVal || item.device_id === whereVal || item.device_uid === whereVal);
        if (match) {
          Object.assign(item, updatesToApply);
          item.updated_at = new Date().toISOString();
          updatedCount++;
        }
      });

      this.persistFileStore();
      return { affectedRows: updatedCount, changes: updatedCount };
    }

    if (lower.startsWith('delete from')) {
      const tableMatch = lower.match(/delete from\s+([a-z_]+)/i);
      if (!tableMatch) return { affectedRows: 0 };
      const tableName = tableMatch[1] as keyof InMemoryTableStore;
      const idToDelete = params[0];

      if (this.memoryStore[tableName]) {
        const prevLen = this.memoryStore[tableName].length;
        this.memoryStore[tableName] = this.memoryStore[tableName].filter(r => r.id !== idToDelete);
        const deleted = prevLen - this.memoryStore[tableName].length;
        this.persistFileStore();
        return { affectedRows: deleted, changes: deleted };
      }
    }

    return { affectedRows: 0, changes: 0 };
  }
}

export const db = DBManager.getInstance();
