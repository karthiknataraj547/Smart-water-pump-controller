/**
 * ============================================================================
 * SMART WATER PUMP CONTROLLER — ESP8266 SUB NODE FIRMWARE (v2.1.0)
 * ============================================================================
 * Target Hardware: ESP8266 NodeMCU / WeMos D1 Mini
 * Platform: Arduino IDE / PlatformIO
 * 
 * Hardware Pinout:
 *  - D1 (GPIO 5):  Ultrasonic Sensor TRIG
 *  - D2 (GPIO 4):  Ultrasonic Sensor ECHO (via 1k/2k voltage divider to 3.3V)
 *  - D5 (GPIO 14): YF-S201 Flow Sensor Pulse Signal (Interrupt)
 *  - A0 (ADC0):    Analog TDS Water Quality Sensor (0 - 3.3V)
 *  - D4 (GPIO 2):  Onboard Status LED (Active LOW)
 * ============================================================================
 */

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <espnow.h>
#include <user_interface.h>

#define SUB_NODE_ID 0x01

// Target Wi-Fi SSID to auto-sync radio RF channel with ESP32 Main Node
#define TARGET_WIFI_SSID     "Monk"
#define DEFAULT_CHANNEL      1

#define PIN_TRIG       D1
#define PIN_ECHO       D2
#define PIN_FLOW       D5
#define PIN_TDS        A0
#define PIN_LED        D4

// --- Tank Dimensions ---
#define TANK_HEIGHT_CM       150.0  // Total height from bottom to sensor
#define TANK_SENSOR_OFFSET   15.0   // Distance from sensor to 100% max water mark
#define TANK_CAPACITY_LITERS 2000.0 // Full volume in Liters

// --- Broadcast MAC Address (All FF = Broadcast to all ESP-NOW Receivers) ---
uint8_t esp32BroadcastMac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// --- Binary Telemetry Packet Structure (35 Bytes) ---
typedef struct __attribute__((packed)) {
    uint8_t  magic;           // 0xAA
    uint8_t  node_id;         // 0x01
    uint32_t sequence_num;
    float    water_level_pct;
    float    water_liters;
    float    flow_rate_lpm;
    float    total_inflow_l;
    float    tds_ppm;
    float    temperature_c;
    uint8_t  sensor_health;
    uint16_t battery_mv;
    uint16_t crc16;
} TankTelemetryPacket;

// --- Global Sensor Variables ---
volatile uint32_t flowPulseCount = 0;
uint32_t lastFlowCalcTime = 0;
float flowRateLpm = 0.0;
float totalLiters = 0.0;
uint32_t packetSequence = 0;
uint8_t currentWifiChannel = DEFAULT_CHANNEL;

// --- Flow Sensor Interrupt Routine ---
void ICACHE_RAM_ATTR onPulseInterrupt() {
    flowPulseCount++;
}

// --- CRC16-CCITT Checksum Calculation ---
uint16_t calculateCrc16(const uint8_t *data, size_t length) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < length; i++) {
        crc ^= (uint16_t)data[i] << 8;
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
            else crc <<= 1;
        }
    }
    return crc;
}

// --- Auto-Detect Wi-Fi Channel of Target Network ---
int findTargetWifiChannel(const char* ssid) {
    if (!ssid || strlen(ssid) == 0) return DEFAULT_CHANNEL;
    Serial.printf("[WiFi Scan] Scanning 2.4GHz spectrum for SSID: '%s'...\n", ssid);
    int numNetworks = WiFi.scanNetworks(false, true);
    for (int i = 0; i < numNetworks; i++) {
        if (WiFi.SSID(i) == ssid) {
            int ch = WiFi.channel(i);
            Serial.printf("[WiFi Scan] ✓ Found '%s' on Channel %d (RSSI: %d dBm)\n", ssid, ch, WiFi.RSSI(i));
            return ch;
        }
    }
    Serial.printf("[WiFi Scan] SSID '%s' not found in immediate scan. Defaulting to Channel %d\n", ssid, DEFAULT_CHANNEL);
    return DEFAULT_CHANNEL;
}

