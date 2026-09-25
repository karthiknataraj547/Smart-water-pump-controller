import { NextRequest, NextResponse } from 'next/server';
import { prisma, listScopedHardware } from '@smartpump/database';
import { ClaimHardwareSchema } from '@smartpump/validation';
import { authenticateRequest } from '@/middleware/auth-guard';

/**
 * GET /api/hardware
 * Lists all hardware registered to the authenticated user.
 * If empty, mobile client renders the Empty-Device wizard state.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const hardwareList = await listScopedHardware(auth.user.userId);
  return NextResponse.json(hardwareList);
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

    const { serialNumber, name } = parsed.data;

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

    return NextResponse.json({ message: 'Device successfully claimed', hardware }, { status: 201 });
  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json({ error: 'Internal server error claiming device' }, { status: 500 });
  }
}
