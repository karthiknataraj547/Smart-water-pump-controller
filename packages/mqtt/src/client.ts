import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { MqttTopicBuilder, CommandAckPayload } from '@smartpump/shared';
import { CommandDispatcher } from './command-dispatcher';
import { HeartbeatWatchdog } from './heartbeat-watchdog';

export class SmartPumpMqttService {
  private client: MqttClient;
  public dispatcher: CommandDispatcher;
  public watchdog: HeartbeatWatchdog;

  constructor(brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883', options?: IClientOptions) {
    this.client = mqtt.connect(brokerUrl, {
      clientId: `backend_service_${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 2000,
      ...options
    });

    this.dispatcher = new CommandDispatcher(this.client);
    this.watchdog = new HeartbeatWatchdog();

    this.setupListeners();
  }

  private setupListeners(): void {
    this.client.on('connect', () => {
      console.log('Connected to MQTT Broker');
      // Subscribe to all user device incoming streams
      this.client.subscribe('users/+/devices/+/heartbeat', { qos: 1 });
      this.client.subscribe('users/+/devices/+/ack', { qos: 1 });
      this.client.subscribe('users/+/devices/+/telemetry', { qos: 0 });
      this.client.subscribe('users/+/devices/+/state', { qos: 1 });
    });

    this.client.on('message', (topic, message) => {
      try {
        const parsedTopic = MqttTopicBuilder.parse(topic);
        if (!parsedTopic || !parsedTopic.deviceId) return;

        const { deviceId, channel } = parsedTopic;
        const data = JSON.parse(message.toString());

        if (channel === 'heartbeat') {
          this.watchdog.recordHeartbeat(deviceId);
        } else if (channel === 'ack') {
          this.dispatcher.handleAck(data as CommandAckPayload);
        } else if (channel === 'telemetry') {
          this.watchdog.recordHeartbeat(deviceId); // Telemetry counts as liveness
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
