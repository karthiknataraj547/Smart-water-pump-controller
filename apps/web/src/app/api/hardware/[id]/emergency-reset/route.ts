import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@smartpump/database';
import { authenticateRequest } from '@/middleware/auth-guard';
import { verifyHardwareOwnership } from '@/middleware/ownership-guard';
import { EmergencyResetSchema } from '@smartpump/validation';

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

  try {
    const body = await req.json();
    const parsed = EmergencyResetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Explicit acknowledgment required to clear emergency stop lockout.' },
        { status: 400 }
      );
    }

    // Clear emergency state
    await prisma.$transaction([
      prisma.hardware.update({
        where: { id: hardware.id },
        data: {
          emergencyStopActive: false,
          status: 'ONLINE'
        }
      }),
      prisma.pumpState.update({
        where: { hardwareId: hardware.id },
        data: {
          state: 'OFF'
        }
      }),
      prisma.deviceCommand.create({
        data: {
          hardwareId: hardware.id,
          command: 'RESET_EMERGENCY',
          status: 'DISPATCHED',
          issuedByUserId: auth.user.userId
        }
      })
    ]);

    return NextResponse.json({
      message: 'Emergency Stop lockout cleared. Pump controls restored to normal operating state.',
      emergencyStopActive: false
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: 'Failed to reset emergency state.' }, { status: 500 });
  }
}
