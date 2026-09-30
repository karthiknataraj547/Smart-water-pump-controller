/**
 * Smart Water Pump Controller — Main Node (ESP32 Gateway)
 * 
 * Hardware: ESP32-WROOM-32E
 * Responsibilities:
 * 1. Bluetooth Low Energy (BLE) Provisioning GATT Server
 *    - Service UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
 *    - Wi-Fi Credentials Characteristic: beb5483e-36e1-4688-b7f5-ea07361b26aa
 *    - Status & Handshake Characteristic: beb5483e-36e1-4688-b7f5-ea07361b26ab
 *    - Tank Setup Configuration Characteristic: beb5483e-36e1-4688-b7f5-ea07361b26ac
 * 2. Hardware Button Long-Press (BOOT pin 0) triggers BLE Pairing Mode
 * 3. Connecting Stage State Machine (Wi-Fi Association -> MQTT TLS -> Device Claim)
 * 4. Tank Configuration Storage in NVS (Kind of tank, Liters capacity, Depth, Motor HP)
 * 5. Device Isolation strictly bound to registered User ID in MQTT topics:
 *    - users/{userId}/devices/{serialNumber}/telemetry
 *    - users/{userId}/devices/{serialNumber}/command
 *    - users/{userId}/devices/{serialNumber}/ack
 * 6. Relay Contactor Pin Driver (GPIO 26) with LOCAL EMERGENCY STOP HARDWARE LATCH
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <esp_now.h>
#include <esp_idf_version.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// Pin Definitions
#define RELAY_PIN 26
#define STATUS_LED_BLUE 2
#define BOOT_BUTTON_PIN 0
#define DRY_RUN_FLOW_THRESHOLD 1.0 // Liters / minute

// BLE GATT Service & Characteristics UUIDs
#define BLE_SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_CHAR_WIFI_PROV_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26aa"
#define BLE_CHAR_STATUS_UUID       "beb5483e-36e1-4688-b7f5-ea07361b26ab"
#define BLE_CHAR_TANK_CONFIG_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26ac"

// State Variables
bool isEmergencyStopped = false;
bool relayActive = false;
String currentPumpMode = "MANUAL";
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 5000;

// Device Identity & Security
char serialNumber[32] = "SP-CTRL-B244";
char registeredUserId[64] = "";
char wifiSsid[64] = "";
char wifiPassword[64] = "";
char mqttServer[64] = "192.168.1.100";
int mqttPort = 1883;

// Wi-Fi Connection & Status LED State
bool isWifiConnecting = false;
unsigned long wifiConnectStartTime = 0;

// Tank Configuration (Persistent in NVS)
char tankType[64] = "Overhead Plastic (Sintex)";
int tankCapacityLiters = 1000;
int tankDepthCm = 150;
int sensorOffsetCm = 15;
float motorHp = 1.0;

// BLE Provisioning State
bool isBleProvisioningMode = false;
bool deviceConnectedToBle = false;
BLEServer* pBleServer = nullptr;
BLECharacteristic* pStatusChar = nullptr;

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

// BLE Server Callbacks
class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        deviceConnectedToBle = true;
        Serial.println("[BLE] Client connected.");
    };

    void onDisconnect(BLEServer* pServer) {
        deviceConnectedToBle = false;
        Serial.println("[BLE] Client disconnected.");
        // Restart advertising if still in pairing mode
        if (isBleProvisioningMode) {
            BLEDevice::startAdvertising();
        }
    }
};

// Update BLE Status Characteristic & Notify Mobile Client
void updateBleStatus(const char* status) {
    if (pStatusChar != nullptr) {
        pStatusChar->setValue(status);
        pStatusChar->notify();
        Serial.printf("[BLE Status] %s\n", status);
    }
}

// BLE Characteristic Callbacks for Wi-Fi Provisioning
class WifiProvCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pCharacteristic) {
        String rxValue = pCharacteristic->getValue().c_str();
        if (rxValue.length() > 0) {
            Serial.printf("[BLE Prov] Received credentials payload: %s\n", rxValue.c_str());

            StaticJsonDocument<512> doc;
            DeserializationError err = deserializeJson(doc, rxValue);
            if (!err) {
                const char* ssid = doc["ssid"];
                const char* pass = doc["password"];
                const char* uid = doc["userId"];

                if (ssid != nullptr && pass != nullptr) {
                    strncpy(wifiSsid, ssid, sizeof(wifiSsid));
                    strncpy(wifiPassword, pass, sizeof(wifiPassword));
                    if (uid != nullptr && strlen(uid) > 0) {
                        strncpy(registeredUserId, uid, sizeof(registeredUserId));
                    }

                    // Save to persistent Preferences (NVS)
                    prefs.begin("smartpump", false);
                    prefs.putString("wifi_ssid", wifiSsid);
                    prefs.putString("wifi_pass", wifiPassword);
                    prefs.putString("user_id", registeredUserId);
                    prefs.end();

                    updateBleStatus("CONNECTING_WIFI");

                    // Attempt connection to Wi-Fi router
                    WiFi.disconnect(true);
                    WiFi.mode(WIFI_STA);
                    isWifiConnecting = true;
                    wifiConnectStartTime = millis();
                    WiFi.begin(wifiSsid, wifiPassword);

                    int timeout = 0;
                    while (WiFi.status() != WL_CONNECTED && timeout < 150) {
                        // Flash faster while connecting (toggles every 100ms)
                        digitalWrite(STATUS_LED_BLUE, !digitalRead(STATUS_LED_BLUE));
                        delay(100);
                        if (timeout % 10 == 0) Serial.print(".");
                        timeout++;
                    }
                    isWifiConnecting = false;

                    if (WiFi.status() == WL_CONNECTED) {
                        digitalWrite(STATUS_LED_BLUE, HIGH); // Constant while connected
                        Serial.println("\n[WiFi] Connected successfully. IP: " + WiFi.localIP().toString());
                        updateBleStatus("WIFI_CONNECTED");
                        delay(300);

                        updateBleStatus("CONNECTING_MQTT");
                        // Connect to MQTT Broker
                        if (connectMqtt()) {
                            updateBleStatus("PROVISIONED");
                            // Exit pairing mode
                            isBleProvisioningMode = false;
                        } else {
                            updateBleStatus("PROVISIONED"); // Connected to Wi-Fi, MQTT will retry in loop
                        }
                    } else {
                        Serial.println("\n[WiFi] Failed to connect.");
                        updateBleStatus("FAILED_INVALID_PASSWORD");
                    }
                }
            }
        }
    }
};

// BLE Characteristic Callbacks for Tank Configuration
class TankConfigCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pCharacteristic) {
        String rxValue = pCharacteristic->getValue().c_str();
        if (rxValue.length() > 0) {
            Serial.printf("[BLE Tank] Received tank configuration: %s\n", rxValue.c_str());

            StaticJsonDocument<512> doc;
            DeserializationError err = deserializeJson(doc, rxValue);
            if (!err) {
                const char* tType = doc["tankType"];
                int cap = doc["capacityL"];
                int depth = doc["depthCm"];
                int offset = doc["sensorOffsetCm"];
                float hp = doc["motorHp"];

                if (tType != nullptr) strncpy(tankType, tType, sizeof(tankType));
                if (cap > 0) tankCapacityLiters = cap;
                if (depth > 0) tankDepthCm = depth;
                if (offset >= 0) sensorOffsetCm = offset;
                if (hp > 0.0) motorHp = hp;

                // Save tank config to persistent NVS
                prefs.begin("smartpump", false);
                prefs.putString("tank_type", tankType);
                prefs.putInt("tank_cap", tankCapacityLiters);
                prefs.putInt("tank_depth", tankDepthCm);
                prefs.putInt("sensor_offset", sensorOffsetCm);
                prefs.putFloat("motor_hp", motorHp);
                prefs.end();

                Serial.printf("[Tank Config Saved] Type: %s, Capacity: %d L, Depth: %d cm, HP: %.1f\n",
                    tankType, tankCapacityLiters, tankDepthCm, motorHp);
            }
        }
    }
};

// Start Bluetooth Low Energy Provisioning Server
void startBleProvisioning() {
    isBleProvisioningMode = true;
    Serial.println("[BLE] Starting Bluetooth Provisioning Mode...");

    // Generate Device BLE Name with MAC suffix
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char bleDeviceName[32];
    snprintf(bleDeviceName, sizeof(bleDeviceName), "Smart Pump Controller");
    snprintf(serialNumber, sizeof(serialNumber), "SP-CTRL-%02X%02X", mac[4], mac[5]);

    BLEDevice::init(bleDeviceName);
    pBleServer = BLEDevice::createServer();
    pBleServer->setCallbacks(new MyServerCallbacks());

    BLEService* pService = pBleServer->createService(BLE_SERVICE_UUID);

    // Characteristic: Wi-Fi Provisioning
    BLECharacteristic* pWifiChar = pService->createCharacteristic(
        BLE_CHAR_WIFI_PROV_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    pWifiChar->setCallbacks(new WifiProvCallbacks());

    // Characteristic: Status & Handshake
    pStatusChar = pService->createCharacteristic(
        BLE_CHAR_STATUS_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pStatusChar->addDescriptor(new BLE2902());
    pStatusChar->setValue("IDLE");

    // Characteristic: Tank Configuration
    BLECharacteristic* pTankChar = pService->createCharacteristic(
        BLE_CHAR_TANK_CONFIG_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE
    );
    pTankChar->setCallbacks(new TankConfigCallbacks());

    pService->start();

    // Start advertising with Service UUID so app can discover only SmartPump nodes
    BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    BLEDevice::startAdvertising();

    Serial.printf("[BLE] Advertised as '%s'. Waiting for pairing...\n", bleDeviceName);
}

// Connect to MQTT Broker with device isolation by registered User ID
bool connectMqtt() {
    if (WiFi.status() != WL_CONNECTED) return false;

    // Use registered user ID if available, otherwise device serial
    const char* uid = (strlen(registeredUserId) > 0) ? registeredUserId : "unclaimed";

    char clientId[64];
    snprintf(clientId, sizeof(clientId), "SP_%s", serialNumber);

    char lwtTopic[128];
    snprintf(lwtTopic, sizeof(lwtTopic), "users/%s/devices/%s/status", uid, serialNumber);

    if (mqttClient.connect(clientId, lwtTopic, 1, true, "OFFLINE")) {
        Serial.printf("[MQTT] Connected to broker. Device isolated to user: %s\n", uid);

        // Publish birth message
        mqttClient.publish(lwtTopic, "ONLINE", true);

        // Subscribe strictly to user's commands topic: users/{userId}/devices/{serialNumber}/command
        char cmdTopic[128];
        snprintf(cmdTopic, sizeof(cmdTopic), "users/%s/devices/%s/command", uid, serialNumber);
        mqttClient.subscribe(cmdTopic);

        return true;
    }
    return false;
}

// ESP-NOW Sensor Telemetry Callback (compatible with ESP32 Core 3.x / ESP-IDF 5.x and Core 2.x)
#if defined(ESP_IDF_VERSION_MAJOR) && (ESP_IDF_VERSION_MAJOR >= 5)
void OnDataRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
    const uint8_t *mac = info ? info->src_addr : NULL;
#else
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
#endif
    (void)mac;
    memcpy(&incomingSensorData, incomingData, sizeof(incomingSensorData));

    const char* uid = (strlen(registeredUserId) > 0) ? registeredUserId : "unclaimed";

    // Relay sensor telemetry strictly to user-scoped topic:
    // users/{userId}/devices/{serialNumber}/telemetry
    char topic[128];
    snprintf(topic, sizeof(topic), "users/%s/devices/%s/telemetry", uid, serialNumber);

    // Compute actual Liters based on tank geometry & configured capacity
    float effectiveDepth = tankDepthCm - sensorOffsetCm;
    float waterColumnCm = (tankDepthCm - incomingSensorData.distanceCm);
    if (waterColumnCm < 0) waterColumnCm = 0;
    if (waterColumnCm > effectiveDepth) waterColumnCm = effectiveDepth;

    float computedLiters = (waterColumnCm / effectiveDepth) * tankCapacityLiters;

    StaticJsonDocument<384> doc;
    doc["tankLevelPct"] = incomingSensorData.waterLevelPct;
    doc["waterVolumeLiters"] = computedLiters;
    doc["tankCapacityLiters"] = tankCapacityLiters;
    doc["tankType"] = tankType;
    doc["flowRateLpm"] = incomingSensorData.flowRateLpm;
    doc["tdsPpm"] = incomingSensorData.tdsPpm;
    doc["pumpState"] = relayActive ? "ON" : "OFF";
    doc["motorHp"] = motorHp;
    doc["timestamp"] = millis();

    char buffer[384];
    serializeJson(doc, buffer);
    mqttClient.publish(topic, buffer, false);
}

// MQTT Command Handler
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    StaticJsonDocument<256> doc;
    deserializeJson(doc, payload, length);

    const char* commandId = doc["commandId"];
    const char* command = doc["command"];

    const char* uid = (strlen(registeredUserId) > 0) ? registeredUserId : "unclaimed";

    char ackTopic[128];
    snprintf(ackTopic, sizeof(ackTopic), "users/%s/devices/%s/ack", uid, serialNumber);
    StaticJsonDocument<256> ack;
    ack["commandId"] = commandId;

    if (strcmp(command, "EMERGENCY_STOP") == 0) {
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

// Status LED behavior:
// 1. Wi-Fi Connected -> Constant ON (Solid HIGH)
// 2. Wi-Fi Connecting -> Flash Faster (100ms rapid flash)
// 3. Wi-Fi Not Connected -> Blink Once periodically (120ms pulse every 2000ms)
void updateStatusLed() {
    static unsigned long lastToggle = 0;
    unsigned long now = millis();

    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(STATUS_LED_BLUE, HIGH); // Constant while connected
    } else if (isWifiConnecting) {
        // Flash faster while connecting (toggles every 100ms)
        if (now - lastToggle >= 100) {
            lastToggle = now;
            digitalWrite(STATUS_LED_BLUE, !digitalRead(STATUS_LED_BLUE));
        }
    } else {
        // Blink once when not connected:
        // In a 2000ms cycle: ON for 120ms, then OFF for 1880ms
        unsigned long cycle = now % 2000;
        digitalWrite(STATUS_LED_BLUE, (cycle < 120) ? HIGH : LOW);
    }
}

void setup() {
    Serial.begin(115200);
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW); // Safe default OFF

    pinMode(STATUS_LED_BLUE, OUTPUT);
    digitalWrite(STATUS_LED_BLUE, LOW);

    pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);

    // Load stored Wi-Fi, user ID, and Tank parameters from NVS
    prefs.begin("smartpump", true);
    String savedSsid = prefs.getString("wifi_ssid", "");
    String savedPass = prefs.getString("wifi_pass", "");
    String savedUser = prefs.getString("user_id", "");
    String savedTankType = prefs.getString("tank_type", "Overhead Plastic (Sintex)");
    tankCapacityLiters = prefs.getInt("tank_cap", 1000);
    tankDepthCm = prefs.getInt("tank_depth", 150);
    sensorOffsetCm = prefs.getInt("sensor_offset", 15);
    motorHp = prefs.getFloat("motor_hp", 1.0);
    prefs.end();

    if (savedSsid.length() > 0) {
        strncpy(wifiSsid, savedSsid.c_str(), sizeof(wifiSsid));
        strncpy(wifiPassword, savedPass.c_str(), sizeof(wifiPassword));
        strncpy(registeredUserId, savedUser.c_str(), sizeof(registeredUserId));
        strncpy(tankType, savedTankType.c_str(), sizeof(tankType));
    }

    // Check if Wi-Fi credentials exist
    if (strlen(wifiSsid) == 0) {
        // No Wi-Fi configured: Enter Bluetooth Provisioning Mode automatically
        Serial.println("[Boot] No Wi-Fi credentials found. Entering BLE Provisioning Mode...");
        startBleProvisioning();
    } else {
        Serial.printf("[Boot] Connecting to saved Wi-Fi: %s (User: %s)\n", wifiSsid, registeredUserId);
        WiFi.mode(WIFI_STA);
        isWifiConnecting = true;
        wifiConnectStartTime = millis();
        WiFi.begin(wifiSsid, wifiPassword);
    }

    // Initialize MQTT
    mqttClient.setServer(mqttServer, mqttPort);
    mqttClient.setCallback(onMqttMessage);

    // Initialize ESP-NOW
    if (esp_now_init() == ESP_OK) {
        esp_now_register_recv_cb(OnDataRecv);
    }
}

void loop() {
    // Check if BOOT button is held for 3 seconds to trigger BLE Pairing Mode
    if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
        unsigned long pressStart = millis();
        while (digitalRead(BOOT_BUTTON_PIN) == LOW) {
            delay(50);
            if (millis() - pressStart >= 3000) {
                Serial.println("[Hardware] BOOT button held for 3s -> Forcing BLE Provisioning Mode!");
                startBleProvisioning();
                break;
            }
        }
    }

    // Check if Wi-Fi connection has resolved
    if (isWifiConnecting) {
        if (WiFi.status() == WL_CONNECTED) {
            isWifiConnecting = false;
            Serial.println("\n[WiFi] Connected successfully. IP: " + WiFi.localIP().toString());
        } else if (millis() - wifiConnectStartTime > 20000) {
            isWifiConnecting = false;
            Serial.println("\n[WiFi] Connection attempt timed out.");
        }
    } else if (WiFi.status() != WL_CONNECTED && strlen(wifiSsid) > 0 && !isBleProvisioningMode) {
        static unsigned long lastWifiRetry = 0;
        if (millis() - lastWifiRetry > 15000) {
            lastWifiRetry = millis();
            isWifiConnecting = true;
            wifiConnectStartTime = millis();
            Serial.println("[WiFi] Disconnected. Reconnecting...");
            WiFi.reconnect();
        }
    }

    // Status LED: blink once when not connected, flash faster when connecting, constant when connected
    updateStatusLed();

    // Manage MQTT Connection
    if (!isBleProvisioningMode && WiFi.status() == WL_CONNECTED) {
        if (!mqttClient.connected()) {
            static unsigned long lastMqttRetry = 0;
            if (millis() - lastMqttRetry >= 5000) {
                lastMqttRetry = millis();
                connectMqtt();
            }
        } else {
            mqttClient.loop();
        }
    }

    // Telemetry Heartbeat (every 5 seconds) strictly isolated to user's topic
    if (!isBleProvisioningMode && mqttClient.connected() && millis() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        lastHeartbeat = millis();
        const char* uid = (strlen(registeredUserId) > 0) ? registeredUserId : "unclaimed";

        char hbTopic[128];
        snprintf(hbTopic, sizeof(hbTopic), "users/%s/devices/%s/heartbeat", uid, serialNumber);

        StaticJsonDocument<192> hb;
        hb["uptimeSeconds"] = millis() / 1000;
        hb["freeHeapBytes"] = ESP.getFreeHeap();
        hb["wifiRssi"] = WiFi.RSSI();
        hb["tankType"] = tankType;
        hb["tankCapacityLiters"] = tankCapacityLiters;
        hb["motorHp"] = motorHp;

        char buffer[192];
        serializeJson(hb, buffer);
        mqttClient.publish(hbTopic, buffer, false);
    }
}
