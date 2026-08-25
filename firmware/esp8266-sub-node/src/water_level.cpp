#include "water_level.h"

WaterLevelSensor waterLevel;

WaterLevelSensor::WaterLevelSensor() 
    : levelPct(0.0f), volumeLiters(0.0f), rawDistanceCm(0.0f), healthy(true), sampleIndex(0) {
    for (int i = 0; i < 5; i++) samples[i] = 100.0f;
}

void WaterLevelSensor::begin() {
    pinMode(PIN_TRIG, OUTPUT);
    pinMode(PIN_ECHO, INPUT);
    digitalWrite(PIN_TRIG, LOW);
}

void WaterLevelSensor::update() {
    float dist = measureDistanceCm();
    if (dist > 5.0f && dist < 450.0f) {
        samples[sampleIndex] = dist;
        sampleIndex = (sampleIndex + 1) % 5;
        healthy = true;
    } else {
        healthy = false;
    }

    rawDistanceCm = getMedianFilteredDistance();

    // Calculate water column height
    // Effective tank depth = (TANK_TOTAL_HEIGHT_CM - TANK_SENSOR_OFFSET_CM)
    float effectiveDepth = TANK_TOTAL_HEIGHT_CM - TANK_SENSOR_OFFSET_CM;
    float waterHeight = TANK_TOTAL_HEIGHT_CM - rawDistanceCm;

    if (waterHeight < 0.0f) waterHeight = 0.0f;
    if (waterHeight > effectiveDepth) waterHeight = effectiveDepth;

    levelPct = (waterHeight / effectiveDepth) * 100.0f;
    if (levelPct < 0.0f) levelPct = 0.0f;
    if (levelPct > 100.0f) levelPct = 100.0f;

    volumeLiters = (levelPct / 100.0f) * TANK_TOTAL_CAPACITY_L;
}

float WaterLevelSensor::measureDistanceCm() {
    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);

    long duration = pulseIn(PIN_ECHO, HIGH, 30000); // 30ms timeout (~5 meters max)
    if (duration == 0) return 999.0f;

    // Speed of sound = 343 m/s = 0.0343 cm/microsecond
    // Distance = (Duration * 0.0343) / 2
    return (duration * 0.0343f) / 2.0f;
}

float WaterLevelSensor::getMedianFilteredDistance() {
    float sorted[5];
    memcpy(sorted, samples, sizeof(samples));

    // Simple bubble sort for 5 elements
    for (int i = 0; i < 4; i++) {
        for (int j = 0; j < 4 - i; j++) {
            if (sorted[j] > sorted[j + 1]) {
                float tmp = sorted[j];
                sorted[j] = sorted[j + 1];
                sorted[j + 1] = tmp;
            }
        }
    }
    return sorted[2]; // Median
}
