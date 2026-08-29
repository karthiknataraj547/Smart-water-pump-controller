import net from 'net';
import Aedes from 'aedes';
import mqtt, { MqttClient } from 'mqtt';
import { ENV } from '../config/env';
import { db } from '../database/db';

export class MqttBridge {
  private static instance: MqttBridge;
  private aedesInstance?: any;
  private tcpServer?: net.Server;
  private cloudClient?: MqttClient;
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
    // 1. Initialize Embedded Aedes Broker (Local TCP Port 1883)
    try {
      this.aedesInstance = new (Aedes as any)();
      this.tcpServer = net.createServer(this.aedesInstance.handle);

      this.tcpServer.listen(ENV.MQTT.port, () => {
        console.log(`[MQTT] Embedded Aedes MQTT Broker listening on TCP port ${ENV.MQTT.port}`);
      });

      this.aedesInstance.on('client', (client: any) => {
        const clientId = client ? client.id : '';
        console.log(`[MQTT] Hardware client connected to local broker: ${clientId}`);
        if (clientId && clientId.startsWith('ESP32_')) {
          const parts = clientId.split('_');
          const uid = parts[1] || 'WPC-A81F29';
          if (this.onStatusCallback) {
            this.onStatusCallback(uid, 'online');
          }
        }
      });

      this.aedesInstance.on('clientDisconnect', (client: any) => {
        const clientId = client ? client.id : '';
        console.log(`[MQTT] Hardware client disconnected from local broker: ${clientId}`);
        if (clientId && clientId.startsWith('ESP32_')) {
          const parts = clientId.split('_');
          const uid = parts[1] || 'WPC-A81F29';
          if (this.onStatusCallback) {
            this.onStatusCallback(uid, 'offline');
          }
        }
      });

      this.aedesInstance.on('publish', async (packet: any) => {
        if (!packet.topic || packet.topic.startsWith('$SYS/')) return;
        await this.handleIncomingTopicMessage(packet.topic, packet.payload.toString());
      });
    } catch (err: any) {
      console.warn('[MQTT] Embedded broker start failed:', err.message);
    }

