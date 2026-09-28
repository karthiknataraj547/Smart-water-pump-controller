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

  // Rate Limiting
  const rateKey = `pump_cmd:${hardwareId}`;
  const { allowed } = checkRateLimit(rateKey, SYSTEM_CONSTANTS.RATE_LIMITS.PUMP_COMMANDS.limit, SYSTEM_CONSTANTS.RATE_LIMITS.PUMP_COMMANDS.windowMs);
  if (!allowed) return rateLimitResponse();

  const ownership = await verifyHardwareOwnership(hardwareId, auth.user.userId);
  if (ownership.errorResponse) return ownership.errorResponse;
  const hardware = ownership.hardware!;

  // Safety interlock: Auto Mode Check
  // In Auto mode, pump is controlled strictly by automation rules.
  // Emergency stop is available via /emergency-stop.
  if (hardware.pumpState?.mode === 'AUTO') {
    return NextResponse.json(
      { error: 'Pump is in AUTOMATIC mode. In Auto mode, the pump is strictly controlled by automation rules. Use Emergency Stop if immediate shutdown is required, or switch to MANUAL mode.' },
      { status: 400 }
    );
  }

  const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  await prisma.deviceCommand.create({
    data: {
      id: commandId,
      hardwareId: hardware.id,
      command: 'PUMP_STOP',
      status: 'DISPATCHED',
      issuedByUserId: auth.user.userId
    }
  });

  return NextResponse.json(
    {
      commandId,
      status: 'DISPATCHED',
      message: 'Pump stop command dispatched.'
    },
    { status: 202 }
  );
}
