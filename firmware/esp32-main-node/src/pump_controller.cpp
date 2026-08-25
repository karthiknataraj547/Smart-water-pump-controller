#include "pump_controller.h"

PumpController pumpCtrl;

PumpController::PumpController() 
    : currentState(PUMP_OFF), currentMode(MODE_AUTOMATIC), startTimestamp(0), currentAmps(0.0f), isFault(false) {
    memset(lastFaultReason, 0, sizeof(lastFaultReason));
}

void PumpController::begin() {
    pinMode(PIN_RELAY_PUMP, OUTPUT);
    pinMode(PIN_FEEDBACK_CONTACTOR, INPUT_PULLUP);
    pinMode(PIN_CURRENT_SENSOR, INPUT);
    pinMode(PIN_LED_PUMP_ACTIVE, OUTPUT);
    pinMode(PIN_LED_ERROR, OUTPUT);
    pinMode(PIN_BUZZER, OUTPUT);

    // Initial safe state: Opto-isolated relay OFF (Active LOW relay requires HIGH to deactivate)
    digitalWrite(PIN_RELAY_PUMP, HIGH);
    digitalWrite(PIN_LED_PUMP_ACTIVE, LOW);
    digitalWrite(PIN_LED_ERROR, LOW);
    digitalWrite(PIN_BUZZER, LOW);
}

void PumpController::update() {
    readSensors();

    // Check runtime over-limit protection
    if (currentState == PUMP_ON) {
        if (getRuntimeSeconds() > MAX_RUNTIME_SECONDS) {
            emergencyStop("Max Continuous Runtime Exceeded (60 Mins)");
        }
    }

    // Check overcurrent protection
    if (currentAmps > OVERCURRENT_THRESHOLD) {
        emergencyStop("Motor Overcurrent Detected");
    }

    // Update status indicators
    digitalWrite(PIN_LED_PUMP_ACTIVE, (currentState == PUMP_ON) ? HIGH : LOW);
    digitalWrite(PIN_LED_ERROR, isFault ? HIGH : LOW);
}

bool PumpController::startPump(const char* reason) {
    if (isFault) {
        Serial.printf("[PumpController] Cannot start pump: System in FAULT state (%s)\n", lastFaultReason);
        return false;
    }
    if (currentMode == MODE_EMERGENCY_STOP) {
        Serial.println("[PumpController] Cannot start pump: In EMERGENCY_STOP mode");
        return false;
    }

    if (currentState != PUMP_ON) {
        Serial.printf("[PumpController] Starting pump. Reason: %s\n", reason);
        setRelayOutput(true);
        currentState = PUMP_ON;
        startTimestamp = millis();
        return true;
    }
    return true;
}

bool PumpController::stopPump(const char* reason) {
    if (currentState != PUMP_OFF) {
        Serial.printf("[PumpController] Stopping pump. Reason: %s\n", reason);
        setRelayOutput(false);
        currentState = PUMP_OFF;
        startTimestamp = 0;
        return true;
    }
    return true;
}

void PumpController::emergencyStop(const char* reason) {
    Serial.printf("[PumpController] !!! EMERGENCY STOP TRIGGERED: %s !!!\n", reason);
    setRelayOutput(false);
    currentState = PUMP_FAULT;
    currentMode = MODE_EMERGENCY_STOP;
    isFault = true;
    strncpy(lastFaultReason, reason, sizeof(lastFaultReason) - 1);
    
    // Pulse buzzer warning
    for (int i = 0; i < 3; i++) {
        digitalWrite(PIN_BUZZER, HIGH);
        delay(100);
        digitalWrite(PIN_BUZZER, LOW);
        delay(100);
    }
}

void PumpController::setMode(PumpMode mode) {
    currentMode = mode;
    Serial.printf("[PumpController] Mode set to: %d\n", mode);
}

uint32_t PumpController::getRuntimeSeconds() const {
    if (currentState == PUMP_ON && startTimestamp > 0) {
        return (millis() - startTimestamp) / 1000;
    }
    return 0;
}

void PumpController::clearFault() {
    isFault = false;
    memset(lastFaultReason, 0, sizeof(lastFaultReason));
    currentState = PUMP_OFF;
    if (currentMode == MODE_EMERGENCY_STOP) {
        currentMode = MODE_MANUAL;
    }
    digitalWrite(PIN_LED_ERROR, LOW);
    Serial.println("[PumpController] Fault cleared. Ready for operation.");
}

void PumpController::setRelayOutput(bool enable) {
    // Active LOW relay module
    digitalWrite(PIN_RELAY_PUMP, enable ? LOW : HIGH);
}

void PumpController::readSensors() {
    if (currentState == PUMP_ON) {
        // Read analog current sensor (ACS712 20A / 30A module)
        int raw = analogRead(PIN_CURRENT_SENSOR);
        float voltage = (raw / 4095.0f) * 3.3f;
        // Floating / disconnected sensor guard
        if (voltage < 0.25f || raw < 150) {
            currentAmps = 0.0f;
            return;
        }
        // Sensitivity ~66mV/A for ACS712-30A centered at 1.65V (with 3.3V divider)
        float amps = fabsf((voltage - 1.65f) / 0.066f);
        if (amps >= 24.0f) amps = 0.0f;
        currentAmps = amps;
    } else {
        currentAmps = 0.0f;
    }
}
