import mqtt from 'mqtt';
import { VirtualEsp8266SubNode, SubNodePacket } from './virtual_esp8266';

export class VirtualEsp32MainNode {
  public deviceUid: string;
  private client?: mqtt.MqttClient;
  private subNode: VirtualEsp8266SubNode;
  public pumpState: 'OFF' | 'ON' | 'FAULT' = 'OFF';
  public mode: 'MANUAL' | 'AUTOMATIC' | 'SCHEDULED' | 'EMERGENCY_STOP' = 'AUTOMATIC';
  public runtimeSeconds: number = 0;
  private startTimestamp: number = 0;
  private zeroFlowSeconds: number = 0;

  constructor(deviceUid: string = 'WPC-A81F29') {
    this.deviceUid = deviceUid;
    this.subNode = new VirtualEsp8266SubNode(72.5);
  }

  public connect(brokerUrl: string = 'mqtt://localhost:1883') {
    console.log(`[VirtualESP32] Connecting ${this.deviceUid} to MQTT broker: ${brokerUrl}`);
    this.client = mqtt.connect(brokerUrl, {
      clientId: `VIRTUAL_ESP32_${this.deviceUid}`,
      clean: true,
      will: {
        topic: `devices/${this.deviceUid}/status`,
        payload: Buffer.from(JSON.stringify({ status: 'offline' })),
        qos: 1,
        retain: true
      }
    });

    this.client.on('connect', () => {
      console.log(`[VirtualESP32] Connected to MQTT broker! Subscribing to commands...`);
      const cmdTopic = `devices/${this.deviceUid}/commands`;
      this.client?.subscribe(cmdTopic, { qos: 1 });

      // Publish online status
      this.client?.publish(`devices/${this.deviceUid}/status`, JSON.stringify({
        status: 'online',
        firmware: 'v1.4.2',
        hw: 'REV_2.1',
        ip: '192.168.1.145',
        rssi: -58
      }), { qos: 1, retain: true });
    });

    this.client.on('message', (topic: string, payload: Buffer) => {
      try {
        const cmd = JSON.parse(payload.toString());
        this.handleCommand(cmd);
      } catch (err: any) {
        console.warn(`[VirtualESP32] Error parsing command:`, err.message);
      }
    });

    // Start 2-second simulation loop
    setInterval(() => this.tick(), 2000);
  }

  private handleCommand(cmd: any) {
    console.log(`[VirtualESP32] Hardware received command: ${cmd.command_type} (ID: ${cmd.command_id})`);
    const cmdId = cmd.command_id;
    const type = cmd.command_type;

    if (type === 'START_PUMP') {
      if (this.pumpState !== 'FAULT') {
        this.pumpState = 'ON';
        this.startTimestamp = Date.now();
        this.runtimeSeconds = 0;
        this.sendAck(cmdId, 'successful', 'ON', 4.8, 0);
      } else {
        this.sendAck(cmdId, 'failed', 'FAULT', 0.0, 0);
      }
    } else if (type === 'STOP_PUMP') {
      this.pumpState = 'OFF';
      this.runtimeSeconds = 0;
      this.startTimestamp = 0;
      this.sendAck(cmdId, 'successful', 'OFF', 0.0, 0);
    } else if (type === 'SET_MODE') {
      this.mode = cmd.payload?.mode || 'AUTOMATIC';
      this.sendAck(cmdId, 'successful', this.pumpState, this.pumpState === 'ON' ? 4.8 : 0.0, this.runtimeSeconds);
    } else if (type === 'EMERGENCY_STOP') {
      this.pumpState = 'FAULT';
      this.mode = 'EMERGENCY_STOP';
      this.runtimeSeconds = 0;
      this.sendAck(cmdId, 'successful', 'FAULT', 0.0, 0);
    }
  }

  private sendAck(cmdId: string, status: string, confirmedState: string, currentAmps: number, runtimeSec: number) {
    const topic = `devices/${this.deviceUid}/ack`;
    const ackPayload = {
      command_id: cmdId,
      status,
      confirmed_state: confirmedState,
      current_amps: currentAmps,
      runtime_seconds: runtimeSec
    };
    this.client?.publish(topic, JSON.stringify(ackPayload), { qos: 1 });
    console.log(`[VirtualESP32] Published Hardware ACK -> State: ${confirmedState}`);
  }

  private tick() {
    if (!this.client || !this.client.connected) return;

    if (this.pumpState === 'ON' && this.startTimestamp > 0) {
      this.runtimeSeconds = Math.floor((Date.now() - this.startTimestamp) / 1000);
    }

    // Step Sub-node tank physics
    const packet: SubNodePacket = this.subNode.stepPhysics(this.pumpState === 'ON', 2);

    // Edge Automation on Virtual ESP32:
    if (this.pumpState === 'ON' && packet.water_level_pct >= 95.0) {
      console.log(`[VirtualESP32] Local Automation: Tank Full (${packet.water_level_pct}%) -> Auto-stopping Pump`);
      this.pumpState = 'OFF';
      this.runtimeSeconds = 0;
      this.sendAck('LOCAL_AUTO_STOP', 'successful', 'OFF', 0.0, 0);
    } else if (this.mode === 'AUTOMATIC' && this.pumpState === 'OFF' && packet.water_level_pct <= 30.0) {
      console.log(`[VirtualESP32] Local Automation: Low Water (${packet.water_level_pct}%) -> Auto-starting Pump`);
      this.pumpState = 'ON';
      this.startTimestamp = Date.now();
      this.runtimeSeconds = 0;
      this.sendAck('LOCAL_AUTO_START', 'successful', 'ON', 4.8, 0);
    }

    // Publish telemetry to cloud
    const telemetryTopic = `devices/${this.deviceUid}/telemetry`;
    const telemetryData = {
      node_uid: 'TNK-SUB-8266-01',
      water_level_pct: packet.water_level_pct,
      water_liters: packet.water_liters,
      flow_rate_lpm: packet.flow_rate_lpm,
      total_inflow_liters: packet.total_inflow_l,
      tds_ppm: packet.tds_ppm,
      temperature_c: packet.temperature_c,
      sensor_health_mask: packet.sensor_health,
      battery_mv: packet.battery_mv,
      current_amps: this.pumpState === 'ON' ? 4.8 : 0.0,
      pump_state: this.pumpState,
      runtime_sec: this.runtimeSeconds,
      rssi: -58
    };

    this.client.publish(telemetryTopic, JSON.stringify(telemetryData));
  }
}
