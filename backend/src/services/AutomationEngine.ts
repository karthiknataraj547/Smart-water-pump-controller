import { db } from '../database/db';
import { alertService } from './AlertService';
import { pumpControlService } from './PumpControlService';
import { AutomationRule, PumpStatus, SensorReading } from '../types';

export class AutomationEngine {
  private static instance: AutomationEngine;
  private onTriggerPumpAction?: (deviceId: string, action: 'START' | 'STOP' | 'EMERGENCY_STOP', reason: string) => Promise<void>;
  private lastActionTime: Record<string, number> = {};

  private constructor() {}

  public static getInstance(): AutomationEngine {
    if (!AutomationEngine.instance) {
      AutomationEngine.instance = new AutomationEngine();
    }
    return AutomationEngine.instance;
  }

  public setActionHandler(handler: (deviceId: string, action: 'START' | 'STOP' | 'EMERGENCY_STOP', reason: string) => Promise<void>) {
    this.onTriggerPumpAction = handler;
  }

  public async executePumpAction(deviceId: string, action: 'START' | 'STOP' | 'EMERGENCY_STOP', reason: string): Promise<void> {
    const now = Date.now();
    const lastTime = this.lastActionTime[deviceId] || 0;
    
    // 2-second debounce per device to prevent rapid flutter
    if (now - lastTime < 2000 && action !== 'EMERGENCY_STOP') {
      return;
    }
    this.lastActionTime[deviceId] = now;

    console.log(`[AutomationEngine] ⚡ Executing ${action} on hardware device ${deviceId}. Reason: ${reason}`);

    if (this.onTriggerPumpAction) {
      await this.onTriggerPumpAction(deviceId, action, reason);
    } else {
      const cmdType = action === 'START' ? 'START_PUMP' : action === 'STOP' ? 'STOP_PUMP' : 'EMERGENCY_STOP';
      await pumpControlService.sendPumpCommand({
        deviceId,
        commandType: cmdType,
        payload: { reason },
        requestedBy: 'SYSTEM_AUTOMATION',
        source: 'automation'
      });
    }
  }

