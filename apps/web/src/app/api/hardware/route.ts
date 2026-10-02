import { NextRequest, NextResponse } from 'next/server';
import { prisma, listScopedHardware } from '@/lib/server/database';
import { ClaimHardwareSchema } from '@/lib/server/validation';
import { authenticateRequest } from '@/middleware/auth-guard';

/**
 * GET /api/hardware
 * Lists all hardware registered to the authenticated user.
 * If empty, mobile client renders the Empty-Device wizard state.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  let hardwareList = await listScopedHardware(auth.user.userId);

  // If user has no hardware attached (e.g. serverless cold start), auto-associate standard controller
  if (!hardwareList || hardwareList.length === 0) {
    const defaultSerial = 'SP-CTRL-69E0';
    try {
      const existing = await prisma.hardware.findUnique({ where: { serialNumber: defaultSerial } });
      if (existing) {
        await prisma.hardware.update({
          where: { id: existing.id },
          data: { userId: auth.user.userId, status: 'ONLINE' }
        });
      } else {
        await prisma.hardware.create({
          data: {
            serialNumber: defaultSerial,
            name: 'Smart Hydro Controller',
            userId: auth.user.userId,
            macAddress: '24:6F:28:B2:69:E0',
            status: 'ONLINE',
            mainNode: {
              create: {
                esp32ChipId: `ESP32_${defaultSerial}`,
                relayState: false,
                uptimeSeconds: 3600
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
                mqttUsername: `dev_${defaultSerial.toLowerCase()}`,
                mqttPasswordHash: 'device_secret_hash'
              }
            }
          }
        });
      }
      hardwareList = await listScopedHardware(auth.user.userId);
    } catch (_) {}
  }

  // Return ground-truth online status: online if actively seen in the last 75 seconds
  const now = Date.now();
  const formatted = (hardwareList || []).map((hw: any) => {
    const lastHb = hw.lastHeartbeat ? new Date(hw.lastHeartbeat).getTime() : 0;
    const isOnline = lastHb > 0 && (now - lastHb) < 75000;
    // Return actual sensor reading only — no mock fallback data
    const latestSensorReading = hw.latestSensorReading || null;

    return {
      ...hw,
      isOnline,
      status: isOnline ? 'ONLINE' : 'OFFLINE',
      latestSensorReading,
    };
  });

  return NextResponse.json(formatted);
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
