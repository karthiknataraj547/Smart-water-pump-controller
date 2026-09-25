import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@smartpump/database';
import { authenticateRequest } from '@/middleware/auth-guard';
import { verifyHardwareOwnership } from '@/middleware/ownership-guard';
import { EmergencyStopSchema } from '@smartpump/validation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { id: hardwareId } = await params;

  const ownership = await verifyHardwareOwnership(hardwareId, auth.user.userId);
  if (ownership.errorResponse) return ownership.errorResponse;
  const hardware = ownership.hardware!;

  let reason = 'USER_MANUAL_BUTTON';
  try {
    const body = await req.json();
    const parsed = EmergencyStopSchema.safeParse(body);
    if (parsed.success) reason = parsed.data.reason;
  } catch {
    // Body optional for emergency stop
  }

  // 1. Transactionally activate hardware emergency stop lock and log event
  await prisma.$transaction([
    prisma.hardware.update({
      where: { id: hardware.id },
      data: {
        emergencyStopActive: true,
        emergencyStoppedAt: new Date(),
        status: 'EMERGENCY_LOCKED'
      }
    }),
    prisma.pumpState.update({
      where: { hardwareId: hardware.id },
      data: {
        state: 'EMERGENCY_STOPPED'
      }
    }),
    prisma.emergencyStopEvent.create({
      data: {
        hardwareId: hardware.id,
        triggeredBy: reason,
        flowRateAtStop: hardware.pumpState?.currentFlowRateLpm ?? 0
      }
    }),
    prisma.deviceCommand.create({
      data: {
        hardwareId: hardware.id,
        command: 'EMERGENCY_STOP',
        status: 'DISPATCHED',
        issuedByUserId: auth.user.userId
      }
    })
  ]);

  return NextResponse.json({
    status: 'EMERGENCY_STOPPED',
    message: 'Emergency Stop executed. Relay opened and local hardware latch engaged.',
    timestamp: new Date().toISOString()
  });
}
