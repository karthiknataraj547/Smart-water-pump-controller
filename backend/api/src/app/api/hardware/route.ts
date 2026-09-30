import { NextRequest, NextResponse } from 'next/server';
import { prisma, listScopedHardware } from '@smartpump/database';
import { ClaimHardwareSchema } from '@smartpump/validation';
import { authenticateRequest } from '@/middleware/auth-guard';
import { liveDeviceRegistry } from '@/services/mqtt';

/**
 * GET /api/hardware
 * Lists all hardware registered to the authenticated user.
 * If empty, checks for any auto-discovered devices and binds to the user.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  let hardwareList = await listScopedHardware(auth.user.userId);
  if (hardwareList.length === 0) {
    // If user has no claimed devices, check if any hardware exists in DB and associate it
    const anyHw = await prisma.hardware.findFirst({});
    if (anyHw) {
      await prisma.hardware.update({
        where: { id: anyHw.id },
        data: { userId: auth.user.userId }
      });
      hardwareList = await listScopedHardware(auth.user.userId);
    }
  }

  const now = Date.now();

  const enriched = hardwareList.map((hw: any) => {
    const live = liveDeviceRegistry.get(hw.serialNumber);
    const lastHbTime = live?.lastHeartbeat
      ? live.lastHeartbeat.getTime()
      : (hw.lastHeartbeat ? new Date(hw.lastHeartbeat).getTime() : 0);

    // Online if received heartbeat within 75 seconds and not explicitly marked OFFLINE
    const isOnline = Boolean(
      (live && live.status === 'ONLINE' && (now - lastHbTime < 75000)) ||
      (lastHbTime && (now - lastHbTime < 75000) && hw.status !== 'OFFLINE')
    );

    const dynamicStatus = hw.emergencyStopActive
      ? 'EMERGENCY_LOCKED'
      : (isOnline ? 'ONLINE' : 'OFFLINE');

    const latestSensorReading = hw.sensorReadings && hw.sensorReadings.length > 0
      ? hw.sensorReadings[0]
      : null;

    return {
      ...hw,
      status: dynamicStatus,
      isOnline,
      latestSensorReading
    };
  });

  return NextResponse.json(enriched);
}

/**
 * POST /api/hardware/claim
 * Finalizes BLE provisioning by binding the hardware to the user's account.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = ClaimHardwareSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.format() }, { status: 400 });
    }

    const {
      serialNumber,
      name,
      tankType = 'Overhead Plastic (Sintex)',
      tankCapacityLiters = 1000,
      tankDepthCm = 150,
      sensorOffsetCm = 15,
      motorHp = 1.0
    } = parsed.data;

    // Check if hardware exists
    let hardware = await prisma.hardware.findUnique({
      where: { serialNumber }
    });

    if (!hardware) {
      // First-time registration / provisioning
      hardware = await prisma.hardware.create({
        data: {
          serialNumber,
          name,
          userId: auth.user.userId,
          macAddress: `24:6F:28:${Math.random().toString(16).substring(2, 4)}:${Math.random().toString(16).substring(2, 4)}:${Math.random().toString(16).substring(2, 4)}`.toUpperCase(),
          status: 'ONLINE',
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
    } else {
      // Re-claim existing device
      hardware = await prisma.hardware.update({
        where: { id: hardware.id },
        data: {
          userId: auth.user.userId,
          name,
          status: 'ONLINE'
        },
        include: {
          pumpState: true,
          mainNode: true
        }
      });
    }

    return NextResponse.json({
      message: 'Device successfully claimed and isolated to user account',
      hardware,
      tankConfig: {
        tankType,
        tankCapacityLiters,
        tankDepthCm,
        sensorOffsetCm,
        motorHp,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json({ error: 'Internal server error claiming device' }, { status: 500 });
  }
}
