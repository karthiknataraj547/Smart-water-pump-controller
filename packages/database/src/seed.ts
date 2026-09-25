import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@smartpump/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial IoT database...');

  // 1. Create or upsert test user
  const email = 'test@smartpump.io';
  const passwordHash = await hashPassword('Password123!');

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      fullName: 'Dev Tester',
      phoneNumber: '+15550192834',
      passwordHash,
      role: 'USER',
      notificationPreferences: {
        create: {
          pumpAlerts: true,
          tankLevelAlerts: true,
          deviceOfflineAlerts: true,
          automationAlerts: true
        }
      }
    }
  });

  console.log(`User created: ${user.email} (${user.id})`);

  // 2. Create or upsert hardware node
  const serialNumber = 'SP-3918-B';
  const hardware = await prisma.hardware.upsert({
    where: { serialNumber },
    update: {
      userId: user.id
    },
    create: {
      userId: user.id,
      serialNumber,
      name: 'Main Rooftop Pump',
      status: 'ONLINE',
      firmwareVersion: '1.2.4',
      wifiSsid: 'Home_WiFi_5G',
      wifiRssi: -54,
      macAddress: '24:6F:28:B2:44:90',
      emergencyStopActive: false,
      mainNode: {
        create: {
          esp32ChipId: 'ESP32_3918B',
          relayState: false,
          freeHeap: 142000,
          uptimeSeconds: 3600
        }
      },
      subNodes: {
        create: [
          {
            nodeIdentifier: 'SUB_TANK_OVERHEAD',
            macAddress: '5C:CF:7F:1A:88:22',
            batteryPercent: 87.0,
            signalRssi: -62,
            isOnline: true,
            lastSeen: new Date()
          }
        ]
      },
      pumpState: {
        create: {
          mode: 'MANUAL',
          state: 'OFF',
          currentFlowRateLpm: 0.0,
          totalVolumePumpedL: 1420.0,
          headPressureMeters: 18.6
        }
      },
      credentials: {
        create: {
          mqttUsername: 'dev_sp3918b',
          mqttPasswordHash: 'device_secret_token_123',
          isActive: true
        }
      }
    }
  });

  console.log(`Hardware created: ${hardware.name} (${hardware.serialNumber})`);

  // 3. Create sample automation rules
  const ruleCount = await prisma.automationRule.count({
    where: { hardwareId: hardware.id }
  });

  if (ruleCount === 0) {
    await prisma.automationRule.createMany({
      data: [
        {
          userId: user.id,
          hardwareId: hardware.id,
          name: 'Auto Refill on Low Water',
          conditionMetric: 'TANK_LEVEL_PERCENT',
          operator: 'LESS_THAN',
          thresholdValue: 30.0,
          action: 'PUMP_START',
          cooldownSeconds: 300
        },
        {
          userId: user.id,
          hardwareId: hardware.id,
          name: 'Overflow Protection',
          conditionMetric: 'TANK_LEVEL_PERCENT',
          operator: 'GREATER_THAN',
          thresholdValue: 90.0,
          action: 'PUMP_STOP',
          cooldownSeconds: 60
        }
      ]
    });
    console.log('Sample automation rules created.');
  }

  // 4. Create sample telemetry readings
  await prisma.sensorReading.create({
    data: {
      hardwareId: hardware.id,
      tankLevelPct: 72.0,
      waterVolumeL: 720.0,
      flowRateLpm: 0.0,
      tdsPpm: 185.0,
      tdhMeters: 18.6
    }
  });

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
