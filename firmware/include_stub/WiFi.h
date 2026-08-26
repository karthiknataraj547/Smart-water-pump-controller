#pragma once
#ifndef WIFI_H_STUB
#define WIFI_H_STUB

#include "Arduino.h"

enum WiFiMode_t {
    WIFI_OFF = 0,
    WIFI_STA = 1,
    WIFI_AP = 2,
    WIFI_AP_STA = 3
};

enum wifi_auth_mode_t {
    WIFI_AUTH_OPEN = 0,
    WIFI_AUTH_WEP = 1,
    WIFI_AUTH_WPA_PSK = 2,
    WIFI_AUTH_WPA2_PSK = 3,
    WIFI_AUTH_WPA_WPA2_PSK = 4,
    WIFI_AUTH_WPA2_ENTERPRISE = 5,
    WIFI_AUTH_WPA3_PSK = 6
};

enum wl_status_t {
    WL_NO_SHIELD = 255,
    WL_IDLE_STATUS = 0,
    WL_NO_SSID_AVAIL = 1,
    WL_SCAN_COMPLETED = 2,
    WL_CONNECTED = 3,
    WL_CONNECT_FAILED = 4,
    WL_CONNECTION_LOST = 5,
    WL_DISCONNECTED = 6
};

class IPAddress {
public:
    IPAddress() {}
    IPAddress(uint8_t a, uint8_t b, uint8_t c, uint8_t d) {}
    String toString() const { return "192.168.4.1"; }
};

class WiFiClient {
public:
    bool connected() { return false; }
    int available() { return 0; }
    int read() { return -1; }
    size_t write(uint8_t b) { return 1; }
    size_t write(const uint8_t* buf, size_t size) { return size; }
    void stop() {}
};

class WiFiClass {
public:
    void mode(WiFiMode_t m) {}
    void disconnect(bool wifioff = false) {}
    wl_status_t begin(const char* ssid, const char *passphrase = NULL) { return WL_CONNECTED; }
    wl_status_t status() { return WL_CONNECTED; }
    IPAddress localIP() { return IPAddress(); }
    String macAddress() { return "24:6F:28:A8:1F:29"; }
    int RSSI() { return -55; }
    int RSSI(int index) { return -55; }
    int RSSI(uint8_t index) { return -55; }
    int scanNetworks() { return 0; }
    String SSID(int index) { return "WiFi_Network"; }
    String SSID(uint8_t index) { return "WiFi_Network"; }
    wifi_auth_mode_t encryptionType(int index) { return WIFI_AUTH_WPA2_PSK; }
    wifi_auth_mode_t encryptionType(uint8_t index) { return WIFI_AUTH_WPA2_PSK; }
    bool softAP(const char* ssid, const char* passphrase = NULL, int channel = 1, int ssid_hidden = 0) { return true; }
    bool softAPdisconnect(bool wifioff = false) { return true; }
    IPAddress softAPIP() { return IPAddress(); }
};

extern WiFiClass WiFi;

#endif // WIFI_H_STUB
