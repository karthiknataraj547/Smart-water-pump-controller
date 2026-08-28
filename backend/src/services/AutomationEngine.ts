import { db } from '../database/db';
import { alertService } from './AlertService';
import { pumpControlService } from './PumpControlService';
import { AutomationRule, PumpStatus, SensorReading } from '../types';

export class AutomationEngine {
  private static instance: AutomationEngine;
  private onTriggerPumpAction?: (deviceId: string, action: 'START' | 'STOP' | 'EMERGENCY_STOP', reason: string) => Promise<void>;
  private lastActionTime: Record<string, number> = {};
  private lastSubnodeAlertTime: Record<string, number> = {};
  private lastUltrasonicAlertTime: Record<string, number> = {};

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
    water_level_fault?: boolean;
    sensor_status?: string;
  }): Promise<void> {
    try {
      const device = await db.queryOne<{ id: string; device_uid: string }>(
        'SELECT id, device_uid FROM devices WHERE id = ? OR device_uid = ?',
        [deviceId, deviceId]
      );
      const targetId = device ? device.id : deviceId;
      const targetUid = device ? device.device_uid : deviceId;

      const pumpStatus = await db.queryOne<PumpStatus>(
        'SELECT * FROM pump_status WHERE device_id = ? OR device_id = ? ORDER BY changed_at DESC LIMIT 1',
        [targetId, targetUid]
      );

      if (!pumpStatus) return;

      const pumpStateNorm = (pumpStatus.pump_state || 'OFF').toUpperCase();
      const isPumpRunning = pumpStateNorm === 'ON';
      const isPumpOff = !isPumpRunning;
      const currentMode = (pumpStatus.mode || 'AUTOMATIC').toUpperCase();
      const currentWaterLevel = Number(telemetry.water_level_pct);

      // =====================================================================
      // 0. SENSOR & SUBNODE HEALTH MONITORING
      // =====================================================================
      const now = Date.now();
      const subnodeOnline = telemetry.subnode_online !== false;
      const isUltrasonicFault = Boolean(telemetry.water_level_fault) || (telemetry.water_level_pct < 0) || (telemetry.sensor_status === 'ULTRASONIC_FAULT');
      const isWaterLevelValid = subnodeOnline && !isUltrasonicFault && currentWaterLevel >= 0.0;

      if (!subnodeOnline) {
        const lastTime = this.lastSubnodeAlertTime[targetId] || 0;
        if (now - lastTime > 60000) {
          this.lastSubnodeAlertTime[targetId] = now;
          await alertService.createAlert({
            deviceId: targetId,
            severity: 'critical',
            title: 'Tank Sub-Node Disconnected',
            message: 'Tank Sub-Node (ESP8266) link lost. Telemetry and water level data are currently unavailable.'
          });
        }
      } else if (isUltrasonicFault) {
        const lastTime = this.lastUltrasonicAlertTime[targetId] || 0;
        if (now - lastTime > 60000) {
          this.lastUltrasonicAlertTime[targetId] = now;
          await alertService.createAlert({
            deviceId: targetId,
            severity: 'warning',
            title: 'Water Level Sensor Hardware Fault',
            message: 'Tank Sub-Node is connected via ESP-NOW, but the ultrasonic level probe (JSN-SR04T) is not responding or unplugged.'
          });
        }
      }

      // =====================================================================
      // 1. SAFETY CRITICAL RULES (Physical Protection)
      // =====================================================================

      // Dry-Run Inflow Protection (Zero Flow while running > 120 sec)
      if (isPumpRunning && (pumpStatus.runtime_seconds || 0) > 120 && telemetry.flow_rate_lpm < 0.5 && subnodeOnline) {
        console.warn(`[Automation Safety] DRY RUN DETECTED! Zero flow (${telemetry.flow_rate_lpm} LPM) after 2 min runtime.`);
        await this.executePumpAction(targetId, 'EMERGENCY_STOP', 'Emergency Stop: Borewell Dry Run (Zero Inflow)');
        await alertService.createAlert({
          deviceId: targetId,
          severity: 'critical',
          title: 'EMERGENCY: Dry Run Detected',
          message: 'Water pump tripped into Emergency Lockout due to zero water inflow detection.'
        });
        return;
      }

      // =====================================================================
      // 2. AUTOMATIC MODE CONTROL (Strictly governed by user-defined rules)
      // =====================================================================
      if (currentMode === 'AUTOMATIC') {
        // Query active custom automation rules configured by the user
        const rules = await db.query<AutomationRule>(
          'SELECT * FROM automation_rules WHERE (device_id = ? OR device_id = ?) AND enabled = 1 ORDER BY priority ASC, created_at ASC',
          [targetId, targetUid]
        );

        let ruleExecuted = false;

        for (const rule of rules) {
          try {
            const condition = typeof rule.condition_json === 'string' ? JSON.parse(rule.condition_json) : rule.condition_json;
            const action = typeof rule.action_json === 'string' ? JSON.parse(rule.action_json) : rule.action_json;
            const targetAction = (action.pump_action || action.action || '').toUpperCase();

            // A) Low Level Threshold Check (e.g. level_lt: 30 or user value) -> START PUMP
            // Starts pump when water level <= threshold, even if tank level is 0%
            const lowThreshold = condition.level_lt !== undefined ? Number(condition.level_lt) :
                                 condition.level_lte !== undefined ? Number(condition.level_lte) :
                                 condition.level_min !== undefined ? Number(condition.level_min) : undefined;

            if (isWaterLevelValid && lowThreshold !== undefined && currentWaterLevel <= lowThreshold) {
              if ((targetAction === 'START' || targetAction === 'START_PUMP') && isPumpOff) {
                console.log(`[Automation] ✓ Rule '${rule.rule_name}' met: Water Level (${currentWaterLevel.toFixed(1)}%) <= ${lowThreshold}% -> DISPATCHING AUTO START`);
                await this.executePumpAction(targetId, 'START', `Automation Rule: ${rule.rule_name} (Level ${currentWaterLevel.toFixed(1)}% <= ${lowThreshold}%)`);
                ruleExecuted = true;

                if (action.generate_alert) {
                  await alertService.createAlert({
                    deviceId: targetId,
                    severity: action.alert_severity || 'info',
                    title: action.alert_title || rule.rule_name,
                    message: `Water pump automatically started by rule '${rule.rule_name}' because tank level is ${currentWaterLevel.toFixed(1)}% (Threshold: <= ${lowThreshold}%).`
                  });
                }
                break;
              }
            }

            // B) High Level Threshold Check (e.g. level_gt: 99 or user decided value) -> STOP PUMP
            // Strictly stops pump when water level >= user defined threshold
            const highThreshold = condition.level_gt !== undefined ? Number(condition.level_gt) :
                                  condition.level_gte !== undefined ? Number(condition.level_gte) :
                                  condition.level_max !== undefined ? Number(condition.level_max) : undefined;

            if (isWaterLevelValid && highThreshold !== undefined && currentWaterLevel >= highThreshold) {
              if ((targetAction === 'STOP' || targetAction === 'STOP_PUMP') && isPumpRunning) {
                console.log(`[Automation] ✓ Rule '${rule.rule_name}' met: Water Level (${currentWaterLevel.toFixed(1)}%) >= ${highThreshold}% -> DISPATCHING AUTO STOP`);
                await this.executePumpAction(targetId, 'STOP', `Automation Rule: ${rule.rule_name} (Level ${currentWaterLevel.toFixed(1)}% >= ${highThreshold}%)`);
                ruleExecuted = true;

                if (action.generate_alert) {
                  await alertService.createAlert({
                    deviceId: targetId,
                    severity: action.alert_severity || 'info',
                    title: action.alert_title || rule.rule_name,
                    message: `Water pump automatically stopped by rule '${rule.rule_name}' because tank level is ${currentWaterLevel.toFixed(1)}% (Cutoff: >= ${highThreshold}%).`
                  });
                }
                break;
              }
            }
          } catch (e: any) {
            console.warn(`[Automation] Error processing rule '${rule.rule_name}':`, e.message);
          }
        }

        // C) Fallback only if NO rules are configured in the system at all
        if (!ruleExecuted && rules.length === 0 && isWaterLevelValid) {
          if (isPumpOff && currentWaterLevel <= 30.0) {
            console.log(`[Automation Default] Tank level (${currentWaterLevel.toFixed(1)}% <= 30%). Dispatching real START command.`);
            await this.executePumpAction(targetId, 'START', `Default Auto-Start: Low level (${currentWaterLevel.toFixed(1)}% <= 30%)`);
          } else if (isPumpRunning && currentWaterLevel >= 100.0) {
            console.log(`[Automation Default] Tank 100% full. Dispatching real STOP command.`);
            await this.executePumpAction(targetId, 'STOP', `Default Auto-Stop: Tank full 100%`);
          }
        }
      }
    } catch (err: any) {
      console.error('[AutomationEngine] Error evaluating rules:', err.message);
    }
  }
}

export const automationEngine = AutomationEngine.getInstance();
