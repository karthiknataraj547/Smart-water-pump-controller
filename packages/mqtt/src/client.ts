import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { EventEmitter } from 'events';
import { MqttTopicBuilder, CommandAckPayload } from '@smartpump/shared';
import { CommandDispatcher } from './command-dispatcher';
import { HeartbeatWatchdog } from './heartbeat-watchdog';

export interface DeviceMqttEvent {
  deviceId: string;
  channel: string;
  data: any;
  rawTopic: string;
}

export class SmartPumpMqttService extends EventEmitter {
  private client: MqttClient;
  public dispatcher: CommandDispatcher;
  public watchdog: HeartbeatWatchdog;

  constructor(brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883', options?: IClientOptions) {
    super();
    this.client = mqtt.connect(brokerUrl, {
      clientId: `backend_service_${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
      ...options
    });

    this.dispatcher = new CommandDispatcher(this.client);
    this.watchdog = new HeartbeatWatchdog();

    this.setupListeners();
  }

  private setupListeners(): void {
    this.client.on('connect', () => {
      console.log('[MQTT] Connected to MQTT Broker successfully');
      // Subscribe to all user device incoming streams
      this.client.subscribe('users/+/devices/+/heartbeat', { qos: 1 });
      this.client.subscribe('users/+/devices/+/ack', { qos: 1 });
      this.client.subscribe('users/+/devices/+/telemetry', { qos: 0 });
      this.client.subscribe('users/+/devices/+/state', { qos: 1 });
      this.client.subscribe('users/+/devices/+/status', { qos: 1 });
      this.client.subscribe('devices/+/status', { qos: 1 });
      this.client.subscribe('devices/+/heartbeat', { qos: 1 });
      this.client.subscribe('devices/+/telemetry', { qos: 0 });
      this.client.subscribe('devices/+/ack', { qos: 1 });
    });

    this.client.on('message', (topic, message) => {
      try {
        const parsedTopic = MqttTopicBuilder.parse(topic);
        if (!parsedTopic || !parsedTopic.deviceId) return;

        const { deviceId, channel } = parsedTopic;
        const rawStr = message.toString();
        let data: any;
        try {
          data = JSON.parse(rawStr);
        } catch {
          data = rawStr;
        }

        if (channel === 'heartbeat') {
          this.watchdog.recordHeartbeat(deviceId);
        } else if (channel === 'ack') {
          this.dispatcher.handleAck(data as CommandAckPayload);
        } else if (channel === 'telemetry') {
          this.watchdog.recordHeartbeat(deviceId); // Telemetry counts as liveness
        }

        const event: DeviceMqttEvent = { deviceId, channel: channel || '', data, rawTopic: topic };
        this.emit('device_event', event);
        if (channel) {
          this.emit(channel, event);
        }
      } catch (err) {
        console.error('Error handling MQTT packet:', err);
      }
    });

    this.client.on('error', (err) => {
      console.error('MQTT error:', err);
    });
  }

  public getRawClient(): MqttClient {
    return this.client;
  }
}
