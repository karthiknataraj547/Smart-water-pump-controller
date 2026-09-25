import { SmartPumpMqttService } from '@smartpump/mqtt';

const globalForMqtt = globalThis as unknown as {
  smartPumpMqttService: SmartPumpMqttService | undefined;
};

export const mqttService =
  globalForMqtt.smartPumpMqttService ??
  new SmartPumpMqttService(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883');

if (process.env.NODE_ENV !== 'production') {
  globalForMqtt.smartPumpMqttService = mqttService;
}
