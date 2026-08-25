#include <Arduino.h>
#include "../include/config.h"
#include "water_level.h"
#include "flow_sensor.h"
#include "tds_sensor.h"
#include "espnow_client.h"

uint32_t lastTelemetryTime = 0;
#define TELEMETRY_INTERVAL_MS 2000 // 2-second telemetry loop

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n=======================================================");
    Serial.printf("  SMART WATER PUMP CONTROLLER - ESP8266 SUB NODE\n");
    Serial.printf("  Firmware: %s | Node UID: %s\n", FIRMWARE_VERSION, NODE_UID);
    Serial.println("=======================================================");

    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, HIGH); // Off for active-low LED

    // Initialize sensors
    waterLevel.begin();
    flowSensor.begin();
    tdsSensor.begin();
    espNowClient.begin();

    Serial.println("[MAIN] ESP8266 Sub Node Sensor Acquisition Active");
}

void loop() {
    // Continuous sampling
    flowSensor.update();

    if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryTime = millis();

        // Sample water level & TDS
        waterLevel.update();
        tdsSensor.update(24.5f); // 24.5°C ambient default

        // Sensor health bitmask
        uint8_t healthMask = 0;
        if (!waterLevel.isHealthy()) healthMask |= (1 << 0);
        if (!tdsSensor.isHealthy()) healthMask |= (1 << 2);

        // Send telemetry packet over ESP-NOW to ESP32
        bool ok = espNowClient.sendTelemetry(
            waterLevel.getLevelPercentage(),
            waterLevel.getVolumeLiters(),
            flowSensor.getFlowRateLpm(),
            flowSensor.getTotalLiters(),
            tdsSensor.getTdsPpm(),
            tdsSensor.getTemperatureC(),
            healthMask,
            3300 // 3.3V regulated power rail
        );

        // Quick LED blink on transmission
        digitalWrite(PIN_STATUS_LED, LOW);
        delay(15);
        digitalWrite(PIN_STATUS_LED, HIGH);

        Serial.printf("[SUB] Level: %.1f%% (%.0fL) | Flow: %.1f L/m | TDS: %.0f ppm | Sent: %s (Total: %u)\n",
                      waterLevel.getLevelPercentage(),
                      waterLevel.getVolumeLiters(),
                      flowSensor.getFlowRateLpm(),
                      tdsSensor.getTdsPpm(),
                      ok ? "OK" : "FAIL",
                      espNowClient.getPacketsSent());
    }

    delay(10);
}
