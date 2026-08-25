import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthenticatedRequest, logAudit } from '../middleware/auth';
import { User, Device, UserRole } from '../types';

// =====================================================================
// 1. USER DATABASE MANAGEMENT (CRUD)
// =====================================================================

export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await db.query<any>(
      `SELECT id, name, email, phone, role, status, created_at FROM users ORDER BY created_at DESC`
    );
    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, email, password, phone, role, status } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name, email, and password are required' }
      });
      return;
    }

    const existing = await db.queryOne<User>('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'A user with this email address already exists' }
      });
      return;
    }

    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);
    const validRole: UserRole = ['admin', 'operator', 'technician', 'viewer'].includes(role) ? role : 'operator';
    const userStatus = status === 'suspended' ? 'suspended' : 'active';

    await db.execute(
      `INSERT INTO users (id, name, email, phone, password_hash, role, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [userId, name, email, phone || null, passwordHash, validRole, userStatus]
    );

    await logAudit('ADMIN_CREATE_USER', 'web', {
      userId: req.user?.id,
      details: `Created new account for ${email} with role: ${validRole}`
    });

    res.status(201).json({
      success: true,
      data: {
        id: userId,
        name,
        email,
        phone: phone || null,
        role: validRole,
        status: userStatus
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, email, phone, role, status, password } = req.body;

    const targetUser = await db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    // Protect primary root admin from role demotion or suspension
    if (targetUser.email === 'admin@waterpump.io' && (role && role !== 'admin' || status === 'suspended')) {
      res.status(403).json({
        success: false,
        error: { code: 'PROTECTED_USER', message: 'Primary System Administrator account cannot be demoted or suspended' }
      });
      return;
    }

    let query = `UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), role = COALESCE(?, role), status = COALESCE(?, status)`;
    const params: any[] = [
      name || null,
      email || null,
      phone !== undefined ? phone : null,
      role || null,
      status || null
    ];

    if (password && password.trim().length > 0) {
      query += `, password_hash = ?`;
      params.push(bcrypt.hashSync(password, 10));
    }

    query += ` WHERE id = ?`;
    params.push(id);

    await db.execute(query, params);

    await logAudit('ADMIN_UPDATE_USER', 'web', {
      userId: req.user?.id,
      details: `Updated account details for ${targetUser.email}`
    });

    const updated = await db.queryOne<any>(
      `SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = ?`,
      [id]
    );

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const targetUser = await db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    if (targetUser.id === req.user?.id) {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own logged-in administrator account' }
      });
      return;
    }

    if (targetUser.email === 'admin@waterpump.io') {
      res.status(403).json({
        success: false,
        error: { code: 'PROTECTED_USER', message: 'Primary System Administrator cannot be deleted' }
      });
      return;
    }

    await db.execute('DELETE FROM users WHERE id = ?', [id]);

    await logAudit('ADMIN_DELETE_USER', 'web', {
      userId: req.user?.id,
      details: `Deleted account for ${targetUser.email}`
    });

    res.json({ success: true, message: `User ${targetUser.name} deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

// =====================================================================
// 2. AUDIT LOGS & ACCESS HISTORY
// =====================================================================

export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const limit = Math.min(200, Math.max(10, Number(req.query.limit || 50)));
    const search = req.query.search ? `%${req.query.search}%` : null;

    let query = `
      SELECT al.*, u.name as user_name, u.email as user_email, d.device_uid 
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN devices d ON al.device_id = d.id
    `;
    const params: any[] = [];

    if (search) {
      query += ` WHERE al.action LIKE ? OR al.details LIKE ? OR u.name LIKE ? OR u.email LIKE ?`;
      params.push(search, search, search, search);
    }

    query += ` ORDER BY al.created_at DESC LIMIT ?`;
    params.push(limit);

    const logs = await db.query<any>(query, params);
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

// =====================================================================
// 3. SYSTEM STATS & GATEWAY HEALTH
// =====================================================================

export async function getAdminStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
    const deviceCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM devices');
    const onlineDevices = await db.queryOne<{ count: number }>("SELECT COUNT(*) as count FROM devices WHERE status = 'online'");
    const activeAlerts = await db.queryOne<{ count: number }>("SELECT COUNT(*) as count FROM alerts WHERE acknowledged = 0");
    const readingsCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM sensor_readings');
    const commandsToday = await db.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM device_commands WHERE created_at >= date('now')"
    );

    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = process.uptime();

    res.json({
      success: true,
      data: {
        total_users: userCount?.count || 0,
        total_devices: deviceCount?.count || 0,
        online_devices: onlineDevices?.count || 0,
        active_alerts: activeAlerts?.count || 0,
        total_readings: readingsCount?.count || 0,
        commands_today: commandsToday?.count || 0,
        system_uptime_seconds: Math.floor(uptimeSeconds),
        heap_used_mb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(1),
        node_version: process.version,
        mqtt_broker_port: 1883,
        ws_server_port: 5000
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

// =====================================================================
// 4. DEVICE FLEET GOVERNANCE & SETTINGS
// =====================================================================

export async function updateDeviceConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { tank_capacity_liters, tank_height_cm, owner_id } = req.body;

    const device = await db.queryOne<Device>('SELECT * FROM devices WHERE id = ?', [id]);
    if (!device) {
      res.status(404).json({ success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' } });
      return;
    }

    await db.execute(
      `UPDATE devices 
       SET tank_capacity_liters = COALESCE(?, tank_capacity_liters),
           tank_height_cm = COALESCE(?, tank_height_cm),
           owner_id = COALESCE(?, owner_id),
           updated_at = datetime('now')
       WHERE id = ?`,
      [tank_capacity_liters || null, tank_height_cm || null, owner_id || null, id]
    );

    await logAudit('ADMIN_UPDATE_DEVICE', 'web', {
      userId: req.user?.id,
      deviceId: id,
      details: `Updated capacity to ${tank_capacity_liters || device.tank_capacity_liters}L`
    });

    const updated = await db.queryOne<Device>('SELECT * FROM devices WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}
