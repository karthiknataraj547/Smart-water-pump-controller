import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@smartpump/database';
import { authenticateRequest } from '@/middleware/auth-guard';
import { verifyHardwareOwnership } from '@/middleware/ownership-guard';
import { publishDeviceCommand } from '@/services/mqtt';

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
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await prisma.deviceCommand.create({
      data: {
        id: commandId,
        hardwareId: hardware.id,
        command: 'REBOOT_DEVICE',
        status: 'DISPATCHED',
        issuedByUserId: auth.user.userId
      }
    });

    // Dispatch MQTT reboot command to hardware
    try {
      await publishDeviceCommand(auth.user.userId, hardware.serialNumber, 'REBOOT_DEVICE', commandId);
    } catch (mqttErr) {
      console.error('[MQTT] Failed to publish REBOOT_DEVICE:', mqttErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Controller reboot command transmitted to hardware via MQTT.',
      commandId
    });
  } catch (error) {
    console.error('Failed to trigger hardware reboot:', error);
    return NextResponse.json(
      { error: 'Failed to dispatch reboot command to hardware.' },
      { status: 500 }
    );
  }
}
