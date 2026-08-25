#include "tds_sensor.h"

TdsSensor tdsSensor;

TdsSensor::TdsSensor() 
    : tdsPpm(150.0f), temperatureC(25.0f), healthy(true), sampleIdx(0) {
    for (int i = 0; i < 10; i++) samples[i] = 1.0f;
}

void TdsSensor::begin() {
    pinMode(PIN_TDS_ADC, INPUT);
}

void TdsSensor::update(float currentTemperatureC) {
    temperatureC = currentTemperatureC;

    // Read analog voltage from A0 (ESP8266 ADC is 0 - 1.0V, with board resistor divider up to 3.3V)
    int rawAdc = analogRead(PIN_TDS_ADC);
    float voltage = (rawAdc / 1024.0f) * 3.3f;

    samples[sampleIdx] = voltage;
    sampleIdx = (sampleIdx + 1) % 10;

    // Average 10 samples
    float avgVoltage = 0;
    for (int i = 0; i < 10; i++) avgVoltage += samples[i];
    avgVoltage /= 10.0f;

    // Temperature compensation formula: V_compensation = V / (1.0 + 0.02 * (T - 25.0))
    float compensationCoefficient = 1.0f + 0.02f * (temperatureC - 25.0f);
    float compensationVoltage = avgVoltage / compensationCoefficient;

    // TDS conversion polynomial (Standard Gravity Analog TDS equation)
    // TDS = (133.42 * V^3 - 255.86 * V^2 + 857.39 * V) * 0.5
    float calculatedTds = (133.42f * pow(compensationVoltage, 3) 
                         - 255.86f * pow(compensationVoltage, 2) 
                         + 857.39f * compensationVoltage) * 0.5f;

    if (calculatedTds < 0.0f) calculatedTds = 0.0f;
    if (calculatedTds > 2000.0f) calculatedTds = 2000.0f;

    tdsPpm = calculatedTds;
    healthy = (avgVoltage > 0.05f && avgVoltage < 3.25f);
}
