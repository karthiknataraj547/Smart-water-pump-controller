#include <Arduino.h>
#include <esp_task_wdt.h>
#include "../include/config.h"
#include "pump_controller.h"
#include "espnow_manager.h"
#include "wifi_manager.h"
#include "ble_provisioning.h"
#include "cloud_client.h"
#include "automation_engine.h"
#include "device_auth.h"
#include "ota_manager.h"

// FreeRTOS Task Handles
TaskHandle_t TaskAutomationHandle;
TaskHandle_t TaskCloudHandle;

// Button state tracking
uint32_t btnManualPressTime = 0;
uint32_t btnProvPressTime = 0;
bool lastManualBtnState = HIGH;
bool lastProvBtnState = HIGH;

// Watchdog timeout (10 seconds)
#define WDT_TIMEOUT_SECONDS 10

// Automation & Safety Task (Core 1)
void TaskAutomation(void *pvParameters) {
    esp_task_wdt_add(NULL);
    for (;;) {
        pumpCtrl.update();
        autoEngine.update();
        esp_task_wdt_reset();
        vTaskDelay(pdMS_TO_TICKS(100)); // 10Hz control loop
    }
}

// Cloud & Networking Task (Core 0)
void TaskCloud(void *pvParameters) {
    esp_task_wdt_add(NULL);
    for (;;) {
        wifiMgr.update();
        cloudClient.update();
        bleProv.update();
        espNowMgr.update();
        esp_task_wdt_reset();
        vTaskDelay(pdMS_TO_TICKS(50)); // 20Hz network loop
    }
}

void checkPhysicalButtons() {
    // 1. Manual Toggle Button (with debounce)
    bool curManual = digitalRead(PIN_BUTTON_MANUAL);
    if (curManual == LOW && lastManualBtnState == HIGH) {
        btnManualPressTime = millis();
    } else if (curManual == HIGH && lastManualBtnState == LOW) {
        if (millis() - btnManualPressTime > 50 && millis() - btnManualPressTime < 3000) {
            // Short press: Toggle pump
            if (pumpCtrl.getState() == PUMP_ON) {
                pumpCtrl.stopPump("MANUAL_BUTTON_PRESS");
            } else {
                pumpCtrl.startPump("MANUAL_BUTTON_PRESS");
            }
        }
    }
    lastManualBtnState = curManual;

    // 2. Provisioning Button (Long press > 5 seconds triggers BLE mode)
    bool curProv = digitalRead(PIN_BUTTON_PROVISION);
    if (curProv == LOW && lastProvBtnState == HIGH) {
        btnProvPressTime = millis();
    } else if (curProv == LOW && (millis() - btnProvPressTime > 5000)) {
        if (!bleProv.isProvisioningActive()) {
            Serial.println("[MAIN] Long press detected -> Entering BLE Provisioning Mode!");
            bleProv.startAdvertising();
        }
    }
    lastProvBtnState = curProv;
}

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n=======================================================");
    Serial.printf("  SMART WATER PUMP CONTROLLER - ESP32 MAIN NODE\n");
    Serial.printf("  Firmware: %s | Hardware: %s\n", FIRMWARE_VERSION, HARDWARE_REVISION);
    Serial.printf("  Device UID: %s\n", DEFAULT_DEVICE_UID);
    Serial.println("=======================================================");

    // 1. Initialize Hardware Pins
    pinMode(PIN_BUTTON_MANUAL, INPUT_PULLUP);
    pinMode(PIN_BUTTON_PROVISION, INPUT_PULLUP);
    pinMode(PIN_LED_POWER, OUTPUT);
    digitalWrite(PIN_LED_POWER, HIGH);

    // 2. Initialize Watchdog Timer
    esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);

    // 3. Initialize Subsystems
    deviceAuth.begin();
    pumpCtrl.begin();
    espNowMgr.begin();
    wifiMgr.begin();
    bleProv.begin();
    cloudClient.begin();
    autoEngine.begin();
    otaMgr.begin();

    // 4. Create Multi-core FreeRTOS Tasks
    xTaskCreatePinnedToCore(
        TaskAutomation,
        "TaskAutomation",
        4096,
        NULL,
        2,
        &TaskAutomationHandle,
        1 // Core 1 for real-time safety & GPIO
    );

    xTaskCreatePinnedToCore(
        TaskCloud,
        "TaskCloud",
        8192,
        NULL,
        1,
        &TaskCloudHandle,
        0 // Core 0 for Wi-Fi/BLE/MQTT/OTA
    );

    Serial.println("[MAIN] System Armed & FreeRTOS Dual-Core Tasks Running.");
}

void loop() {
    checkPhysicalButtons();
    delay(20);
}
