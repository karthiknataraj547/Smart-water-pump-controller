#include "flow_sensor.h"

FlowSensor flowSensor;

static volatile uint32_t pulseCount = 0;

void IRAM_ATTR FlowSensor::onPulseInterrupt() {
    pulseCount++;
}

FlowSensor::FlowSensor() 
    : currentFlowRateLpm(0.0f), totalInflowLiters(0.0f), lastCalcTime(0) {}

void FlowSensor::begin() {
    pinMode(PIN_FLOW_SENSOR, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_FLOW_SENSOR), onPulseInterrupt, RISING);
    lastCalcTime = millis();
}

void FlowSensor::update() {
    uint32_t now = millis();
    uint32_t elapsedMs = now - lastCalcTime;

    if (elapsedMs >= 1000) {
        // Disable interrupt briefly while reading and clearing pulseCount
        noInterrupts();
        uint32_t pulses = pulseCount;
        pulseCount = 0;
        interrupts();

        lastCalcTime = now;

        // Flow rate (L/min) = (Pulses per sec) / 7.5
        float pulsesPerSec = (pulses * 1000.0f) / (float)elapsedMs;
        currentFlowRateLpm = pulsesPerSec / FLOW_CALIBRATION_FACTOR;

        // Volume increment in Liters = FlowRate (L/min) * (elapsedMs / 60000.0)
        float litersInc = (currentFlowRateLpm * elapsedMs) / 60000.0f;
        totalInflowLiters += litersInc;
    }
}
