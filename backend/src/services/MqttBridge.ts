import net from 'net';
import Aedes from 'aedes';
import { ENV } from '../config/env';
import { wsHub } from './WebSocketHub';

export class MqttBridge {
  private static instance: MqttBridge;
  private aedesInstance?: any;
  private tcpServer?: net.Server;
  private onTelemetryCallback?: (deviceUid: string, payload: any) => Promise<void>;
  private onAckCallback?: (deviceUid: string, ackData: any) => Promise<void>;
  private onStatusCallback?: (deviceUid: string, status: string) => Promise<void>;

  private constructor() {}

  public static getInstance(): MqttBridge {
    if (!MqttBridge.instance) {
      MqttBridge.instance = new MqttBridge();
    }
    return MqttBridge.instance;
  }

  public init(): void {
    try {
      this.aedesInstance = new (Aedes as any)();
      this.tcpServer = net.createServer(this.aedesInstance.handle);

      this.tcpServer.listen(ENV.MQTT.port, () => {
        console.log(`[MQTT] Embedded Aedes MQTT Broker listening on TCP port ${ENV.MQTT.port}`);
      });

      this.aedesInstance.on('client', (client: any) => {
        const clientId = client ? client.id : '';
        console.log(`[MQTT] Hardware client connected: ${clientId}`);
        if (clientId && clientId.startsWith('ESP32_')) {
          const uid = clientId.replace('ESP32_', '');
          if (this.onStatusCallback) {
            this.onStatusCallback(uid, 'online');
          }
        }
      });

      this.aedesInstance.on('clientDisconnect', (client: any) => {
        const clientId = client ? client.id : '';
        console.log(`[MQTT] Hardware client disconnected: ${clientId}`);
        if (clientId && clientId.startsWith('ESP32_')) {
          const uid = clientId.replace('ESP32_', '');
          if (this.onStatusCallback) {
            this.onStatusCallback(uid, 'offline');
          }
        }
      });

      this.aedesInstance.on('publish', async (packet: any, client: any) => {
        if (!packet.topic || packet.topic.startsWith('$SYS/')) return;

        const topic = packet.topic;
        const payloadStr = packet.payload.toString();

        try {
          // Parse topic: devices/:device_uid/:action
          const parts = topic.split('/');
          if (parts[0] === 'devices' && parts.length >= 3) {
            const deviceUid = parts[1];
            const subTopic = parts[2];
            const data = JSON.parse(payloadStr);

            if (subTopic === 'telemetry') {
              if (this.onTelemetryCallback) {
                await this.onTelemetryCallback(deviceUid, data);
              }
            } else if (subTopic === 'ack') {
              if (this.onAckCallback) {
                await this.onAckCallback(deviceUid, data);
              }
            } else if (subTopic === 'status') {
              if (this.onStatusCallback) {
                await this.onStatusCallback(deviceUid, data.status || 'offline');
              }
            }
          }
        } catch (err: any) {
          console.warn(`[MQTT] Error processing packet on topic ${topic}:`, err.message);
        }
      });
    } catch (err: any) {
      console.warn('[MQTT] Embedded broker start failed:', err.message);
    }
  }

  public setCallbacks(callbacks: {
    onTelemetry: (deviceUid: string, payload: any) => Promise<void>;
    onAck: (deviceUid: string, ackData: any) => Promise<void>;
    onStatus: (deviceUid: string, status: string) => Promise<void>;
  }) {
    this.onTelemetryCallback = callbacks.onTelemetry;
    this.onAckCallback = callbacks.onAck;
    this.onStatusCallback = callbacks.onStatus;
  }

  public publishCommand(deviceUid: string, command: any): void {
    if (!this.aedesInstance) return;
    const topic = `devices/${deviceUid}/commands`;
    const payload = Buffer.from(JSON.stringify(command));
    this.aedesInstance.publish({
      cmd: 'publish',
      qos: 1,
      topic,
      payload,
      retain: false,
      dup: false
    }, (err: any) => {
      if (err) {
        console.error(`[MQTT] Failed to publish command to ${topic}:`, err);
      } else {
        console.log(`[MQTT] Published command to ${topic}:`, command);
      }
    });
  }
}

export const mqttBridge = MqttBridge.getInstance();