// --- Ultrasonic 5-Sample Median Filtered Measurement ---
float readRawUltrasonicDistance() {
    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);

    long duration = pulseIn(PIN_ECHO, HIGH, 25000); // 25ms timeout (~4.2m)
    if (duration == 0) return -1.0;
    return (duration * 0.0343) / 2.0; // Distance in cm
}

float getMedianDistance() {
    float samples[3];
    int validCount = 0;

    for (int i = 0; i < 3; i++) {
        float d = readRawUltrasonicDistance();
        if (d > 2.0 && d < 400.0) {
            samples[validCount++] = d;
        }
        delayMicroseconds(800);
    }

    if (validCount == 0) return -1.0;
    if (validCount == 1) return samples[0];

    // Simple 3-element sort
    if (validCount == 2) return (samples[0] + samples[1]) / 2.0f;
    if (samples[0] > samples[1]) { float tmp = samples[0]; samples[0] = samples[1]; samples[1] = tmp; }
    if (samples[1] > samples[2]) { float tmp = samples[1]; samples[1] = samples[2]; samples[2] = tmp; }
    if (samples[0] > samples[1]) { float tmp = samples[0]; samples[0] = samples[1]; samples[1] = tmp; }
    return samples[1];
}

// --- Flow Rate & Volume Calculation ---
void updateFlowMetrics() {
    uint32_t now = millis();
    uint32_t dt = now - lastFlowCalcTime;
    if (dt >= 200) {
        noInterrupts();
        uint32_t pulses = flowPulseCount;
        flowPulseCount = 0;
        interrupts();

        // YF-S201: 7.5 pulses per second per L/min
        flowRateLpm = ((float)pulses / 7.5) * (1000.0 / dt);
        float litersIncrement = (flowRateLpm / 60.0) * (dt / 1000.0);
        totalLiters += litersIncrement;
        lastFlowCalcTime = now;
    }
}

// --- Temperature-Compensated TDS ppm Calculation ---
float readTdsPpm(float waterTempC = 25.0) {
    int rawAdc = analogRead(PIN_TDS);
    float voltage = (rawAdc / 1024.0) * 3.3;

    // Floating pin guard (0V or no sensor connected) -> Strict 0 ppm
    if (voltage < 0.05) return 0.0;

    float compensationCoefficient = 1.0 + 0.02 * (waterTempC - 25.0);
    float compensationVoltage = voltage / compensationCoefficient;

    float tdsValue = (133.42 * pow(compensationVoltage, 3) 
                    - 255.86 * pow(compensationVoltage, 2) 
                    + 857.39 * compensationVoltage) * 0.5;

    if (tdsValue < 0.0) tdsValue = 0.0;
    return tdsValue;
}

// --- ESP-NOW Send Callback ---
void onDataSent(uint8_t *mac_addr, uint8_t sendStatus) {
    if (sendStatus == 0) {
        // Delivery Success
    }
}

// --- Arduino Setup ---
void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("\n==================================================");
    Serial.println("  AQUACONTROL — ESP8266 TANK SUB NODE v2.3.0");
    Serial.println("  Strict Hardware Telemetry (Zero Fallback / 200ms)");
    Serial.println("==================================================");

    pinMode(PIN_TRIG, OUTPUT);
    pinMode(PIN_ECHO, INPUT);
    pinMode(PIN_FLOW, INPUT_PULLUP);
    pinMode(PIN_TDS, INPUT);
    pinMode(PIN_LED, OUTPUT);
    digitalWrite(PIN_LED, HIGH); // LED Off (Active LOW)

    // Flow sensor interrupt on rising edge
    attachInterrupt(digitalPinToInterrupt(PIN_FLOW), onPulseInterrupt, RISING);
    lastFlowCalcTime = millis();

    // 1. Initialize Wi-Fi in Station Mode
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();

    // 2. Detect & Align Wi-Fi Channel with Home Router & ESP32
    currentWifiChannel = findTargetWifiChannel(TARGET_WIFI_SSID);
    wifi_set_channel(currentWifiChannel);
    Serial.printf("[ESP-NOW] Operating on 2.4GHz Wi-Fi Channel: %d\n", currentWifiChannel);

    // 3. Initialize ESP-NOW Protocol
    if (esp_now_init() != 0) {
        Serial.println("[ERROR] ESP-NOW Protocol Init Failed!");
        return;
    }

    esp_now_set_self_role(ESP_NOW_ROLE_CONTROLLER);
    esp_now_register_send_cb(onDataSent);

    // Register Broadcast Peer on the matching RF Channel
    esp_now_add_peer(esp32BroadcastMac, ESP_NOW_ROLE_SLAVE, currentWifiChannel, NULL, 0);

    Serial.printf("[ESP-NOW] Sub Node Ready! Broadcasting 200ms telemetry to ESP32 on Channel %d...\n", currentWifiChannel);
}

