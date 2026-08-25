import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  role?: string;
  clientType: 'web' | 'android' | 'windows' | 'simulator';
  isAlive: boolean;
}

export class WebSocketHub {
  private static instance: WebSocketHub;
  private wss?: WebSocketServer;
  private clients: Set<ClientConnection> = new Set();
  private pingInterval?: NodeJS.Timeout;

  private constructor() {}

  public static getInstance(): WebSocketHub {
    if (!WebSocketHub.instance) {
      WebSocketHub.instance = new WebSocketHub();
    }
    return WebSocketHub.instance;
  }

  public init(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const clientType = (url.searchParams.get('clientType') || 'web') as any;

      let userId: string | undefined;
      let role: string | undefined;

      if (token) {
        try {
          const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
          userId = decoded.id;
          role = decoded.role;
        } catch (e) {
          // Allow anonymous read-only monitoring or reject if in strict mode
        }
      }

      const clientConn: ClientConnection = {
        ws,
        userId,
        role,
        clientType,
        isAlive: true
      };

      this.clients.add(clientConn);
      console.log(`[WebSocketHub] Client connected (${clientType}, user: ${userId || 'anonymous'}). Total clients: ${this.clients.size}`);

      // Send initial welcome message
      ws.send(JSON.stringify({
        event: 'CONNECTION_ESTABLISHED',
        data: {
          serverTime: new Date().toISOString(),
          clientType,
          status: 'CONNECTED'
        }
      }));

      ws.on('pong', () => {
        clientConn.isAlive = true;
      });

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          this.handleClientMessage(clientConn, parsed);
        } catch (err) {
          console.warn('[WebSocketHub] Received non-JSON message:', message);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientConn);
        console.log(`[WebSocketHub] Client disconnected. Total clients: ${this.clients.size}`);
      });
    });

    // Heartbeat ping interval
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client) => {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(client);
          return;
        }
        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000);
  }

  private handleClientMessage(client: ClientConnection, data: any): void {
    if (data.action === 'PING') {
      client.ws.send(JSON.stringify({ event: 'PONG', timestamp: Date.now() }));
    }
  }

  public broadcast(event: string, payload: any): void {
    const message = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  public broadcastTelemetry(deviceUid: string, telemetry: any): void {
    this.broadcast('TELEMETRY_UPDATE', { deviceUid, ...telemetry });
  }

  public broadcastPumpState(deviceUid: string, pumpStatus: any): void {
    this.broadcast('PUMP_STATE_CHANGED', { deviceUid, ...pumpStatus });
  }

  public broadcastAlert(alert: any): void {
    this.broadcast('ALERT_TRIGGERED', alert);
  }

  public broadcastCommandStatus(commandId: string, deviceUid: string, status: string, payload: any): void {
    this.broadcast('COMMAND_STATUS_UPDATE', { commandId, deviceUid, status, payload });
  }
}

export const wsHub = WebSocketHub.getInstance();
