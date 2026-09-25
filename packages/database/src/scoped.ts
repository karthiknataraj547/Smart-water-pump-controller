import { prisma } from './client';

export class HardwareOwnershipError extends Error {
  constructor(message = 'Hardware access denied or device not found') {
    super(message);
    this.name = 'HardwareOwnershipError';
  }
}

/**
 * Strict Scoped Hardware Fetch
 * Ensures that a hardware record is only accessible if it belongs to the authenticated user.
 */
export async function getScopedHardware(hardwareId: string, authenticatedUserId: string) {
  const hardware = await prisma.hardware.findFirst({
    where: {
      id: hardwareId,
      userId: authenticatedUserId, // Strict ownership check: Prevents horizontal privilege escalation
    },
    include: {
      mainNode: true,
      subNodes: true,
      pumpState: true,
      credentials: {
        select: {
          id: true,
          mqttUsername: true,
          isActive: true
        }
      }
    }
  });

  if (!hardware) {
    throw new HardwareOwnershipError();
  }

  return hardware;
}

/**
 * Strict Scoped Hardware List
 */
export async function listScopedHardware(authenticatedUserId: string) {
  return prisma.hardware.findMany({
    where: {
      userId: authenticatedUserId,
    },
    include: {
      pumpState: true,
      mainNode: {
        select: {
          relayState: true,
          uptimeSeconds: true
        }
      },
      subNodes: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });
}

/**
 * Strict Scoped Automation Rules
 */
export async function listScopedRules(hardwareId: string, authenticatedUserId: string) {
  // First verify user owns the hardware
  await getScopedHardware(hardwareId, authenticatedUserId);

  return prisma.automationRule.findMany({
    where: {
      hardwareId,
      userId: authenticatedUserId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}
