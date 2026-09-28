import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@smartpump/database';
import { authenticateRequest } from '@/middleware/auth-guard';
import { verifyHardwareOwnership } from '@/middleware/ownership-guard';
import { checkRateLimit, rateLimitResponse } from '@/middleware/rate-limiter';
import { SYSTEM_CONSTANTS } from '@smartpump/shared';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { id: hardwareId } = await params;

  // Rate Limiting per hardware (10 requests/min)
  const rateKey = `pump_cmd:${hardwareId}`;
  const { allowed } = checkRateLimit(rateKey, SYSTEM_CONSTANTS.RATE_LIMITS.PUMP_COMMANDS.limit, SYSTEM_CONSTANTS.RATE_LIMITS.PUMP_COMMANDS.windowMs);
  if (!allowed) return rateLimitResponse();

  // Strict ownership verification
  const ownership = await verifyHardwareOwnership(hardwareId, auth.user.userId);
  if (ownership.errorResponse) return ownership.errorResponse;
  const hardware = ownership.hardware!;

  // Safety interlock 1: Emergency Stop Check
  if (hardware.emergencyStopActive) {
    return NextResponse.json(
      { error: 'Cannot start pump: Emergency Stop latch is currently active. Clear emergency lock first.' },
      { status: 409 }
    );
  }

  // Safety interlock 2: Auto Mode Check
  if (hardware.pumpState?.mode === 'AUTO') {
    return NextResponse.json(
      { error: 'Pump is in AUTOMATIC mode. Switch to MANUAL mode to operate manual controls.' },
      { status: 400 }
    );
  }

  const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Record command in database with PENDING status
  await prisma.deviceCommand.create({
    data: {
      id: commandId,
      hardwareId: hardware.id,
      command: 'PUMP_START',
      status: 'DISPATCHED',
      issuedByUserId: auth.user.userId
    }
  });

  // Note: Backend MQTT service publishes users/{userId}/devices/{deviceId}/command
  // Return 202 Accepted. The mobile app displays "Starting..." until ACK arrives.
  return NextResponse.json(
    {
      commandId,
      status: 'DISPATCHED',
      message: 'Pump start command queued and dispatched to device.'
    },
    { status: 202 }
  );
}
