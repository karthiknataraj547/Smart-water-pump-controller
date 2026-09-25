import { prisma } from '@smartpump/database';
import { DeviceTelemetryPayload, CommandType, PumpStateEnum } from '@smartpump/shared';
import { PumpCommandService } from './command';

export class AutomationEngine {
  private static dryRunCounters = new Map<string, number>();

  /**
   * Evaluates automation rules and dry-run safety against incoming sensor telemetry
   */
  public static async evaluate(hardwareId: string, telemetry: DeviceTelemetryPayload): Promise<void> {
    const hardware = await prisma.hardware.findUnique({
      where: { id: hardwareId },
      include: {
        pumpState: true,
        automationRules: {
          where: { isEnabled: true }
        }
      }
    });

    if (!hardware) return;

    // Safety Interlock: If Emergency Stop is active, reject any automated operation
    if (hardware.emergencyStopActive) return;

    // 1. Dry Run Protection Interlock
    // If pump is ON but flow rate is negligible (< 1.0 LPM) for 20 seconds, trigger Emergency Stop
    if (telemetry.pumpState === PumpStateEnum.ON && telemetry.flowRateLpm < 1.0) {
      const count = (this.dryRunCounters.get(hardwareId) || 0) + 1;
      this.dryRunCounters.set(hardwareId, count);

      if (count >= 4) { // 4 samples * 5s = 20 seconds
        this.dryRunCounters.delete(hardwareId);
        await this.triggerDryRunShutdown(hardware.id, hardware.userId, telemetry.flowRateLpm);
        return;
      }
    } else {
      this.dryRunCounters.set(hardwareId, 0);
    }

    // Only proceed with user rules if pump is in AUTO mode
    if (hardware.pumpState?.mode !== 'AUTO') return;

    const now = Date.now();

    for (const rule of hardware.automationRules) {
      // Check cooldown
      if (rule.lastTriggeredAt) {
        const elapsedSec = (now - rule.lastTriggeredAt.getTime()) / 1000;
        if (elapsedSec < rule.cooldownSeconds) continue;
      }

      let isTriggered = false;
      let metricValue = 0;

      if (rule.conditionMetric === 'TANK_LEVEL_PERCENT') {
        metricValue = telemetry.tankLevelPct;
        if (rule.operator === 'LESS_THAN' && metricValue < rule.thresholdValue) {
          isTriggered = true;
        } else if (rule.operator === 'GREATER_THAN' && metricValue > rule.thresholdValue) {
          isTriggered = true;
        }
      } else if (rule.conditionMetric === 'TDS_PPM') {
        metricValue = telemetry.tdsPpm;
        if (rule.operator === 'GREATER_THAN' && metricValue > rule.thresholdValue) {
          isTriggered = true;
        }
      }

      if (isTriggered) {
        // Execute rule action
        await this.executeRuleAction(rule.id, hardware.id, hardware.userId, rule.action, metricValue);
        // Mark rule last triggered
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: { lastTriggeredAt: new Date() }
        });
      }
    }
  }

  private static async executeRuleAction(
    ruleId: string,
    hardwareId: string,
    userId: string,
    action: string,
    metricValue: number
  ): Promise<void> {
    try {
      if (action === 'PUMP_START') {
        await PumpCommandService.executeCommand({
          userId,
          hardwareId,
          command: CommandType.PUMP_START,
          parameters: { ruleId }
        });
      } else if (action === 'PUMP_STOP') {
        await PumpCommandService.executeCommand({
          userId,
          hardwareId,
          command: CommandType.PUMP_STOP,
          parameters: { ruleId }
        });
      }

      // Log execution
      await prisma.automationLog.create({
        data: {
          ruleId,
          metricValue,
          actionTaken: action,
          resultStatus: 'EXECUTED'
        }
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await prisma.automationLog.create({
        data: {
          ruleId,
          metricValue,
          actionTaken: action,
          resultStatus: `FAILED: ${errorMessage}`
        }
      });
    }
  }

  private static async triggerDryRunShutdown(hardwareId: string, userId: string, flowRate: number): Promise<void> {
    await prisma.$transaction([
      prisma.hardware.update({
        where: { id: hardwareId },
        data: {
          emergencyStopActive: true,
          status: 'EMERGENCY_LOCKED',
          emergencyStoppedAt: new Date()
        }
      }),
      prisma.pumpState.update({
        where: { hardwareId },
        data: { state: PumpStateEnum.EMERGENCY_STOPPED }
      }),
      prisma.emergencyStopEvent.create({
        data: {
          hardwareId,
          triggeredBy: 'DRY_RUN_PROTECTION',
          flowRateAtStop: flowRate
        }
      }),
      prisma.notification.create({
        data: {
          userId,
          title: '🚨 Dry Run Emergency Shutdown',
          body: `Pump was running with zero water flow (${flowRate} L/min). Power automatically disconnected to prevent motor burnout.`,
          severity: 'CRITICAL'
        }
      })
    ]);

    // Dispatch physical MQTT emergency cutoff
    try {
      await PumpCommandService.executeCommand({
        userId,
        hardwareId,
        command: CommandType.EMERGENCY_STOP,
        parameters: { reason: 'DRY_RUN_PROTECTION' }
      });
    } catch (e) {
      console.error('Failed to dispatch MQTT dry run cutoff:', e);
    }
  }
}
