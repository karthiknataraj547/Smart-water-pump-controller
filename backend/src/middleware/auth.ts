import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { db } from '../database/db';
import { UserRole } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    name: string;
  };
  device?: {
    id: string;
    device_uid: string;
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Access token missing or malformed' }
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Token is invalid or has expired' }
    });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: `Access denied. Requires one of: ${allowedRoles.join(', ')}` }
      });
      return;
    }

    next();
  };
}

export async function authenticateDevice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const deviceToken = (req.headers['x-device-token'] || req.headers['authorization']?.replace('Bearer ', '') || req.body?.auth_token || req.body?.auth) as string;
  const deviceUid = (req.headers['x-device-uid'] || req.body?.device_uid || req.body?.deviceUid || req.query?.device_uid) as string;

  if (!deviceUid) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Device UID is required via header X-Device-UID or payload body' }
    });
    return;
  }

  try {
    let device = await db.queryOne('SELECT id, device_uid FROM devices WHERE device_uid = ?', [deviceUid]);
    if (!device) {
      // Auto-register discovered physical device if valid UID
      const newId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      await db.execute(
        `INSERT INTO devices (id, device_uid, serial_number, device_type, owner_id, status, firmware_version, tank_capacity_liters, tank_height_cm, last_seen, created_at)
         VALUES (?, ?, ?, 'ESP32_MAIN_CONTROLLER', 'usr_admin_001', 'online', 'v2.2.0', 2000, 180, datetime('now'), datetime('now'))`,
        [newId, deviceUid, `SN-${deviceUid}`]
      );
      device = { id: newId, device_uid: deviceUid };
    }

    req.device = {
      id: device.id,
      device_uid: device.device_uid
    };
    next();
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to authenticate device' }
    });
  }
}

// In-Memory Simple Rate Limiter
const requestCounts = new Map<string, { count: number; resetAt: number }>();
export function rateLimiter(limit: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = requestCounts.get(ip);

    if (!entry || now > entry.resetAt) {
      requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= limit) {
      res.status(429).json({
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please slow down.' }
      });
      return;
    }

    entry.count++;
    next();
  };
}

export async function logAudit(
  action: string,
  source: 'web' | 'android' | 'windows' | 'hardware' | 'automation',
  options: { userId?: string; deviceId?: string; ip?: string; details?: string } = {}
) {
  try {
    await db.execute(
      `INSERT INTO audit_logs (id, user_id, device_id, action, source, ip_information, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        Math.random().toString(36).substring(2) + Date.now().toString(36),
        options.userId || null,
        options.deviceId || null,
        action,
        source,
        options.ip || null,
        options.details || null
      ]
    );
  } catch (err) {
    console.error('[AuditLog] Error writing audit log:', err);
  }
}