    // 2. Initialize Cloud MQTT Bridge Client (broker.emqx.io:1883)
    try {
      const cloudBrokerUrl = process.env.CLOUD_MQTT_URL || 'mqtt://broker.emqx.io:1883';
      console.log(`[MQTT] Connecting Cloud Bridge Client to ${cloudBrokerUrl}...`);
      
      this.cloudClient = mqtt.connect(cloudBrokerUrl, {
        clientId: `AquaControl_Backend_Gateway_${Math.random().toString(16).substring(2, 8)}`,
        reconnectPeriod: 5000,
        connectTimeout: 10000
      });

      this.cloudClient.on('connect', () => {
        console.log(`[MQTT] ✓ Cloud MQTT Bridge connected to ${cloudBrokerUrl}! Subscribing to device topics...`);
        this.cloudClient?.subscribe('aquacontrol/#');
        this.cloudClient?.subscribe('devices/WPC-A81F29/#');
        this.cloudClient?.subscribe('aquacontrol/WPC-A81F29/#');
        this.cloudClient?.subscribe('aquacontrol/+/telemetry');
        this.cloudClient?.subscribe('aquacontrol/+/ack');
        this.cloudClient?.subscribe('aquacontrol/+/status');
        this.cloudClient?.subscribe('devices/+/telemetry');
        this.cloudClient?.subscribe('devices/+/ack');
        this.cloudClient?.subscribe('devices/+/status');
        this.cloudClient?.subscribe('aquacontrol/v1/devices/+/telemetry');
        this.cloudClient?.subscribe('aquacontrol/v1/devices/+/ack');
        this.cloudClient?.subscribe('aquacontrol/v1/devices/+/status');
      });

      this.cloudClient.on('message', async (topic, payload) => {
        await this.handleIncomingTopicMessage(topic, payload.toString());
      });

      this.cloudClient.on('error', (err) => {
        console.warn('[MQTT] Cloud Bridge Client warning:', err.message);
      });
    } catch (err: any) {
      console.warn('[MQTT] Cloud MQTT Bridge initialization warning:', err.message);
    }
  }

  private async handleIncomingTopicMessage(topic: string, payloadStr: string): Promise<void> {
    try {
      const data = JSON.parse(payloadStr);

      // Multi-Device Realtime User Mesh Synchronization
      if (topic.startsWith('aquacontrol/system/users')) {
        if (topic === 'aquacontrol/system/users/request') {
          try {
            const users = await db.query<any>('SELECT id, name, email, phone, password_hash, role, status FROM users');
            this.publishCloudMessage('aquacontrol/system/users/sync', { type: 'ALL_USERS', users });
          } catch (e) {}
        } else if (topic === 'aquacontrol/system/users/sync') {
          if (data.user) {
            const u = data.user;
            const emailLower = (u.email || '').toLowerCase().trim();
            if (emailLower) {
              const existing = await db.queryOne<any>('SELECT id FROM users WHERE LOWER(email) = ?', [emailLower]);
              if (!existing) {
                await db.execute(
                  'INSERT INTO users (id, name, email, phone, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))',
                  [u.id || `usr_${Date.now()}`, u.name || 'User', emailLower, u.phone || '+91-9876543210', u.password_hash || u.password, u.role || 'operator', 'active']
                );
              }
            }
          }
        }
        return;
      }

      let deviceUid = data.device_uid || data.deviceUid || '';
      let subTopic = '';

      const parts = topic.split('/');
      if (parts[0] === 'devices' && parts.length >= 3) {
        if (!deviceUid) deviceUid = parts[1];
        subTopic = parts[2];
      } else if (parts[0] === 'aquacontrol') {
        if (parts.length === 3) {
          if (!deviceUid) deviceUid = parts[1];
          subTopic = parts[2];
        } else if (parts[1] === 'v1' && parts[2] === 'devices' && parts.length >= 5) {
          if (!deviceUid) deviceUid = parts[3];
          subTopic = parts[4];
        } else if (parts.length >= 2) {
          subTopic = parts[parts.length - 1];
        }
      }

      // Fallback topic inference
      if (!subTopic) {
        if (data.water_level_pct !== undefined || data.water_level_percentage !== undefined) {
          subTopic = 'telemetry';
        } else if (data.confirmed_state !== undefined || data.pump_state !== undefined) {
          subTopic = 'ack';
        } else if (data.status !== undefined) {
          subTopic = 'status';
        }
      }

      if (!deviceUid) deviceUid = 'WPC-A81F29';
      if (!subTopic) return;

      console.log(`[MQTT Bridge Inbound] Device: ${deviceUid} | Topic: '${topic}' | Sub: ${subTopic}`);

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
    } catch (err: any) {
      // Ignored non-JSON or invalid payload
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

  public publishCloudMessage(topic: string, message: any, retain: boolean = false): void {
    const payloadStr = typeof message === 'string' ? message : JSON.stringify(message);
    if (this.cloudClient && this.cloudClient.connected) {
      this.cloudClient.publish(topic, payloadStr, { qos: 1, retain });
    }
    if (this.aedesInstance) {
      this.aedesInstance.publish({
        cmd: 'publish',
        qos: 1,
        topic,
        payload: Buffer.from(payloadStr),
        retain,
        dup: false
      }, () => {});
    }
  }

  public publishCommand(deviceUid: string, command: any): void {
    const topic1 = `devices/${deviceUid}/commands`;
    const topic2 = `aquacontrol/${deviceUid}/commands`;
    const topic3 = `aquacontrol/v1/devices/${deviceUid}/commands`;
    const payloadStr = JSON.stringify(command);
    const payloadBuffer = Buffer.from(payloadStr);

    // 1. Publish to local Aedes Broker
    if (this.aedesInstance) {
      this.aedesInstance.publish({
        cmd: 'publish',
        qos: 1,
        topic: topic1,
        payload: payloadBuffer,
        retain: false,
        dup: false
      }, () => {});
      this.aedesInstance.publish({
        cmd: 'publish',
        qos: 1,
        topic: topic2,
        payload: payloadBuffer,
        retain: false,
        dup: false
      }, () => {});
    }

    // 2. Publish to Cloud Broker
    if (this.cloudClient && this.cloudClient.connected) {
      this.cloudClient.publish(topic1, payloadStr, { qos: 0 });
      this.cloudClient.publish(topic2, payloadStr, { qos: 0 });
      this.cloudClient.publish(topic3, payloadStr, { qos: 0 });
      console.log(`[MQTT] Cloud published command to ${topic1}, ${topic2}, ${topic3}:`, command);
    }
  }

  public syncDeviceRules(deviceUid: string, rules: any[]): void {
    const command = {
      command: 'SYNC_RULES',
      cmd_id: `sync_${Date.now()}`,
      rules: rules.map(r => ({
        id: r.id,
        rule_name: r.rule_name,
        enabled: Boolean(r.enabled),
        priority: r.priority || 1,
        condition_json: typeof r.condition_json === 'string' ? JSON.parse(r.condition_json) : (r.condition_json || {}),
        action_json: typeof r.action_json === 'string' ? JSON.parse(r.action_json) : (r.action_json || {})
      }))
    };
    this.publishCommand(deviceUid, command);
    console.log(`[MQTT] Pushed ${rules.length} autonomous rules to hardware ${deviceUid} over MQTT.`);
  }
}

export const mqttBridge = MqttBridge.getInstance();
