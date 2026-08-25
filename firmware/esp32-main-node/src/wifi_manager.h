#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include "../include/config.h"

class WifiManager {
public:
    WifiManager();
    void begin();
    void update();

    bool isConnected() const;
    void saveCredentials(const char* ssid, const char* password, const char* serverUrl = nullptr);
    void clearCredentials();
    String getLocalIp() const;
    int getRssi() const;

private:
    Preferences preferences;
    char savedSsid[64];
    char savedPassword[64];
    char savedServerUrl[128];
    uint32_t lastReconnectAttempt;
    bool hasSavedCredentials;

    void loadCredentials();
    void attemptConnection();
};

extern WifiManager wifiMgr;

#endif // WIFI_MANAGER_H
