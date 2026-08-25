#include "wifi_manager.h"

WifiManager wifiMgr;

WifiManager::WifiManager() : lastReconnectAttempt(0), hasSavedCredentials(false) {
    memset(savedSsid, 0, sizeof(savedSsid));
    memset(savedPassword, 0, sizeof(savedPassword));
    memset(savedServerUrl, 0, sizeof(savedServerUrl));
}

void WifiManager::begin() {
    pinMode(PIN_LED_CLOUD_STATUS, OUTPUT);
    digitalWrite(PIN_LED_CLOUD_STATUS, LOW);
    loadCredentials();

    if (hasSavedCredentials) {
        attemptConnection();
    } else {
        Serial.println("[WiFi] No saved Wi-Fi credentials found. Waiting for BLE provisioning.");
    }
}

void WifiManager::update() {
    if (hasSavedCredentials && !isConnected()) {
        if (millis() - lastReconnectAttempt > 10000) {
            lastReconnectAttempt = millis();
            Serial.println("[WiFi] Reconnecting to Wi-Fi...");
            attemptConnection();
        }
        // Blink LED while connecting
        digitalWrite(PIN_LED_CLOUD_STATUS, (millis() / 500) % 2 == 0 ? HIGH : LOW);
    } else if (isConnected()) {
        // Solid LED when connected
        digitalWrite(PIN_LED_CLOUD_STATUS, HIGH);
    } else {
        // Fast blink when in provisioning mode
        digitalWrite(PIN_LED_CLOUD_STATUS, (millis() / 150) % 2 == 0 ? HIGH : LOW);
    }
}

bool WifiManager::isConnected() const {
    return WiFi.status() == WL_CONNECTED;
}

void WifiManager::saveCredentials(const char* ssid, const char* password, const char* serverUrl) {
    preferences.begin("pump_wifi", false);
    preferences.putString("ssid", ssid);
    preferences.putString("password", password);
    if (serverUrl) {
        preferences.putString("server", serverUrl);
    }
    preferences.end();

    strncpy(savedSsid, ssid, sizeof(savedSsid) - 1);
    strncpy(savedPassword, password, sizeof(savedPassword) - 1);
    if (serverUrl) {
        strncpy(savedServerUrl, serverUrl, sizeof(savedServerUrl) - 1);
    }
    hasSavedCredentials = true;

    Serial.printf("[WiFi] Saved new Wi-Fi credentials for SSID: %s\n", ssid);
    attemptConnection();
}

void WifiManager::clearCredentials() {
    preferences.begin("pump_wifi", false);
    preferences.clear();
    preferences.end();
    hasSavedCredentials = false;
    WiFi.disconnect(true);
    Serial.println("[WiFi] Cleared saved Wi-Fi credentials from NVS Flash.");
}

void WifiManager::loadCredentials() {
    preferences.begin("pump_wifi", true);
    String s = preferences.getString("ssid", "");
    String p = preferences.getString("password", "");
    String srv = preferences.getString("server", DEFAULT_MQTT_HOST);
    preferences.end();

    if (s.length() > 0) {
        strncpy(savedSsid, s.c_str(), sizeof(savedSsid) - 1);
        strncpy(savedPassword, p.c_str(), sizeof(savedPassword) - 1);
        strncpy(savedServerUrl, srv.c_str(), sizeof(savedServerUrl) - 1);
        hasSavedCredentials = true;
        Serial.printf("[WiFi] Loaded saved SSID: %s\n", savedSsid);
    }
}

void WifiManager::attemptConnection() {
    WiFi.begin(savedSsid, savedPassword);
}

String WifiManager::getLocalIp() const {
    return isConnected() ? WiFi.localIP().toString() : "0.0.0.0";
}

int WifiManager::getRssi() const {
    return isConnected() ? WiFi.RSSI() : -100;
}