  public async evaluateRules(deviceId: string, telemetry: {
    water_level_pct: number;
    flow_rate_lpm: number;
    subnode_online?: boolean;
  }): Promise<void> {
    try {
      const pumpStatus = await db.queryOne<PumpStatus>(
        'SELECT * FROM pump_status WHERE device_id = ? ORDER BY changed_at DESC LIMIT 1',
        [deviceId]
      );

      if (!pumpStatus) return;

      const pumpStateNorm = (pumpStatus.pump_state || 'OFF').toUpperCase();
      const isPumpRunning = pumpStateNorm === 'ON';
      const isPumpOff = !isPumpRunning;
      const currentMode = (pumpStatus.mode || 'AUTOMATIC').toUpperCase();
      const currentWaterLevel = Number(telemetry.water_level_pct);

      // =====================================================================
      // 1. SAFETY CRITICAL RULES (Enforced in ALL modes)
      // =====================================================================

      // Safety Rule 1: High Water Overflow Cutoff (>= 95%)
      if (currentWaterLevel >= 95.0 && isPumpRunning) {
        console.log(`[Automation Safety] Tank Full (${currentWaterLevel}% >= 95%). Triggering Auto-Stop.`);
        await this.executePumpAction(deviceId, 'STOP', `Safety Auto-Stop: Tank level >= 95% (${currentWaterLevel.toFixed(1)}%)`);
        await alertService.createAlert({
          deviceId,
          severity: 'info',
          title: 'Tank Full Auto-Stop',
          message: `Water pump stopped automatically at ${currentWaterLevel.toFixed(1)}% full level.`
        });
        return;
      }

      // Safety Rule 2: Dry-Run Inflow Detection (Zero Flow after 2 min)
      if (isPumpRunning && (pumpStatus.runtime_seconds || 0) > 120 && telemetry.flow_rate_lpm < 0.5) {
        console.warn(`[Automation Safety] DRY RUN DETECTED! Zero flow (${telemetry.flow_rate_lpm} LPM) after 2 min runtime.`);
        await this.executePumpAction(deviceId, 'EMERGENCY_STOP', 'Emergency Stop: Borewell Dry Run (Zero Inflow)');
        await alertService.createAlert({
          deviceId,
          severity: 'critical',
          title: 'EMERGENCY: Dry Run Detected',
          message: 'Water pump tripped into Emergency Lockout due to zero water inflow detection.'
        });
        return;
      }

      // =====================================================================
      // 2. AUTOMATIC MODE CONTROL (Strictly executed when mode === 'AUTOMATIC')
      // =====================================================================
      if (currentMode === 'AUTOMATIC') {
        // Query active custom automation rules configured by the user
        const rules = await db.query<AutomationRule>(
          'SELECT * FROM automation_rules WHERE device_id = ? AND enabled = 1 ORDER BY priority ASC, created_at ASC',
          [deviceId]
        );

        let ruleExecuted = false;

        for (const rule of rules) {
          try {
            const condition = typeof rule.condition_json === 'string' ? JSON.parse(rule.condition_json) : rule.condition_json;
            const action = typeof rule.action_json === 'string' ? JSON.parse(rule.action_json) : rule.action_json;
            const targetAction = (action.pump_action || action.action || '').toUpperCase();

            // A) Low Level Threshold Check (e.g. level_lt: 30) -> START PUMP
            if (condition.level_lt !== undefined) {
              const startThreshold = Number(condition.level_lt);
              if (currentWaterLevel <= startThreshold) {
                if ((targetAction === 'START' || targetAction === 'START_PUMP') && isPumpOff) {
                  console.log(`[Automation] ✓ Rule '${rule.rule_name}' met: Water Level (${currentWaterLevel.toFixed(1)}%) <= ${startThreshold}% -> DISPATCHING REAL START COMMAND`);
                  await this.executePumpAction(deviceId, 'START', `Automation Rule: ${rule.rule_name} (Level ${currentWaterLevel.toFixed(1)}% <= ${startThreshold}%)`);
                  ruleExecuted = true;

                  if (action.generate_alert) {
                    await alertService.createAlert({
                      deviceId,
                      severity: action.alert_severity || 'info',
                      title: action.alert_title || rule.rule_name,
                      message: `Water pump automatically started by rule '${rule.rule_name}' because tank level is ${currentWaterLevel.toFixed(1)}% (Threshold: <= ${startThreshold}%).`
                    });
                  }
                  break;
                }
              }
            }

            // B) High Level Threshold Check (e.g. level_gt: 95) -> STOP PUMP
            if (condition.level_gt !== undefined) {
              const stopThreshold = Number(condition.level_gt);
              if (currentWaterLevel >= stopThreshold) {
                if ((targetAction === 'STOP' || targetAction === 'STOP_PUMP') && isPumpRunning) {
                  console.log(`[Automation] ✓ Rule '${rule.rule_name}' met: Water Level (${currentWaterLevel.toFixed(1)}%) >= ${stopThreshold}% -> DISPATCHING REAL STOP COMMAND`);
                  await this.executePumpAction(deviceId, 'STOP', `Automation Rule: ${rule.rule_name} (Level ${currentWaterLevel.toFixed(1)}% >= ${stopThreshold}%)`);
                  ruleExecuted = true;

                  if (action.generate_alert) {
                    await alertService.createAlert({
                      deviceId,
                      severity: action.alert_severity || 'info',
                      title: action.alert_title || rule.rule_name,
                      message: `Water pump automatically stopped by rule '${rule.rule_name}' because tank level is ${currentWaterLevel.toFixed(1)}% (Cutoff: >= ${stopThreshold}%).`
                    });
                  }
                  break;
                }
              }
            }
          } catch (e: any) {
            console.warn(`[Automation] Error processing rule '${rule.rule_name}':`, e.message);
          }
        }

        // C) Strict Default Fallback (Level <= 30% -> START, Level >= 95% -> STOP)
        if (!ruleExecuted) {
          if (isPumpOff && currentWaterLevel <= 30.0) {
            console.log(`[Automation Default] Tank level (${currentWaterLevel.toFixed(1)}% <= 30%). Dispatching real START command.`);
            await this.executePumpAction(deviceId, 'START', `Default Auto-Start: Low level (${currentWaterLevel.toFixed(1)}% <= 30%)`);
            await alertService.createAlert({
              deviceId,
              severity: 'info',
              title: 'Low Water Auto-Start',
              message: `Water pump started automatically because tank level dropped to ${currentWaterLevel.toFixed(1)}%.`
            });
          } else if (isPumpRunning && currentWaterLevel >= 95.0) {
            console.log(`[Automation Default] Tank full (${currentWaterLevel.toFixed(1)}% >= 95%). Dispatching real STOP command.`);
            await this.executePumpAction(deviceId, 'STOP', `Default Auto-Stop: Tank full (${currentWaterLevel.toFixed(1)}% >= 95%)`);
          }
        }
      }
    } catch (err: any) {
      console.error('[AutomationEngine] Error evaluating rules:', err.message);
    }
  }
}

export const automationEngine = AutomationEngine.getInstance();
