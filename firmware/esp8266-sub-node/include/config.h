#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// Device Identification
#define NODE_UID "TNK-SUB-8266-01"
#define NODE_TYPE "esp8266_tank_subnode"
#define FIRMWARE_VERSION "v1.4.2"

// Pin Definitions (NodeMCU / ESP8266)
#define PIN_TRIG            D1  // GPIO 5 - Ultrasonic Trigger
#define PIN_ECHO            D2  // GPIO 4 - Ultrasonic Echo
#define PIN_FLOW_SENSOR     D5  // GPIO 14 - YF-S201 Hall Pulse Interrupt
#define PIN_TDS_ADC         A0  // Analog ADC Input for TDS Sensor
#define PIN_DS18B20_TEMP    D6  // GPIO 12 - OneWire Temperature Sensor
#define PIN_FLOAT_SAFETY    D7  // GPIO 13 - Float switch backup (Active LOW)
#define PIN_STATUS_LED      D4  // GPIO 2 - Built-in LED (Active LOW)

// Tank Calibration Parameters
#define TANK_TOTAL_HEIGHT_CM 150.0f  // Total height from sensor to tank bottom
#define TANK_SENSOR_OFFSET_CM 15.0f  // Blind zone offset from top (min distance)
#define TANK_TOTAL_CAPACITY_L 2000.0f // Maximum usable tank volume in Liters

// Flow Sensor Calibration
#define FLOW_CALIBRATION_FACTOR 7.5f // YF-S201: Pulse frequency (Hz) = 7.5 * Flow rate (L/min)

// ESP-NOW Target Configuration
#define ESPNOW_CHANNEL      1
// Target ESP32 Main Node MAC address (Broadcast or paired unicast)
static const uint8_t MAIN_NODE_MAC[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// Telemetry Packet Structure (Must strictly match ESP32 Main Node)
typedef struct __attribute__((packed)) {
    uint8_t  magic;           // 0xAA
    uint8_t  node_id;         // 0x01
    uint32_t sequence_num;    // Packet sequence counter
    float    water_level_pct; // 0.0 to 100.0%
    float    water_liters;    // Calibrated volume in Liters
    float    flow_rate_lpm;   // Flow rate in L/min
    float    total_inflow_l;  // Total accumulated Liters
    float    tds_ppm;         // Water purity TDS in ppm
    float    temperature_c;   // Temperature in Celsius
    uint8_t  sensor_health;   // Bitmask [0: ultrasonic, 1: flow, 2: tds, 3: float]
    uint16_t battery_mv;      // Battery voltage in mV
    uint16_t crc16;           // CRC16-CCITT Checksum
} TankTelemetryPacket;

#endif // CONFIG_H
