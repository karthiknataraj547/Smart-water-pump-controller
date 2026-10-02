import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/database';
import { authenticateRequest } from '@/middleware/auth-guard';
import { verifyHardwareOwnership } from '@/middleware/ownership-guard';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { id: hardwareId } = await params;

  // Strict ownership verification
  const ownership = await verifyHardwareOwnership(hardwareId, auth.user.userId);
  if (ownership.errorResponse) return ownership.errorResponse;
  const hardware = ownership.hardware!;

  const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Record command in database with DISPATCHED status
  await prisma.deviceCommand.create({
    data: {
      id: commandId,
      hardwareId: hardware.id,
      command: 'REBOOT_DEVICE',
      status: 'DISPATCHED',
      issuedByUserId: auth.user.userId
    }
  });

  // Safely de-energize relay state in DB record
  try {
    await prisma.hardware.update({
      where: { id: hardware.id },
      data: {
        emergencyStopActive: false,
        pumpState: {
          update: {
            state: 'OFF'
          }
        }
      }
    });
  } catch (_) {}

  return NextResponse.json(
    {
      commandId,
      status: 'DISPATCHED',
      message: 'Remote hardware reboot dispatched. ESP32 controller is restarting safely.'
    },
    { status: 202 }
  );
}
