import { prisma, getScopedHardware } from '@smartpump/database';
import { CommandType, CommandAckPayload, PumpStateEnum } from '@smartpump/shared';
import { mqttService } from './mqtt';

export interface ExecuteCommandOptions {
  userId: string;
  hardwareId: string;
  command: CommandType;
  timeoutMs?: number;
  parameters?: Record<string, unknown>;
}

export class PumpCommandService {
  /**
   * Dispatches command to hardware and awaits physical relay ACK
   */
  static async executeCommand(options: ExecuteCommandOptions): Promise<{
    commandId: string;
    ack: CommandAckPayload;
  }> {
    const { userId, hardwareId, command, timeoutMs = 5000, parameters } = options;

    // 1. Ownership & Safety Interlock Verification
    const hardware = await getScopedHardware(hardwareId, userId);

    if (hardware.emergencyStopActive && command !== CommandType.RESET_EMERGENCY) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Hardware lockout is engaged. Clear emergency state before issuing commands.');
    }

    // 2. Dispatch via MQTT and await hardware ACK
    const ack = await mqttService.dispatcher.dispatchCommand(
      userId,
      hardware.serialNumber,
      command,
      timeoutMs,
      parameters
    );

    // 3. Update database upon verified physical ACK
    await prisma.$transaction(async (tx) => {
      // Update command record
      await tx.deviceCommand.update({
        where: { id: ack.commandId },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedAt: new Date()
        }
      });

      // Update pump state
      let newState: PumpStateEnum = PumpStateEnum.OFF;
      if (ack.pumpState === 'ON') newState = PumpStateEnum.ON;
      else if (ack.pumpState === 'EMERGENCY_STOPPED') newState = PumpStateEnum.EMERGENCY_STOPPED;

      const previousState = hardware.pumpState?.state ?? PumpStateEnum.OFF;

      await tx.pumpState.update({
        where: { hardwareId: hardware.id },
        data: {
          state: newState,
          currentRunStartedAt: newState === PumpStateEnum.ON ? new Date() : null,
          lastCommandId: ack.commandId
        }
      });

      // Record event log
      await tx.pumpEvent.create({
        data: {
          hardwareId: hardware.id,
          triggerSource: `USER_${userId}`,
          previousState,
          newState,
          flowRateAvgLpm: hardware.pumpState?.currentFlowRateLpm ?? 0
        }
      });
    });

    return { commandId: ack.commandId, ack };
  }
}
