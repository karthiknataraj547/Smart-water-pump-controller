import { NextResponse } from 'next/server';
import { getScopedHardware, HardwareOwnershipError } from '@smartpump/database';

/**
 * Ownership Guard
 * Verifies hardware exists and belongs to the authenticated user.
 * Returns 404/403 if user does not own the hardware, preventing device ID spoofing.
 */
export async function verifyHardwareOwnership(hardwareId: string, userId: string) {
  try {
    const hardware = await getScopedHardware(hardwareId, userId);
    return { hardware };
  } catch (error) {
    if (error instanceof HardwareOwnershipError) {
      return {
        errorResponse: NextResponse.json(
          { error: 'Device not found or access denied.' },
          { status: 404 }
        )
      };
    }
    return {
      errorResponse: NextResponse.json(
        { error: 'Internal server error validating device ownership.' },
        { status: 500 }
      )
    };
  }
}
