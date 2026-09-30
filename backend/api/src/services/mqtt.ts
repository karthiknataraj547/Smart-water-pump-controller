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

// Always persist singleton to globalThis
globalForMqtt.smartPumpMqttService = mqttService;

// In-memory live device registry for instantaneous sub-millisecond status lookups
export const liveDeviceRegistry = new Map<string, {
  serialNumber: string;
  status: 'ONLINE' | 'OFFLINE';
  lastHeartbeat: Date;
  wifiRssi?: number;
  pumpState?: string;
}>();

export function isSmartPumpDevice(deviceId: string): boolean {
  if (!deviceId) return false;
  return deviceId.startsWith('SP-') ||
         deviceId.startsWith('SP_') ||
         deviceId.toLowerCase().includes('ctrl') ||
         deviceId.toLowerCase().includes('smartpump') ||
         deviceId.toLowerCase().includes('pump');
}

/**
 * Finds existing hardware or auto-registers an incoming device bound to the registered user.
 * Guarantees device heartbeats are never dropped even if mock data was cleared or BLE claiming was skipped.
 */
async function findOrCreateHardware(serialNumber: string, userIdFromTopic?: string) {
  if (!isSmartPumpDevice(serialNumber)) return null;
  try {
    let hw = await prisma.hardware.findUnique({
      where: { serialNumber }
    });
    if (hw) return hw;

    // Check if any hardware exists in the database
    const allHw = await prisma.hardware.findMany({});
    if (allHw.length > 0) {
      // If there's an existing hardware with default or similar serial, adapt it
      const match = allHw.find((h: any) => h.serialNumber === serialNumber || h.serialNumber.startsWith('SP-CTRL'));
      if (match) {
        if (match.serialNumber !== serialNumber) {
          await prisma.hardware.update({
            where: { id: match.id },
            data: { serialNumber }
          });
        }
        return match;
      }
    }

    // Determine target user
    let targetUserId = userIdFromTopic && userIdFromTopic !== 'unclaimed' ? userIdFromTopic : undefined;
    if (!targetUserId) {
      const firstUser = await prisma.user.findFirst({
        orderBy: { createdAt: 'asc' }
      });
      if (firstUser) {
        targetUserId = firstUser.id;
      }
    }

    if (!targetUserId) {
      console.warn(`[MQTT] Cannot auto-register device ${serialNumber}: No registered user found in DB`);
      return null;
    }

    const cleanSuffix = serialNumber.replace(/[^A-Fa-f0-9]/g, '').slice(-4) || 'B244';
    const macPart = cleanSuffix.match(/../g)?.join(':') || 'B2:44';

    hw = await prisma.hardware.create({
      data: {
        serialNumber,
        name: 'Smart Pump Controller',
        userId: targetUserId,
        status: 'ONLINE',
        lastHeartbeat: new Date(),
        macAddress: `24:6F:28:${macPart}`.toUpperCase(),
        mainNode: {
          create: {
            esp32ChipId: `ESP32_${serialNumber}`,
            relayState: false
          }
        },
        pumpState: {
          create: {
            mode: 'MANUAL',
            state: 'OFF'
          }
        },
        credentials: {
          create: {
            mqttUsername: `dev_${serialNumber.toLowerCase()}`,
            mqttPasswordHash: 'device_secret_hash'
          }
        }
      },
      include: {
        pumpState: true,
        mainNode: true
      }
    });

    console.log(`[MQTT] Auto-registered hardware "${serialNumber}" to user ${targetUserId}`);
    return hw;
  } catch (err) {
    console.error(`[MQTT] Error finding/creating hardware ${serialNumber}:`, err);
    return null;
  }
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
    if (!isSmartPumpDevice(deviceId)) return;
    try {
      const serialNumber = deviceId;
      const now = new Date();

      // Immediately record in memory
      liveDeviceRegistry.set(serialNumber, {
        serialNumber,
        status: 'ONLINE',
        lastHeartbeat: now,
        wifiRssi: typeof data.wifiRssi === 'number' ? data.wifiRssi : undefined,
        pumpState: data.pumpState
      });

      const hw = await findOrCreateHardware(serialNumber);
      if (!hw) return;

      await prisma.hardware.update({
        where: { id: hw.id },
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
    if (!isSmartPumpDevice(deviceId)) return;
    try {
      const serialNumber = deviceId;
      const now = new Date();

      liveDeviceRegistry.set(serialNumber, {
        serialNumber,
        status: 'ONLINE',
        lastHeartbeat: now,
        pumpState: data.pumpState
      });

      const hw = await findOrCreateHardware(serialNumber);
      if (!hw) return;

      await prisma.hardware.update({
        where: { id: hw.id },
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
    if (!isSmartPumpDevice(deviceId)) return;
    try {
      const serialNumber = deviceId;
      const statusStr = typeof data === 'string' ? data : (data.status || '');
      if (statusStr === 'OFFLINE') {
        const live = liveDeviceRegistry.get(serialNumber);
        if (live) live.status = 'OFFLINE';
        await prisma.hardware.updateMany({
          where: { serialNumber },
          data: { status: 'OFFLINE' }
        });
      } else if (statusStr === 'ONLINE') {
        const now = new Date();
        liveDeviceRegistry.set(serialNumber, {
          serialNumber,
          status: 'ONLINE',
          lastHeartbeat: now
        });
        const hw = await findOrCreateHardware(serialNumber);
        if (hw) {
          await prisma.hardware.update({
            where: { id: hw.id },
            data: { status: 'ONLINE', lastHeartbeat: now }
          });
        }
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
