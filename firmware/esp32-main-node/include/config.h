#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// Device Identification
#define DEVICE_TYPE "ESP32_MAIN_CONTROLLER"
#define HARDWARE_REVISION "REV_2.1"
#define FIRMWARE_VERSION "v1.4.2"
#define DEFAULT_DEVICE_UID "WPC-A81F29"

// Pin Definitions
#define PIN_RELAY_PUMP         23  // Opto-isolated relay drive (Active LOW)
#define PIN_FEEDBACK_CONTACTOR 22  // Auxiliary contact feedback from industrial contactor
#define PIN_CURRENT_SENSOR     34  // ACS712 / Hall current sensor analog input
#define PIN_BUTTON_MANUAL      18  // Tactile push button for manual pump toggle
#define PIN_BUTTON_PROVISION   19  // Long press (>5s) triggers BLE Provisioning Mode
#define PIN_LED_POWER          5   // Power indicator
#define PIN_LED_PUMP_ACTIVE    4   // Illuminated pump active LED
#define PIN_LED_CLOUD_STATUS   2   // Built-in LED (GPIO 2): Solid = Connected, Blinking = Connecting
#define PIN_LED_ERROR          21  // Red = System Fault / Dry Run Trip
#define PIN_BUZZER             13  // Audible alert tone

// Communication & Network
#define ESPNOW_CHANNEL         1
#define DEFAULT_MQTT_PORT      1883
#define DEFAULT_MQTT_HOST      "broker.emqx.io"
#define DEFAULT_API_HOST       "192.168.31.53"
#define DEFAULT_API_PORT       5000
#define HEARTBEAT_INTERVAL_MS  5000
#define SUBNODE_TIMEOUT_MS     30000            // 30 seconds without packet = Sub Node Lost

// Safety & Threshold Limits
#define LEVEL_CRITICAL_LOW_PCT 15.0f
#define LEVEL_AUTO_START_PCT   30.0f
#define LEVEL_AUTO_STOP_PCT    95.0f
#define MAX_RUNTIME_SECONDS    3600             // 1 hour continuous run limit
#define DRY_RUN_TIMEOUT_SEC    120              // Stop if 0 flow for 2 minutes while pump ON
#define OVERCURRENT_THRESHOLD  15.0f            // Amperes limit for motor trip

// ESP-NOW Telemetry Packet Structure (Must match ESP8266 Sub Node)
typedef struct __attribute__((packed)) {
    uint8_t  magic;           // 0xAA
    uint8_t  node_id;         // 0x01
    uint32_t sequence_num;    // Packet sequence counter
    float    water_level_pct; // 0.0 to 100.0%
    float    water_liters;    // Calibrated volume
    float    flow_rate_lpm;   // Flow rate in L/min
    float    total_inflow_l;  // Totalizer in Liters
    float    tds_ppm;         // Water TDS ppm
    float    temperature_c;   // Water temperature
    uint8_t  sensor_health;   // Bitmask of sensor health
    uint16_t battery_mv;      // Battery voltage in mV
    uint16_t crc16;           // CRC16 Checksum
} TankTelemetryPacket;

#endif // CONFIG_H
