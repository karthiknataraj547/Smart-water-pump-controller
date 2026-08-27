import http from 'http';
import express from 'express';
import cors from 'cors';
import { ENV } from './config/env';
import { db } from './database/db';
import apiRouter from './routes';
import { wsHub } from './services/WebSocketHub';
import { mqttBridge } from './services/MqttBridge';
import { telemetryService } from './services/TelemetryService';
import { pumpControlService } from './services/PumpControlService';
import { automationEngine } from './services/AutomationEngine';

async function bootstrap() {
  console.log('====================================================');
  console.log('  SMART IOT WATER PUMP CONTROL PLATFORM BACKEND     ');
  console.log('====================================================');

  // 1. Initialize Database
  await db.init();

  // 2. Create Express application
  const app = express();
  app.use(cors({ origin: ENV.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use(ENV.API_PREFIX, apiRouter);

  // Fallback 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` }
    });
  });

  // 3. Create HTTP Server
  const server = http.createServer(app);

  // 4. Initialize WebSocket Server
  wsHub.init(server);

  // 5. Connect Automation Engine to Pump Control Service
  automationEngine.setActionHandler(async (deviceId, action, reason) => {
    if (action === 'START') {
      await pumpControlService.sendPumpCommand({
        deviceId,
        commandType: 'START_PUMP',
        payload: { reason },
        requestedBy: 'SYSTEM_AUTOMATION',
        source: 'automation'
      });
    } else if (action === 'STOP') {
      await pumpControlService.sendPumpCommand({
        deviceId,
        commandType: 'STOP_PUMP',
        payload: { reason },
        requestedBy: 'SYSTEM_AUTOMATION',
        source: 'automation'
      });
    } else if (action === 'EMERGENCY_STOP') {
      await pumpControlService.sendPumpCommand({
        deviceId,
        commandType: 'EMERGENCY_STOP',
        payload: { reason },
        requestedBy: 'SAFETY_INTERLOCK',
        source: 'automation'
      });
    }
  });

  // In-Memory Device Heartbeat Timestamp Registry
  const deviceHeartbeats = new Map<string, number>();

  // 6. Initialize MQTT Bridge and register callbacks
  mqttBridge.init();
  mqttBridge.setCallbacks({
    onTelemetry: async (deviceUid, payload) => {
      deviceHeartbeats.set(deviceUid, Date.now());
      await telemetryService.ingestTelemetry({ device_uid: deviceUid, ...payload });
    },
    onAck: async (deviceUid, ackData) => {
      deviceHeartbeats.set(deviceUid, Date.now());
      await pumpControlService.handleHardwareAck(deviceUid, ackData);
    },
    onStatus: async (deviceUid, status) => {
      if (status === 'online') {
        deviceHeartbeats.set(deviceUid, Date.now());
      }
      console.log(`[Status] Device ${deviceUid} reported status: ${status}`);
      try {
        const dev = await db.queryOne<any>('SELECT * FROM devices WHERE device_uid = ?', [deviceUid]);
        if (dev) {
          await db.execute(
            `UPDATE devices SET status = ?, last_seen = datetime('now') WHERE id = ?`,
            [status, dev.id]
          );
          wsHub.broadcast('DEVICE_STATUS_CHANGED', {
            deviceId: dev.id,
            deviceUid: dev.device_uid,
            status
          });
        }
      } catch (err: any) {
        console.warn(`[Status] Error processing status update for ${deviceUid}:`, err.message);
      }
    }
  });

  // 7. Non-Destructive Heartbeat Watchdog (Checks every 5s with 30s timeout)
  setInterval(async () => {
    try {
      const now = Date.now();
      const onlineDevices = await db.query<any>(
        `SELECT id, device_uid FROM devices WHERE status = 'online'`
      );
      for (const dev of onlineDevices) {
        const lastSeen = deviceHeartbeats.get(dev.device_uid);
        if (lastSeen && (now - lastSeen > 30000)) {
          console.log(`[Watchdog] Device ${dev.device_uid} inactive (> 30s silence). Marking offline.`);
          await db.execute(`UPDATE devices SET status = 'offline' WHERE id = ?`, [dev.id]);
          wsHub.broadcast('DEVICE_STATUS_CHANGED', {
            deviceId: dev.id,
            deviceUid: dev.device_uid,
            status: 'offline'
          });
        }
      }
    } catch (e: any) {
      console.warn('[Watchdog] Error in heartbeat scanner:', e.message);
    }
  }, 5000);

  // 7. Start HTTP Server
  server.listen(ENV.PORT, () => {
    console.log(`[HTTP] Gateway REST API active at http://localhost:${ENV.PORT}${ENV.API_PREFIX}`);
    console.log(`[WS] Real-Time WebSocket active at ws://localhost:${ENV.PORT}/ws`);
    console.log(`[MQTT] Broker bridge active on port ${ENV.MQTT.port}`);
    console.log('----------------------------------------------------');
    console.log('  System Armed & Ready for Hardware Telemetry        ');
    console.log('====================================================');
  });
}

bootstrap().catch((err) => {
  console.error('[FATAL] Failed to start backend service:', err);
  process.exit(1);
});
