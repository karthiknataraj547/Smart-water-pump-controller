import { SmartPumpMqttService, DeviceMqttEvent } from '@smartpump/mqtt';
import { prisma } from '@smartpump/database';
import { CommandType } from '@smartpump/shared';

const globalForMqtt = globalThis as unknown as {
  smartPumpMqttService: SmartPumpMqttService | undefined;
  mqttListenersInitialized: boolean | undefined;
};

export const mqttService =
  globalForMqtt.smartPumpMqttService ??
  new SmartPumpMqttService(process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883');

if (process.env.NODE_ENV !== 'production') {
  globalForMqtt.smartPumpMqttService = mqttService;
}

export async function publishDeviceCommand(
  userId: string,
  serialNumber: string,
  command: CommandType | string,
  commandId?: string,
  parameters?: Record<string, unknown>
): Promise<string> {
  const finalCommandId = commandId || `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload = {
    commandId: finalCommandId,
    command,
    issuedByUserId: userId,
    timestamp: Date.now(),
    ...parameters
  };

  const jsonStr = JSON.stringify(payload);
  const client = mqttService.getRawClient();

  // Dual broadcast to both user-scoped and direct device command topics
  client.publish(`users/${userId}/devices/${serialNumber}/command`, jsonStr, { qos: 1 });
  client.publish(`devices/${serialNumber}/command`, jsonStr, { qos: 1 });
  console.log(`[MQTT] Dispatched ${command} (${finalCommandId}) to device ${serialNumber}`);

  return finalCommandId;
}

if (!globalForMqtt.mqttListenersInitialized) {
  globalForMqtt.mqttListenersInitialized = true;

  // Listen for device heartbeat
  mqttService.on('heartbeat', async ({ deviceId, data }: DeviceMqttEvent) => {
    try {
      const serialNumber = deviceId;
      const hw = await prisma.hardware.findUnique({
        where: { serialNumber }
      });
      if (!hw) return;

      const now = new Date();
      await prisma.hardware.update({
        where: { serialNumber },
        data: {
          status: 'ONLINE',
          lastHeartbeat: now,
          wifiRssi: typeof data.wifiRssi === 'number' ? data.wifiRssi : undefined
        }
      });

      if (data.pumpState) {
        const isPumpOn = data.pumpState === 'ON';
        await prisma.pumpState.upsert({
          where: { hardwareId: hw.id },
          create: {
            hardwareId: hw.id,
            state: isPumpOn ? 'ON' : (hw.emergencyStopActive ? 'EMERGENCY_STOPPED' : 'OFF'),
            mode: 'MANUAL'
          },
          update: {
            state: isPumpOn ? 'ON' : (hw.emergencyStopActive ? 'EMERGENCY_STOPPED' : 'OFF')
          }
        });
      }

      if (typeof data.uptimeSeconds === 'number' || typeof data.freeHeapBytes === 'number') {
        await prisma.mainNode.updateMany({
          where: { hardwareId: hw.id },
          data: {
            uptimeSeconds: data.uptimeSeconds || 0,
            freeHeap: data.freeHeapBytes,
            relayState: data.pumpState === 'ON'
          }
        });
      }
    } catch (err) {
      console.error('[MQTT] Error syncing heartbeat to DB:', err);
    }
  });

  // Listen for telemetry
  mqttService.on('telemetry', async ({ deviceId, data }: DeviceMqttEvent) => {
    try {
      const serialNumber = deviceId;
      const hw = await prisma.hardware.findUnique({
        where: { serialNumber }
      });
      if (!hw) return;

      const now = new Date();
      await prisma.hardware.update({
        where: { serialNumber },
        data: {
          status: 'ONLINE',
          lastHeartbeat: now
        }
      });

      if (data.pumpState) {
        await prisma.pumpState.upsert({
          where: { hardwareId: hw.id },
          create: {
            hardwareId: hw.id,
            state: data.pumpState === 'ON' ? 'ON' : 'OFF',
            currentFlowRateLpm: typeof data.flowRateLpm === 'number' ? data.flowRateLpm : 0,
            mode: 'MANUAL'
          },
          update: {
            state: data.pumpState === 'ON' ? 'ON' : 'OFF',
            currentFlowRateLpm: typeof data.flowRateLpm === 'number' ? data.flowRateLpm : 0
          }
        });
      }

      if (typeof data.tankLevelPct === 'number') {
        await prisma.sensorReading.create({
          data: {
            hardwareId: hw.id,
            tankLevelPct: data.tankLevelPct,
            waterVolumeL: typeof data.waterVolumeLiters === 'number' ? data.waterVolumeLiters : 0,
            flowRateLpm: typeof data.flowRateLpm === 'number' ? data.flowRateLpm : 0,
            tdsPpm: typeof data.tdsPpm === 'number' ? data.tdsPpm : 0,
            tdhMeters: 0,
            timestamp: now
          }
        });
      }
    } catch (err) {
      console.error('[MQTT] Error syncing telemetry to DB:', err);
    }
  });

  // Listen for LWT / status
  mqttService.on('status', async ({ deviceId, data }: DeviceMqttEvent) => {
    try {
      const serialNumber = deviceId;
      const statusStr = typeof data === 'string' ? data : (data.status || '');
      if (statusStr === 'OFFLINE') {
        await prisma.hardware.updateMany({
          where: { serialNumber },
          data: { status: 'OFFLINE' }
        });
      } else if (statusStr === 'ONLINE') {
        await prisma.hardware.updateMany({
          where: { serialNumber },
          data: { status: 'ONLINE', lastHeartbeat: new Date() }
        });
      }
    } catch (err) {
      console.error('[MQTT] Error syncing status to DB:', err);
    }
  });

  // Listen for Command ACK
  mqttService.on('ack', async ({ data }: DeviceMqttEvent) => {
    try {
      if (!data || !data.commandId) return;
      const cmd = await prisma.deviceCommand.findUnique({
        where: { id: data.commandId }
      });
      if (cmd) {
        await prisma.deviceCommand.update({
          where: { id: data.commandId },
          data: {
            status: data.status === 'SUCCESS' ? 'ACKNOWLEDGED' : 'FAILED',
            acknowledgedAt: new Date()
          }
        });

        if (data.pumpState) {
          const hw = await prisma.hardware.findUnique({
            where: { id: cmd.hardwareId }
          });
          if (hw) {
            let newState: 'ON' | 'OFF' | 'EMERGENCY_STOPPED' = 'OFF';
            if (data.pumpState === 'ON') newState = 'ON';
            else if (data.pumpState === 'EMERGENCY_STOPPED') newState = 'EMERGENCY_STOPPED';

            await prisma.pumpState.upsert({
              where: { hardwareId: hw.id },
              create: {
                hardwareId: hw.id,
                state: newState,
                mode: 'MANUAL',
                lastCommandId: data.commandId
              },
              update: {
                state: newState,
                lastCommandId: data.commandId
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('[MQTT] Error syncing ACK to DB:', err);
    }
  });
}
