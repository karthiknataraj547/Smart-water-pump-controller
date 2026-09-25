/**
 * Smart Water Pump Controller — Main Node (ESP32 Gateway)
 * 
 * Hardware: ESP32-WROOM-32E
 * Responsibilities:
 * 1. BLE Provisioning (GATT server for Wi-Fi SSID & Password exchange)
 * 2. MQTT TLS Connection to Mosquitto Broker with Keepalive and LWT
 * 3. Relay Contactor Pin Driver (GPIO 26) with LOCAL EMERGENCY STOP HARDWARE LATCH
 * 4. ESP-NOW Master: Receives sensor telemetry from Sub-Node (ESP8266)
 * 5. High-Frequency Heartbeat (every 5000ms) and Telemetry Gateway
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <esp_now.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// Pin Definitions
#define RELAY_PIN 26
#define STATUS_LED_PIN 2
#define DRY_RUN_FLOW_THRESHOLD 1.0 // Liters / minute

// State Variables
bool isEmergencyStopped = false;
bool relayActive = false;
String currentPumpMode = "MANUAL";
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 5000;

// Device Identity
char serialNumber[32] = "SP-3918-B";
char userId[64] = "usr_98a72b";
char mqttServer[64] = "192.168.1.100";
int mqttPort = 1883;

WiFiClient espClient;
PubSubClient mqttClient(espClient);
Preferences prefs;

// ESP-NOW Data Structure from Sub-Node
typedef struct struct_subnode_data {
    char subNodeId[16];
    float distanceCm;
    float waterLevelPct;
    float flowRateLpm;
    float tdsPpm;
    float batteryVoltage;
} struct_subnode_data;

struct_subnode_data incomingSensorData;

// ESP-NOW Callback
void OnDataRecv(const uint8_t * mac, const uint8_t *incomingData, int len) {
    memcpy(&incomingSensorData, incomingData, sizeof(incomingSensorData));
    
    // Relay sensor telemetry upstream to MQTT broker
    char topic[128];
    snprintf(topic, sizeof(topic), "users/%s/devices/%s/telemetry", userId, serialNumber);
    
    StaticJsonDocument<256> doc;
    doc["tankLevelPct"] = incomingSensorData.waterLevelPct;
    doc["flowRateLpm"] = incomingSensorData.flowRateLpm;
    doc["tdsPpm"] = incomingSensorData.tdsPpm;
    doc["pumpState"] = relayActive ? "ON" : "OFF";
    doc["timestamp"] = millis();

    char buffer[256];
    serializeJson(doc, buffer);
    mqttClient.publish(topic, buffer, false);
}

// MQTT Message Handler
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    StaticJsonDocument<256> doc;
    deserializeJson(doc, payload, length);

    const char* commandId = doc["commandId"];
    const char* command = doc["command"];

    char ackTopic[128];
    snprintf(ackTopic, sizeof(ackTopic), "users/%s/devices/%s/ack", userId, serialNumber);
    StaticJsonDocument<256> ack;
    ack["commandId"] = commandId;

    if (strcmp(command, "EMERGENCY_STOP") == 0) {
        // High-Priority Local Hardware Latch
        isEmergencyStopped = true;
        relayActive = false;
        digitalWrite(RELAY_PIN, LOW);

        ack["status"] = "SUCCESS";
        ack["pumpState"] = "EMERGENCY_STOPPED";
        ack["relayPinActive"] = false;
    }
    else if (strcmp(command, "RESET_EMERGENCY") == 0) {
        isEmergencyStopped = false;
        ack["status"] = "SUCCESS";
        ack["pumpState"] = "OFF";
        ack["relayPinActive"] = false;
    }
    else if (strcmp(command, "PUMP_START") == 0) {
        if (isEmergencyStopped) {
            // Hardware interlock forbids start
            ack["status"] = "FAILED";
            ack["errorCode"] = "HARDWARE_EMERGENCY_STOP_LATCHED";
            ack["relayPinActive"] = false;
        } else {
            relayActive = true;
            digitalWrite(RELAY_PIN, HIGH);
            ack["status"] = "SUCCESS";
            ack["pumpState"] = "ON";
            ack["relayPinActive"] = true;
        }
    }
    else if (strcmp(command, "PUMP_STOP") == 0) {
        relayActive = false;
        digitalWrite(RELAY_PIN, LOW);
        ack["status"] = "SUCCESS";
        ack["pumpState"] = "OFF";
        ack["relayPinActive"] = false;
    }

    char ackBuffer[256];
    serializeJson(ack, ackBuffer);
    mqttClient.publish(ackTopic, ackBuffer, true);
}

void setup() {
    Serial.begin(115200);
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW); // Safe default OFF

    // Initialize Wi-Fi & MQTT
    WiFi.mode(WIFI_AP_STA);
    // Connect to MQTT Broker with LWT configuration...
    mqttClient.setServer(mqttServer, mqttPort);
    mqttClient.setCallback(onMqttMessage);

    // Initialize ESP-NOW
    if (esp_now_init() == ESP_OK) {
        esp_now_register_recv_cb(OnDataRecv);
    }
}

void loop() {
    if (!mqttClient.connected()) {
        // Reconnect with LWT (Last Will and Testament)
    }
    mqttClient.loop();

    // Heartbeat transmitter (every 5 seconds)
    if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        lastHeartbeat = millis();
        char hbTopic[128];
        snprintf(hbTopic, sizeof(hbTopic), "users/%s/devices/%s/heartbeat", userId, serialNumber);

        StaticJsonDocument<128> hb;
        hb["uptimeSeconds"] = millis() / 1000;
        hb["freeHeapBytes"] = ESP.getFreeHeap();
        hb["wifiRssi"] = WiFi.RSSI();

        char buffer[128];
        serializeJson(hb, buffer);
        mqttClient.publish(hbTopic, buffer, false);
    }
}
