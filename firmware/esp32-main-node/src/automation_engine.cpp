#include "automation_engine.h"
#include "pump_controller.h"
#include "espnow_manager.h"

AutomationEngine autoEngine;

AutomationEngine::AutomationEngine()
    : lowStartThreshold(LEVEL_AUTO_START_PCT), highStopThreshold(LEVEL_AUTO_STOP_PCT), zeroFlowStartTime(0) {}

void AutomationEngine::begin() {
    Serial.printf("[Automation] Local Fail-Safe Engine Initialized (Start: <%.1f%%, Stop: >%.1f%%)\n",
                  lowStartThreshold, highStopThreshold);
}

void AutomationEngine::update() {
    evaluateLocalRules();
}

void AutomationEngine::setAutoThresholds(float lowStartPct, float highStopPct) {
    lowStartThreshold = lowStartPct;
    highStopThreshold = highStopPct;
    Serial.printf("[Automation] Updated thresholds -> Low: %.1f%%, High: %.1f%%\n", lowStartThreshold, highStopThreshold);
}

void AutomationEngine::evaluateLocalRules() {
    // 1. Check Sub-node connectivity
    bool subnodeAlive = espNowMgr.isSubnodeConnected();
    const TankTelemetryPacket& packet = espNowMgr.getLatestPacket();

    // SAFETY RULE 1: If Sub Node communication is lost while pump is running, stop pump to prevent overflow
    if (!subnodeAlive && pumpCtrl.getState() == PUMP_ON) {
        Serial.println("[Automation] SAFETY LOCK: Sub Node packet timeout while pump running -> STOPPING PUMP");
        pumpCtrl.stopPump("SAFETY_SUBNODE_TIMEOUT");
        return;
    }

    if (!subnodeAlive) return;

    // SAFETY RULE 2: Tank Full Overflow Cutoff (Active in ALL modes)
    if (packet.water_level_pct >= highStopThreshold && pumpCtrl.getState() == PUMP_ON) {
        Serial.printf("[Automation] Tank Full (%.1f%% >= %.1f%%) -> AUTO STOP\n", packet.water_level_pct, highStopThreshold);
        pumpCtrl.stopPump("AUTO_TANK_FULL");
        return;
    }

    // SAFETY RULE 3: Dry-Run Protection (Zero Inflow while pump running)
    if (pumpCtrl.getState() == PUMP_ON) {
        if (packet.flow_rate_lpm < 0.5f) {
            if (zeroFlowStartTime == 0) {
                zeroFlowStartTime = millis();
            } else if ((millis() - zeroFlowStartTime) > (DRY_RUN_TIMEOUT_SEC * 1000)) {
                pumpCtrl.emergencyStop("DRY_RUN_PROTECTION: Zero Inflow for 120s");
                zeroFlowStartTime = 0;
                return;
            }
        } else {
            zeroFlowStartTime = 0;
        }
    } else {
        zeroFlowStartTime = 0;
    }

    // AUTOMATIC MODE RULES
    if (pumpCtrl.getMode() == MODE_AUTOMATIC) {
        if (packet.water_level_pct <= lowStartThreshold && pumpCtrl.getState() == PUMP_OFF && !pumpCtrl.isFaulted()) {
            Serial.printf("[Automation] Low Water Detected (%.1f%% <= %.1f%%) -> AUTO START PUMP\n",
                          packet.water_level_pct, lowStartThreshold);
            pumpCtrl.startPump("AUTO_LOW_WATER_THRESHOLD");
        }
    }
}
