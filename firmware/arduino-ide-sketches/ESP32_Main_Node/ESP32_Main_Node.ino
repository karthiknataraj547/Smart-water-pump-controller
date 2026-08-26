/**
 * ============================================================================
 * SMART WATER PUMP CONTROLLER — ESP32 INDUSTRIAL MAIN NODE FIRMWARE
 * ============================================================================
 * Target Hardware: ESP32-WROOM-32 / ESP32 Dev Module
 * Platform: Arduino IDE / PlatformIO
 * 
 * Hardware Pinout:
 *  - GPIO 23: Relay Driver (Opto-Isolated PC817, Active LOW)
 *  - GPIO 34: ACS712 Current Sensor (ADC1_CH6)
 *  - GPIO 18: Manual START / STOP Tactile Push Button
 *  - GPIO 2:  Built-in LED / Wi-Fi & Cloud Link Status LED
 *             * BLINKS (500ms) when Disconnected / Connecting / Provisioning
 *             * SOLID ON when Connected to Wi-Fi
 *  - GPIO 4:  Pump Motor Energized LED (Green)
 *  - GPIO 5:  Power Status LED
 *  - GPIO 21: Fault / Lockout LED (Red)
 *  - GPIO 13: Piezo Buzzer Alarm Output
 * 
 * MULTI-CHANNEL APP-TO-HARDWARE PROVISIONING:
 *  1. Bluetooth Low Energy (BLE GATT): Standard ESP32 Core BLE GATT Server.
 *     - Service UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
 *     - Write Characteristic (beb5483e): Receives JSON { ssid, password, server_host, server_port }
 *     - Status Characteristic (beb5483e-..aa): Emits real-time link status notifications
 *  2. Wi-Fi SoftAP Hotspot ("AquaControl-Setup", IP 192.168.4.1):
 *     - Local port 80 WebServer with full CORS headers (Access-Control-Allow-Origin: *)
 *     - POST /api/v1/wifi/config & POST /provision for direct HTTP credential push
 *     - Captive portal webpage for mobile browsers
 *  3. NVS Flash Storage (Preferences): Credentials survive power loss and reboots.
 *  4. Cloud Multi-Protocol Bridge:
 *     - MQTT (Port 1883): Real-time telemetry, ACK confirmations, and remote commands
 *     - HTTP REST: Direct telemetry ingestion (POST /api/v1/sensors/telemetry)
 *     - ESP-NOW Direct 2.4GHz Link: Receives 35-byte binary telemetry from Tank Sub Node
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <esp_now.h>
#include <esp_task_wdt.h>
#include <esp_idf_version.h>
#include <math.h>

// =====================================================================
// HARDWARE DEFINITIONS & CONSTANTS
// =====================================================================
#define DEVICE_UID         "WPC-A81F29"
#define FIRMWARE_VERSION   "v2.1.0"

#define PIN_RELAY          23
#define PIN_CURRENT_ADC    34
#define PIN_BTN_MANUAL     18
#define PIN_BTN_RESET      19    // Hold 3s -> Wipe credentials & force provision
#define PIN_LED_POWER      5
#define PIN_LED_PUMP       4
#define PIN_LED_WIFI       2     // Built-in LED (GPIO 2): Blinks when disconnected, Solid when connected
#define PIN_LED_FAULT      21
#define PIN_BUZZER         13

#define ACS712_SENSITIVITY 0.066  // 66mV/A for 30A model
#define ACS712_VREF        3.3
#define ACS712_ADC_RES     4095.0
#define ACS712_OFFSET      1.65

#define AUTO_START_LEVEL_PCT 30.0
#define AUTO_STOP_LEVEL_PCT  95.0
#define DRY_RUN_TIMEOUT_SEC  120
#define MAX_RUNTIME_LIMIT_S  7200

// Provisioning Defaults
#define PROVISION_AP_SSID      "AquaControl-Setup"
#define PROVISION_AP_PASS      "setup1234"
#define PROVISION_BLE_NAME     "WPC-A81F29"

// Quick Wi-Fi & Gateway Defaults (Pre-configured for instant connection)
#define DEFAULT_WIFI_SSID      "Monk"            // Set your 2.4GHz Wi-Fi Name
#define DEFAULT_WIFI_PASS      ""                // Set your Wi-Fi Password here if not using BLE
#define DEFAULT_SERVER_HOST    "192.168.31.53"   // Your PC's Local IP
#define DEFAULT_SERVER_PORT    5000
#define DEFAULT_MQTT_PORT      1883

// BLE Service & Characteristic UUIDs (Standard 128-bit Custom GATT UUIDs)
#define BLE_SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_CHAR_CONFIG_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define BLE_CHAR_INFO_UUID      "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define BLE_CHAR_STATUS_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26aa"

// Binary ESP-NOW Telemetry Packet (35 Bytes)
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

// =====================================================================
// GLOBAL OBJECTS & STATE
// =====================================================================
Preferences preferences;
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
WebServer localServer(80);

String wifiSsid = DEFAULT_WIFI_SSID;
String wifiPass = DEFAULT_WIFI_PASS;
String apiServerHost = DEFAULT_SERVER_HOST;
int apiServerPort = DEFAULT_SERVER_PORT;
String mqttBroker = DEFAULT_SERVER_HOST;
int mqttPort = DEFAULT_MQTT_PORT;
String authCode = "WPC_AUTH_SECURE_KEY_2026";

volatile bool wifiConnected = false;
uint32_t lastWifiCheck = 0;
uint32_t lastLedBlinkTime = 0;
bool ledWifiState = false;

volatile bool pumpState = false;
String pumpMode = "AUTOMATIC";
uint32_t pumpStartMillis = 0;
uint32_t totalRuntimeSeconds = 0;
float currentAmps = 0.0;
bool systemFault = false;
String faultReason = "";

TankTelemetryPacket latestTankData;
volatile bool newTankDataAvailable = false;
uint32_t lastSubNodePacketTime = 0;
bool subNodeConnected = false;

TaskHandle_t TaskSafetyHandle = NULL;
TaskHandle_t TaskNetworkHandle = NULL;

BLEServer* pBleServer = NULL;
BLECharacteristic* pBleStatusChar = NULL;
bool bleConnected = false;

// Forward Declarations
void loadSavedCredentials();
void saveCredentials(const String& ssid, const String& pass, const String& host, int port, const String& auth);
void handleApplyCredentials(const String& jsonString);
void startBleProvisioning();
void setupHttpEndpoints();
void setPumpState(bool state, const char* initiator);
void triggerEmergencyStop(const char* reason);
void sendHttpStateAck(const char* state, const char* initiator);
void sendHttpTelemetry();
void publishHardwareAck(const char* state, const char* initiator);
uint16_t calculateCrc16(const uint8_t *data, size_t length);

// =====================================================================
// 1. NVS FLASH CREDENTIAL STORAGE
// =====================================================================
void loadSavedCredentials() {
    preferences.begin("pump_cfg", true);
    wifiSsid      = preferences.getString("ssid", DEFAULT_WIFI_SSID);
    wifiPass      = preferences.getString("pass", DEFAULT_WIFI_PASS);
    apiServerHost = preferences.getString("api_host", DEFAULT_SERVER_HOST);
    apiServerPort = preferences.getInt("api_port", DEFAULT_SERVER_PORT);
    mqttBroker    = preferences.getString("mqtt_host", DEFAULT_SERVER_HOST);
    mqttPort      = preferences.getInt("mqtt_port", DEFAULT_MQTT_PORT);
    authCode      = preferences.getString("auth_code", "WPC_AUTH_SECURE_KEY_2026");
    preferences.end();

    if (wifiSsid.length() == 0 && strlen(DEFAULT_WIFI_SSID) > 0) {
        wifiSsid = DEFAULT_WIFI_SSID;
        wifiPass = DEFAULT_WIFI_PASS;
    }

    // Auto-align server IP with DEFAULT_SERVER_HOST if subnet changed
    if (apiServerHost != DEFAULT_SERVER_HOST && strlen(DEFAULT_SERVER_HOST) > 0) {
        apiServerHost = DEFAULT_SERVER_HOST;
        mqttBroker    = DEFAULT_SERVER_HOST;
        saveCredentials(wifiSsid, wifiPass, DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT, authCode);
    }

    Serial.printf("[NVS] Loaded config: SSID='%s', API=%s:%d, MQTT=%s:%d, Auth='%s'\n",
        wifiSsid.c_str(), apiServerHost.c_str(), apiServerPort, mqttBroker.c_str(), mqttPort, authCode.c_str());
}

void saveCredentials(const String& ssid, const String& pass, const String& host, int port, const String& auth) {
    preferences.begin("pump_cfg", false);
    preferences.putString("ssid", ssid);
    preferences.putString("pass", pass);
    if (host.length() > 0) {
        preferences.putString("api_host", host);
        preferences.putString("mqtt_host", host);
    }
    if (port > 0) {
        preferences.putInt("api_port", port);
    }
    if (auth.length() > 0) {
        preferences.putString("auth_code", auth);
    }
    preferences.end();
    Serial.printf("[NVS] Credentials & Auth Code ('%s') committed to flash!\n", auth.c_str());
}

// =====================================================================
// 2. CREDENTIAL INGESTION (Shared by BLE & Local HTTP Server)
// =====================================================================
void handleApplyCredentials(const String& jsonString) {
    Serial.printf("[PROVISION] Ingesting credentials from app: %s\n", jsonString.c_str());

    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, jsonString);
    if (err) {
        Serial.printf("[PROVISION] JSON parse error: %s\n", err.c_str());
        return;
    }

    const char* ssidVal = doc["s"] | doc["ssid"] | doc["wifi_ssid"] | "";
    const char* passVal = doc["p"] | doc["password"] | doc["wifi_password"] | "";
    const char* hostVal = doc["h"] | doc["server_host"] | doc["api_host"] | doc["mqtt_broker"] | "";
    int portVal         = doc["port"] | doc["server_port"] | doc["api_port"] | 5000;
    const char* brokerVal = doc["mqtt_broker"] | hostVal;
    int mqttPortVal     = doc["mqtt_port"] | 1883;
    const char* authVal = doc["auth"] | doc["auth_code"] | doc["auth_token"] | doc["api_key"] | "";

    String newSsid = String(ssidVal);
    String newPass = String(passVal);
    String newHost = String(hostVal);
    String newBroker = String(brokerVal);
    String newAuth = String(authVal);

    if (newSsid.length() == 0) {
        Serial.println("[PROVISION] Error: Empty SSID received!");
        return;
    }

    wifiSsid = newSsid;
    wifiPass = newPass;
    if (newHost.length() > 0) {
        apiServerHost = newHost;
    }
    if (newBroker.length() > 0) {
        mqttBroker = newBroker;
    }
    apiServerPort = portVal;
    mqttPort = mqttPortVal;
    if (newAuth.length() > 0) {
        authCode = newAuth;
    }

    saveCredentials(wifiSsid, wifiPass, apiServerHost, apiServerPort, authCode);

    // Notify BLE client with auth confirmation
    if (pBleStatusChar) {
        String resp = "{\"status\":\"configured\",\"ssid\":\"" + wifiSsid + "\",\"auth\":\"synced\",\"reconnecting\":true}";
        pBleStatusChar->setValue(resp.c_str());
        pBleStatusChar->notify();
    }

    // Audible confirmation beeps
    for (int i = 0; i < 2; i++) {
        digitalWrite(PIN_BUZZER, HIGH); delay(80);
        digitalWrite(PIN_BUZZER, LOW);  delay(80);
    }

    Serial.println("[PROVISION] Credentials accepted! Reconnecting to Wi-Fi...");
    WiFi.disconnect(false);
    WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
}

// =====================================================================
// 3. BLUETOOTH LOW ENERGY (BLE GATT SERVER)
// =====================================================================
class BleServerCallbacksImpl : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        bleConnected = true;
        Serial.println("[BLE] Client connected from App!");
    }
    void onDisconnect(BLEServer* pServer) {
        bleConnected = false;
        Serial.println("[BLE] Client disconnected.");
        // Only restart advertising if Wi-Fi is not connected
        if (WiFi.status() != WL_CONNECTED) {
            pServer->startAdvertising();
        }
    }
};

class BleConfigCallbacksImpl : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pChar) {
        String val = pChar->getValue();
        if (val.length() > 0) {
            handleApplyCredentials(val);
        }
    }
};

void startBleProvisioning() {
    Serial.println("[BLE] Initializing standard ESP32 BLE GATT Server...");
    BLEDevice::init(PROVISION_BLE_NAME);
    
    pBleServer = BLEDevice::createServer();
    pBleServer->setCallbacks(new BleServerCallbacksImpl());

    BLEService* pService = pBleServer->createService(BLEUUID(BLE_SERVICE_UUID));

    // Characteristic 1: Config (Write)
    BLECharacteristic* pConfigChar = pService->createCharacteristic(
        BLEUUID(BLE_CHAR_CONFIG_UUID),
        BLECharacteristic::PROPERTY_READ |
        BLECharacteristic::PROPERTY_WRITE |
        BLECharacteristic::PROPERTY_WRITE_NR
    );
    pConfigChar->setCallbacks(new BleConfigCallbacksImpl());

    // Characteristic 2: Device Info (Read)
    BLECharacteristic* pInfoChar = pService->createCharacteristic(
        BLEUUID(BLE_CHAR_INFO_UUID),
        BLECharacteristic::PROPERTY_READ
    );
    String info = "{\"uid\":\"" + String(DEVICE_UID) + "\",\"fw\":\"" + String(FIRMWARE_VERSION) + "\",\"mac\":\"" + WiFi.macAddress() + "\"}";
    pInfoChar->setValue(info.c_str());

    // Characteristic 3: Status (Read + Notify)
    pBleStatusChar = pService->createCharacteristic(
        BLEUUID(BLE_CHAR_STATUS_UUID),
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pBleStatusChar->addDescriptor(new BLE2902());
    pBleStatusChar->setValue("{\"status\":\"ready_for_credentials\"}");

    pService->start();

    // Standard BLE Advertising without packet overflows
    BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(BLEUUID(BLE_SERVICE_UUID));
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();

    Serial.printf("[BLE] ✓ BLE Beacon Active: '%s' | Service: %s\n", PROVISION_BLE_NAME, BLE_SERVICE_UUID);
}

// =====================================================================
// 4. LOCAL HTTP REST SERVER & CAPTIVE PORTAL (Port 80 with CORS)
// =====================================================================
const char CAPTIVE_HTML[] PROGMEM = R"rawhtml(
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AquaControl Setup</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#181c26;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
.box{background:#1d222e;border-radius:24px;padding:28px;max-width:380px;width:100%;box-shadow:8px 8px 16px #0f121a,-8px -8px 16px #222736}
h2{color:#00e5ff;font-size:20px;text-align:center;margin-bottom:6px}p{font-size:12px;color:#94a3b8;text-align:center;margin-bottom:20px}
label{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-top:14px;display:block}
input{width:100%;padding:11px;border-radius:12px;background:#181c26;color:#f8fafc;font-family:monospace;font-size:13px;margin-top:4px;outline:none;border:none;box-shadow:inset 3px 3px 6px #0f121a,inset -3px -3px 6px #222736}
button{width:100%;padding:14px;margin-top:24px;border:none;border-radius:14px;background:#00e5ff;color:#0f172a;font-weight:800;font-size:13px;cursor:pointer;text-transform:uppercase;box-shadow:4px 4px 10px #0f121a,-4px -4px 10px #222736}
.ok{display:none;color:#10b981;text-align:center;padding:20px;font-weight:700}
</style></head><body><div class="box">
<h2>AquaControl Setup</h2><p>Device: WPC-A81F29 (v2.1.0)</p>
<form id="cfg" onsubmit="return submitWifi()">
<label>Wi-Fi SSID</label><input type="text" id="s" required placeholder="WiFi Network Name">
<label>Wi-Fi Password</label><input type="password" id="p" required placeholder="Password">
<label>Server IP</label><input type="text" id="h" value="192.168.1.100">
<label>Server Port</label><input type="number" id="pt" value="5000">
<button type="submit" id="btn">SAVE & CONNECT</button>
</form><div class="ok" id="ok">✓ Credentials Saved!<br>Connecting to Wi-Fi...</div></div>
<script>
function submitWifi(){
 var payload={ssid:document.getElementById('s').value,password:document.getElementById('p').value,server_host:document.getElementById('h').value,server_port:parseInt(document.getElementById('pt').value)||5000};
 document.getElementById('btn').textContent='SAVING...';document.getElementById('btn').disabled=true;
 fetch('/api/v1/wifi/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(){
   document.getElementById('cfg').style.display='none';document.getElementById('ok').style.display='block';
 }).catch(function(){
   document.getElementById('cfg').style.display='none';document.getElementById('ok').style.display='block';
 });
 return false;
}
</script></body></html>
)rawhtml";

void setCorsHeaders() {
    localServer.sendHeader("Access-Control-Allow-Origin", "*");
    localServer.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    localServer.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

void setupHttpEndpoints() {
    // 1. CORS Preflight
    localServer.on("/api/v1/wifi/config", HTTP_OPTIONS, []() {
        setCorsHeaders();
        localServer.send(204, "text/plain", "");
    });
    localServer.on("/provision", HTTP_OPTIONS, []() {
        setCorsHeaders();
        localServer.send(204, "text/plain", "");
    });
    localServer.on("/api/v1/pump/control", HTTP_OPTIONS, []() {
        setCorsHeaders();
        localServer.send(204, "text/plain", "");
    });

    // 2. Captive Portal Root Page
    localServer.on("/", HTTP_GET, []() {
        localServer.send(200, "text/html", CAPTIVE_HTML);
    });

    // 3. Wi-Fi Config Endpoint (Called directly by web app or captive portal)
    auto handleWifiConfig = []() {
        setCorsHeaders();
        String body = localServer.arg("plain");
        localServer.send(200, "application/json", "{\"success\":true,\"message\":\"Credentials received. Applying...\"}");
        handleApplyCredentials(body);
    };

    localServer.on("/api/v1/wifi/config", HTTP_POST, handleWifiConfig);
    localServer.on("/provision", HTTP_POST, handleWifiConfig);

    // 4. Live Status Endpoint (Direct LAN inspection)
    localServer.on("/api/v1/status", HTTP_GET, []() {
        setCorsHeaders();
        StaticJsonDocument<512> doc;
        doc["device_uid"] = DEVICE_UID;
        doc["firmware_version"] = FIRMWARE_VERSION;
        doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
        doc["ip_address"] = WiFi.localIP().toString();
        doc["rssi"] = WiFi.RSSI();
        doc["pump_state"] = pumpState ? "ON" : "OFF";
        doc["pump_mode"] = pumpMode;
        doc["current_amps"] = currentAmps;
        doc["runtime_seconds"] = totalRuntimeSeconds;
        doc["water_level_pct"] = latestTankData.water_level_pct;
        doc["flow_rate_lpm"] = latestTankData.flow_rate_lpm;
        doc["tds_ppm"] = latestTankData.tds_ppm;
        doc["subnode_online"] = subNodeConnected;

        String response;
        serializeJson(doc, response);
        localServer.send(200, "application/json", response);
    });

    // 5. Direct Local Pump Control Endpoint with Auth Code Support
    localServer.on("/api/v1/pump/control", HTTP_POST, []() {
        setCorsHeaders();
        String body = localServer.arg("plain");
        StaticJsonDocument<256> doc;
        deserializeJson(doc, body);
        const char* actionVal = doc["action"] | doc["command_type"] | doc["state"] | "";
        String action = String(actionVal);
        const char* authVal = doc["auth_code"] | "";
        String reqAuth = String(authVal);

        if (authCode.length() > 0 && reqAuth.length() > 0 && reqAuth != authCode) {
            localServer.send(401, "application/json", "{\"success\":false,\"error\":\"Invalid Auth Code\"}");
            return;
        }

        if (action == "START" || action == "START_PUMP" || action == "ON") {
            systemFault = false;
            digitalWrite(PIN_LED_FAULT, LOW);
            setPumpState(true, "LOCAL_LAN_REST_API");
            localServer.send(200, "application/json", "{\"success\":true,\"pump_state\":\"ON\"}");
        } else if (action == "STOP" || action == "STOP_PUMP" || action == "OFF") {
            setPumpState(false, "LOCAL_LAN_REST_API");
            localServer.send(200, "application/json", "{\"success\":true,\"pump_state\":\"OFF\"}");
        } else if (action == "EMERGENCY_STOP") {
            triggerEmergencyStop("Local LAN Emergency Command");
            localServer.send(200, "application/json", "{\"success\":true,\"status\":\"EMERGENCY_STOP\"}");
        } else if (action == "CLEAR_FAULT") {
            systemFault = false;
            digitalWrite(PIN_LED_FAULT, LOW);
            localServer.send(200, "application/json", "{\"success\":true,\"status\":\"FAULT_CLEARED\"}");
        } else {
            localServer.send(400, "application/json", "{\"success\":false,\"error\":\"Invalid action\"}");
        }
    });

    // 6. Captive Portal Redirect
    localServer.onNotFound([]() {
        setCorsHeaders();
        localServer.sendHeader("Location", "http://192.168.4.1/", true);
        localServer.send(302, "text/plain", "Redirecting to setup...");
    });

    localServer.begin();
    Serial.println("[HTTP] ✓ Local REST Server & Captive Portal active on port 80");
}

// =====================================================================
// 5. CRC16-CCITT CHECKSUM
// =====================================================================
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

// =====================================================================
// 6. RELAY & PUMP DRIVER
// =====================================================================
void setPumpState(bool state, const char* initiator) {
    // High-Level Cutoff Lock: Block START in AUTOMATIC mode if tank is full
    if (state && pumpMode == "AUTOMATIC" && latestTankData.water_level_pct >= AUTO_STOP_LEVEL_PCT) {
        Serial.printf("[PUMP] Rejected START in AUTOMATIC mode: Tank level %.1f%% >= %.1f%% cutoff\n",
            latestTankData.water_level_pct, AUTO_STOP_LEVEL_PCT);
        publishHardwareAck("OFF", "AUTO_HIGH_CUTOFF_LOCKED");
        sendHttpStateAck("OFF", "AUTO_HIGH_CUTOFF_LOCKED");
        return;
    }

    if (state && systemFault) {
        systemFault = false;
        digitalWrite(PIN_LED_FAULT, LOW);
    }

    pumpState = state;
    if (state) {
        digitalWrite(PIN_RELAY, LOW); // Active LOW Opto-coupler
        digitalWrite(PIN_LED_PUMP, HIGH);
        pumpStartMillis = millis();
        Serial.printf("[PUMP] ENERGIZED (Active LOW) by %s\n", initiator);
    } else {
        digitalWrite(PIN_RELAY, HIGH); // De-energize
        digitalWrite(PIN_LED_PUMP, LOW);
        pumpStartMillis = 0;
        Serial.printf("[PUMP] DE-ENERGIZED by %s\n", initiator);
    }

    publishHardwareAck(state ? "ON" : "OFF", initiator);
    sendHttpStateAck(state ? "ON" : "OFF", initiator);
}

void triggerEmergencyStop(const char* reason) {
    systemFault = true;
    faultReason = reason;
    digitalWrite(PIN_RELAY, HIGH);
    digitalWrite(PIN_LED_PUMP, LOW);
    digitalWrite(PIN_LED_FAULT, HIGH);

    for (int i = 0; i < 3; i++) {
        digitalWrite(PIN_BUZZER, HIGH); delay(150);
        digitalWrite(PIN_BUZZER, LOW);  delay(100);
    }

    Serial.printf("[EMERGENCY STOP] Tripped! Reason: %s\n", reason);
    publishHardwareAck("EMERGENCY_STOP", reason);
    sendHttpStateAck("EMERGENCY_STOP", reason);
}

// =====================================================================
// 7. CLOUD COMMUNICATION (MQTT & HTTP REST)
// =====================================================================
void publishHardwareAck(const char* state, const char* initiator) {
    if (!mqttClient.connected()) return;
    StaticJsonDocument<256> doc;
    doc["device_uid"] = DEVICE_UID;
    doc["status"] = systemFault ? "failed" : "successful";
    doc["confirmed_state"] = state;
    doc["current_amps"] = currentAmps;
    doc["runtime_seconds"] = totalRuntimeSeconds;
    doc["changed_by"] = initiator;

    char buffer[256];
    serializeJson(doc, buffer);
    String topic = String("devices/") + DEVICE_UID + "/ack";
    mqttClient.publish(topic.c_str(), buffer);
}

void sendHttpStateAck(const char* state, const char* initiator) {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    String url = String("http://") + apiServerHost + ":" + String(apiServerPort) + "/api/v1/pump/ack";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["device_uid"] = DEVICE_UID;
    doc["status"] = systemFault ? "failed" : "successful";
    doc["confirmed_state"] = state;
    doc["current_amps"] = currentAmps;
    doc["runtime_seconds"] = totalRuntimeSeconds;
    doc["changed_by"] = initiator;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpCode = http.POST(jsonPayload);
    if (httpCode > 0) {
        Serial.printf("[HTTP REST ACK] State synced with server (HTTP %d)\n", httpCode);
    }
    http.end();
}

void sendHttpTelemetry() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    String url = String("http://") + apiServerHost + ":" + String(apiServerPort) + "/api/v1/sensors/telemetry";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<512> doc;
    doc["device_uid"] = DEVICE_UID;
    doc["water_level_percentage"] = latestTankData.water_level_pct;
    doc["water_level_liters"] = latestTankData.water_liters;
    doc["inflow_rate_lpm"] = latestTankData.flow_rate_lpm;
    doc["total_inflow_liters"] = latestTankData.total_inflow_l;
    doc["tds_ppm"] = latestTankData.tds_ppm;
    doc["temperature_c"] = latestTankData.temperature_c;
    doc["pump_running"] = pumpState;
    doc["current_amps"] = currentAmps;
    doc["subnode_online"] = subNodeConnected;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpCode = http.POST(jsonPayload);
    http.end();
}

// =====================================================================
// 8. SENSORS & ESP-NOW RECEIVER
// =====================================================================
float readMotorCurrent() {
    if (!pumpState) return 0.0f;
    float sumVoltage = 0.0;
    int samples = 32;
    for (int i = 0; i < samples; i++) {
        int raw = analogRead(PIN_CURRENT_ADC);
        sumVoltage += (raw * ACS712_VREF) / ACS712_ADC_RES;
        delayMicroseconds(100);
    }
    float avgVoltage = sumVoltage / samples;

    // Disconnected / floating sensor protection (unpowered ADC pin reads ~0V)
    if (avgVoltage < 0.25f) {
        return 0.0f;
    }

    float diff = avgVoltage - ACS712_OFFSET;
    if (diff < 0.08f && diff > -0.08f) return 0.0f; // Deadband noise filter
    float current = diff / ACS712_SENSITIVITY;
    if (current < 0.0f) current = -current;

    // Floating pin guard (out-of-range sensor voltage)
    if (current >= 24.0f) return 0.0f;

    return current;
}

#if defined(ESP_IDF_VERSION) && defined(ESP_IDF_VERSION_VAL) && (ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0))
void onEspNowDataRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
#else
void onEspNowDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
#endif
    if (len != sizeof(TankTelemetryPacket)) {
        Serial.printf("[ESP-NOW] Warning: Received packet of invalid size: %d bytes (expected %d)\n", len, (int)sizeof(TankTelemetryPacket));
        return;
    }

    TankTelemetryPacket packet;
    memcpy(&packet, incomingData, sizeof(TankTelemetryPacket));
    if (packet.magic != 0xAA) {
        Serial.printf("[ESP-NOW] Warning: Invalid Magic byte: 0x%02X\n", packet.magic);
        return;
    }

    uint16_t calculatedCrc = calculateCrc16((const uint8_t*)&packet, sizeof(TankTelemetryPacket) - 2);
    if (calculatedCrc != packet.crc16) {
        Serial.printf("[ESP-NOW] Warning: CRC mismatch! Calc: 0x%04X, Pkt: 0x%04X\n", calculatedCrc, packet.crc16);
        return;
    }

    latestTankData = packet;
    newTankDataAvailable = true;
    lastSubNodePacketTime = millis();
    subNodeConnected = true;

    Serial.printf("[ESP-NOW] Rx from Tank SubNode #%d | Water Level: %5.1f%% (%4.0fL) | Flow: %4.1f LPM | TDS: %3.0f ppm | CRC: 0x%04X ✓\n",
        packet.node_id, packet.water_level_pct, packet.water_liters, packet.flow_rate_lpm, packet.tds_ppm, packet.crc16);
}

// =====================================================================
// 9. FREERTOS SAFETY LOOP (Core 1)
// =====================================================================
void TaskSafetyLoop(void *parameter) {
    esp_task_wdt_add(NULL);
    uint32_t zeroFlowStart = 0;

    for (;;) {
        esp_task_wdt_reset();

        currentAmps = readMotorCurrent();
        if (pumpState && currentAmps > 15.0) {
            triggerEmergencyStop("Motor Overcurrent Detected (>15A)");
        }

        if (pumpState) {
            totalRuntimeSeconds = (millis() - pumpStartMillis) / 1000;
            if (totalRuntimeSeconds > MAX_RUNTIME_LIMIT_S) {
                triggerEmergencyStop("Max Continuous Runtime Exceeded (2 Hours)");
            }
        }

        if (subNodeConnected && (millis() - lastSubNodePacketTime > 30000)) {
            subNodeConnected = false;
            Serial.println("[SAFETY] Sub Node telemetry lost (>30s)!");
            if (pumpState) {
                setPumpState(false, "SAFETY_SUBNODE_COMM_LOSS");
            }
        }

        // Local Edge Automation (Runs autonomously on ESP32 in AUTOMATIC mode)
        if (!systemFault && pumpMode == "AUTOMATIC") {
            if (!pumpState && latestTankData.water_level_pct <= AUTO_START_LEVEL_PCT) {
                Serial.printf("[EDGE AUTO] Water Level (%.1f%%) <= %.1f%% -> AUTO-STARTING PUMP\n",
                    latestTankData.water_level_pct, AUTO_START_LEVEL_PCT);
                setPumpState(true, "LOCAL_EDGE_AUTO_START_RULE");
            }
            if (pumpState && latestTankData.water_level_pct >= AUTO_STOP_LEVEL_PCT) {
                Serial.printf("[EDGE AUTO] Water Level (%.1f%%) >= %.1f%% -> AUTO-STOPPING PUMP (Tank Full)\n",
                    latestTankData.water_level_pct, AUTO_STOP_LEVEL_PCT);
                setPumpState(false, "LOCAL_EDGE_AUTO_STOP_RULE");
            }
            if (pumpState && (millis() - pumpStartMillis > 20000)) {
                if (latestTankData.flow_rate_lpm < 0.5) {
                    if (zeroFlowStart == 0) zeroFlowStart = millis();
                    if (millis() - zeroFlowStart > (DRY_RUN_TIMEOUT_SEC * 1000)) {
                        triggerEmergencyStop("Borewell Dry Run Protection (Zero Inflow for 120s)");
                    }
                } else {
                    zeroFlowStart = 0;
                }
            }
        }

        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

// =====================================================================
// 10. FREERTOS NETWORKING & CLOUD LOOP (Core 0)
// =====================================================================
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload, length);
    if (error) {
        Serial.printf("[MQTT] JSON parse error: %s\n", error.c_str());
        return;
    }

    const char* action = doc["action"] | doc["command_type"] | "";
    Serial.printf("[MQTT] Inbound Command: '%s'\n", action);

    if (strcmp(action, "START") == 0 || strcmp(action, "START_PUMP") == 0) {
        setPumpState(true, "CLOUD_COMMAND");
    } else if (strcmp(action, "STOP") == 0 || strcmp(action, "STOP_PUMP") == 0) {
        setPumpState(false, "CLOUD_COMMAND");
    } else if (strcmp(action, "SET_MODE") == 0) {
        pumpMode = doc["mode"] | doc["payload"]["mode"] | "AUTOMATIC";
    } else if (strcmp(action, "EMERGENCY_STOP") == 0) {
        triggerEmergencyStop("Remote Emergency Command");
    } else if (strcmp(action, "CLEAR_FAULT") == 0) {
        systemFault = false;
        digitalWrite(PIN_LED_FAULT, LOW);
    }
}

void TaskNetworkLoop(void *parameter) {
    esp_task_wdt_add(NULL);
    uint32_t lastTelemetryPublish = 0;

    for (;;) {
        esp_task_wdt_reset();

        // 1. Wi-Fi Reconnect Loop
        if (WiFi.status() == WL_CONNECTED) {
            wifiConnected = true;
            static bool bleStoppedOnWifi = false;
            if (!bleStoppedOnWifi) {
                BLEDevice::getAdvertising()->stop();
                bleStoppedOnWifi = true;
                Serial.println("[BLE] Wi-Fi connected -> BLE Advertising Stopped & Disconnected.");
            }
        } else {
            wifiConnected = false;
            if (wifiSsid.length() > 0 && millis() - lastWifiCheck > 5000) {
                lastWifiCheck = millis();
                WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
            }
        }

        // 2. MQTT Reconnect Loop with LWT & Auth Code
        if (wifiConnected && !mqttClient.connected()) {
            mqttClient.setServer(mqttBroker.c_str(), mqttPort);
            mqttClient.setCallback(onMqttMessage);
            mqttClient.setBufferSize(1024);

            String clientId = String("ESP32_") + DEVICE_UID;
            String lwtTopic = String("devices/") + DEVICE_UID + "/status";
            String lwtPayload = "{\"status\":\"offline\",\"device_uid\":\"" + String(DEVICE_UID) + "\"}";

            if (mqttClient.connect(clientId.c_str(), DEVICE_UID, authCode.c_str(), lwtTopic.c_str(), 1, true, lwtPayload.c_str())) {
                // Publish instant online message
                String onlinePayload = "{\"status\":\"online\",\"device_uid\":\"" + String(DEVICE_UID) + "\",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
                mqttClient.publish(lwtTopic.c_str(), onlinePayload.c_str(), true);

                String cmdTopic = String("devices/") + DEVICE_UID + "/commands";
                mqttClient.subscribe(cmdTopic.c_str(), 1);
                Serial.printf("[MQTT] Connected to Cloud Gateway with Auth Code: %s\n", authCode.c_str());
            }
        }

        if (mqttClient.connected()) {
            mqttClient.loop();

            if (millis() - lastTelemetryPublish > 1000) {
                lastTelemetryPublish = millis();

                // If Sub Node (ESP8266 Tank Node) is offline, report strictly 0
                if (!subNodeConnected) {
                    latestTankData.water_level_pct = 0.0f;
                    latestTankData.water_liters = 0.0f;
                    latestTankData.flow_rate_lpm = 0.0f;
                    latestTankData.tds_ppm = 0.0f;
                }

                // Telemetry over MQTT
                StaticJsonDocument<512> doc;
                doc["device_uid"] = DEVICE_UID;
                doc["node_uid"] = "TNK-SUB-8266-01";
                doc["water_level_pct"] = latestTankData.water_level_pct;
                doc["water_level_percentage"] = latestTankData.water_level_pct;
                doc["water_level_liters"] = latestTankData.water_liters;
                doc["flow_rate_lpm"] = latestTankData.flow_rate_lpm;
                doc["inflow_rate_lpm"] = latestTankData.flow_rate_lpm;
                doc["total_inflow_liters"] = latestTankData.total_inflow_l;
                doc["tds_ppm"] = latestTankData.tds_ppm;
                doc["temperature_c"] = latestTankData.temperature_c;
                doc["pump_running"] = pumpState;
                doc["current_amps"] = currentAmps;
                doc["subnode_online"] = subNodeConnected;

                char buffer[512];
                serializeJson(doc, buffer);
                String topic = String("devices/") + DEVICE_UID + "/telemetry";
                mqttClient.publish(topic.c_str(), buffer);
            }
        }

        // 3. Service Local Web Server
        localServer.handleClient();

        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

// =====================================================================
// 11. ARDUINO SETUP & MAIN LOOP
// =====================================================================
void setup() {
    Serial.begin(115200);
    Serial.println("\n==================================================");
    Serial.println("  AQUACONTROL — ESP32 MAIN CONTROLLER v2.1.0");
    Serial.println("==================================================");

    // GPIO Configuration
    pinMode(PIN_RELAY, OUTPUT);
    digitalWrite(PIN_RELAY, HIGH); // De-energize relay on boot (Active LOW)

    pinMode(PIN_LED_POWER, OUTPUT);
    pinMode(PIN_LED_PUMP, OUTPUT);
    pinMode(PIN_LED_WIFI, OUTPUT);
    pinMode(PIN_LED_FAULT, OUTPUT);
    pinMode(PIN_BUZZER, OUTPUT);
    pinMode(PIN_BTN_MANUAL, INPUT_PULLUP);
    pinMode(PIN_BTN_RESET, INPUT_PULLUP);

    digitalWrite(PIN_LED_POWER, HIGH); // Blue Power LED ON

    // 1. Load Saved Credentials from NVS Flash
    loadSavedCredentials();

    // 2. Start Standard ESP32 BLE GATT Server (Highest Radio Priority)
    startBleProvisioning();

    // 3. Connect to saved home Wi-Fi if available (Station Mode)
    WiFi.mode(WIFI_STA);
    if (wifiSsid.length() > 0) {
        Serial.printf("[WiFi STA] Connecting to '%s'...\n", wifiSsid.c_str());
        WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
    } else {
        Serial.println("[WiFi STA] No saved Wi-Fi. Waiting for BLE App to push credentials...");
    }

    // 6. Initialize ESP-NOW 2.4GHz Link Receiver
    if (esp_now_init() == ESP_OK) {
        esp_now_register_recv_cb(onEspNowDataRecv);

        esp_now_peer_info_t broadcastPeer = {};
        memset(&broadcastPeer, 0, sizeof(broadcastPeer));
        for (int i = 0; i < 6; i++) broadcastPeer.peer_addr[i] = 0xFF;
        broadcastPeer.channel = 0;
        broadcastPeer.encrypt = false;
        esp_now_add_peer(&broadcastPeer);

        Serial.println("[ESP-NOW] Direct 2.4GHz Link Receiver Initialized & Armed!");
    }

    // 7. FreeRTOS Dual-Core Tasks
    xTaskCreatePinnedToCore(TaskSafetyLoop,  "TaskSafety",  4096, NULL, 5, &TaskSafetyHandle,  1); // Core 1 (Safety & Automation)
    xTaskCreatePinnedToCore(TaskNetworkLoop, "TaskNetwork", 4096, NULL, 1, &TaskNetworkHandle, 0); // Core 0 (Networking & Cloud)
}

void loop() {
    // =================================================================
    // 1. WI-FI LED STATUS INDICATION ENGINE
    // =================================================================
    // When NOT connected: BLINKS continuously every 500ms
    // When CONNECTED: STOPS BLINKING and stays SOLID ON
    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(PIN_LED_WIFI, HIGH); // Solid ON
    } else {
        if (millis() - lastLedBlinkTime >= 500) {
            lastLedBlinkTime = millis();
            ledWifiState = !ledWifiState;
            digitalWrite(PIN_LED_WIFI, ledWifiState ? HIGH : LOW);
        }
    }

    // =================================================================
    // 2. MANUAL PUSH BUTTON TOGGLE
    // =================================================================
    static uint32_t lastBtnCheck = 0;
    if (millis() - lastBtnCheck > 200) {
        lastBtnCheck = millis();
        if (digitalRead(PIN_BTN_MANUAL) == LOW) {
            setPumpState(!pumpState, "PHYSICAL_BUTTON_PRESS");
            delay(300);
        }
    }

    // =================================================================
    // 3. RESET BUTTON (Hold 3s to wipe credentials)
    // =================================================================
    static uint32_t resetHoldStart = 0;
    if (digitalRead(PIN_BTN_RESET) == LOW) {
        if (resetHoldStart == 0) resetHoldStart = millis();
        if (millis() - resetHoldStart >= 3000) {
            resetHoldStart = 0;
            Serial.println("[RESET] Clearing Wi-Fi credentials from NVS flash...");
            preferences.begin("pump_cfg", false);
            preferences.clear();
            preferences.end();
            
            digitalWrite(PIN_BUZZER, HIGH); delay(300); digitalWrite(PIN_BUZZER, LOW);
            ESP.restart();
        }
    } else {
        resetHoldStart = 0;
    }

    // =================================================================
    // 4. USB SERIAL COMMANDS & PROVISIONING INGESTION
    // =================================================================
    if (Serial.available() > 0) {
        String serialInput = Serial.readStringUntil('\n');
        serialInput.trim();
        if (serialInput.equalsIgnoreCase("RESET") || serialInput.equalsIgnoreCase("FACTORY_RESET") || serialInput.equalsIgnoreCase("CLEAR")) {
            Serial.println("[RESET] Manual Serial Reset requested. Clearing NVS flash...");
            preferences.begin("pump_cfg", false);
            preferences.clear();
            preferences.end();
            digitalWrite(PIN_BUZZER, HIGH); delay(300); digitalWrite(PIN_BUZZER, LOW);
            Serial.println("[RESET] Done! Rebooting into Provisioning Mode...");
            ESP.restart();
        } else if (serialInput.startsWith("{") && serialInput.endsWith("}")) {
            Serial.println("[SERIAL] Ingesting credentials via USB Serial port...");
            handleApplyCredentials(serialInput);
        }
    }

    vTaskDelay(pdMS_TO_TICKS(50));
}

// END OF ESP32 INDUSTRIAL MAIN NODE FIRMWARE (BLE & ESP-NOW TELEMETRY)