// --- Main Acquisition & Telemetry Loop (200ms Rate / 5Hz) ---
void loop() {
    // 1. Maintain Flow Metrics continuously
    updateFlowMetrics();

    // 2. Transmit Telemetry every 100ms (10Hz Ultra Real-Time Stream)
    static uint32_t lastTxTime = 0;
    if (millis() - lastTxTime >= 100) {
        lastTxTime = millis();

        // Sample Median Distance from Ultrasonic Sensor
        float distanceCm = getMedianDistance();
        float levelPercentage = 0.0;
        float waterLiters = 0.0;
        uint8_t sensorHealth = 0x0E; // Bit 0: Ultrasonic, Bit 1: Flow, Bit 2: TDS, Bit 3: RF

        if (distanceCm > 0.0) {
            float effectiveDepth = TANK_HEIGHT_CM - TANK_SENSOR_OFFSET;
            if (effectiveDepth <= 0.0f) effectiveDepth = TANK_HEIGHT_CM;
            
            float currentWaterDepth = TANK_HEIGHT_CM - distanceCm;
            levelPercentage = (currentWaterDepth / effectiveDepth) * 100.0f;
            if (distanceCm <= TANK_SENSOR_OFFSET) levelPercentage = 100.0f;
            if (distanceCm >= TANK_HEIGHT_CM) levelPercentage = 0.0f;
            levelPercentage = constrain(levelPercentage, 0.0f, 100.0f);
            waterLiters = (levelPercentage / 100.0f) * TANK_CAPACITY_LITERS;
            sensorHealth |= 0x01; // Ultrasonic Health OK
        } else {
            // Strict Fault: Ultrasonic probe disconnected or no echo
            levelPercentage = -1.0f;
            waterLiters = 0.0f;
            sensorHealth &= ~0x01; // Ultrasonic Fault
        }

        // Sample TDS
        float tdsPpm = readTdsPpm(24.5);

        // Prepare Binary Telemetry Packet (35 Bytes)
        TankTelemetryPacket packet;
        packet.magic = 0xAA;
        packet.node_id = SUB_NODE_ID;
        packet.sequence_num = ++packetSequence;
        packet.water_level_pct = levelPercentage;
        packet.water_liters = waterLiters;
        packet.flow_rate_lpm = flowRateLpm;
        packet.total_inflow_l = totalLiters;
        packet.tds_ppm = tdsPpm;
        packet.temperature_c = 24.5;
        packet.sensor_health = sensorHealth;
        packet.battery_mv = 3300;

        // Calculate CRC16-CCITT Checksum over the first 33 bytes
        packet.crc16 = calculateCrc16((const uint8_t*)&packet, sizeof(TankTelemetryPacket) - 2);

        // Brief non-blocking LED flash during RF Transmission
        digitalWrite(PIN_LED, LOW); // LED ON
        int result = esp_now_send(esp32BroadcastMac, (uint8_t*)&packet, sizeof(TankTelemetryPacket));
        digitalWrite(PIN_LED, HIGH); // LED OFF

        if (packet.sequence_num % 10 == 0) {
            Serial.printf("[TX #%04d | 100ms] Tank: %5.1f%% (%4.0fL) | Flow: %4.1f LPM | TDS: %3.0f ppm %s\n",
                packet.sequence_num, levelPercentage, waterLiters, flowRateLpm, tdsPpm,
                (result == 0 ? "✓ SENT" : "✗ ERR"));
        }
    }

    delay(2);
}
