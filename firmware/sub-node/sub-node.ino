/**
 * Smart Water Pump Controller — Sub Node (Tank & Flow Sensor Pod)
 * 
 * Hardware: ESP8266 or ESP32-C3
 * Sensors:
 * - JSN-SR04T Waterproof Ultrasonic Sensor (Trig: D5, Echo: D6)
 * - YF-S201 Hall Effect Flow Sensor (Interrupt: D2)
 * - Analog TDS Sensor (A0)
 * - Battery Voltage Divider (A0 / Multiplexed)
 * 
 * Protocol: ESP-NOW peer-to-peer broadcast to Main Node MAC
 */

#include <ESP8266WiFi.h>
#include <espnow.h>

#define TRIG_PIN 14 // D5
#define ECHO_PIN 12 // D6
#define FLOW_PIN 4  // D2

uint8_t mainNodeBroadcastAddress[] = {0x24, 0x6F, 0x28, 0xB2, 0x44, 0x90};

typedef struct struct_subnode_data {
    char subNodeId[16];
    float distanceCm;
    float waterLevelPct;
    float flowRateLpm;
    float tdsPpm;
    float batteryVoltage;
} struct_subnode_data;

struct_subnode_data sensorPacket;

volatile int pulseCount = 0;
void IRAM_ATTR pulseCounter() {
    pulseCount++;
}

float measureDistanceCm() {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long duration = pulseIn(ECHO_PIN, HIGH, 30000);
    if (duration == 0) return -1;
    return (duration * 0.0343) / 2.0;
}

void setup() {
    Serial.begin(115200);
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    pinMode(FLOW_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, RISING);

    WiFi.mode(WIFI_STA);
    WiFi.disconnect();

    if (esp_now_init() != 0) {
        Serial.println("ESP-NOW Init Failed");
        return;
    }

    esp_now_set_self_role(ESP_NOW_ROLE_CONTROLLER);
    esp_now_add_peer(mainNodeBroadcastAddress, ESP_NOW_ROLE_SLAVE, 1, NULL, 0);

    strncpy(sensorPacket.subNodeId, "SUB_TANK_01", sizeof(sensorPacket.subNodeId));
}

void loop() {
    // 1. Measure Distance & compute tank percentage (Assuming 200cm tank depth)
    float dist = measureDistanceCm();
    if (dist > 0) {
        sensorPacket.distanceCm = dist;
        float tankHeight = 200.0;
        sensorPacket.waterLevelPct = constrain(((tankHeight - dist) / tankHeight) * 100.0, 0.0, 100.0);
    }

    // 2. Measure Flow (Pulses / 7.5 = LPM for YF-S201)
    sensorPacket.flowRateLpm = ((float)pulseCount / 7.5);
    pulseCount = 0;

    // 3. Measure TDS & Battery
    int rawAnalog = analogRead(A0);
    sensorPacket.tdsPpm = (rawAnalog / 1024.0) * 1000.0;
    sensorPacket.batteryVoltage = 3.9;

    // 4. Send packet via ESP-NOW
    esp_now_send(mainNodeBroadcastAddress, (uint8_t *) &sensorPacket, sizeof(sensorPacket));

    delay(1000); // 1-second transmission interval
}
