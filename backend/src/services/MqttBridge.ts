import net from 'net';
import Aedes from 'aedes';
import mqtt, { MqttClient } from 'mqtt';
import { ENV } from '../config/env';

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
      let deviceUid = '';
      let subTopic = '';

      const parts = topic.split('/');
      if (parts[0] === 'devices' && parts.length >= 3) {
        deviceUid = parts[1];
        subTopic = parts[2];
      } else if (parts[0] === 'aquacontrol' && parts[1] === 'v1' && parts[2] === 'devices' && parts.length >= 5) {
        deviceUid = parts[3];
        subTopic = parts[4];
      }

      if (!deviceUid || !subTopic) return;
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

  public publishCommand(deviceUid: string, command: any): void {
    const topic1 = `devices/${deviceUid}/commands`;
    const topic2 = `aquacontrol/v1/devices/${deviceUid}/commands`;
    const payloadBuffer = Buffer.from(JSON.stringify(command));

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
    }

    // 2. Publish to Cloud Broker
    if (this.cloudClient && this.cloudClient.connected) {
      this.cloudClient.publish(topic1, JSON.stringify(command), { qos: 0 });
      this.cloudClient.publish(topic2, JSON.stringify(command), { qos: 0 });
      console.log(`[MQTT] Cloud published command to ${topic1} & ${topic2}:`, command);
    }
  }
}

export const mqttBridge = MqttBridge.getInstance();
