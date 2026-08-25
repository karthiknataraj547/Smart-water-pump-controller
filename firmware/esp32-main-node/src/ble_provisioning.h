#ifndef BLE_PROVISIONING_H
#define BLE_PROVISIONING_H

#include <Arduino.h>
#include <NimBLEDevice.h>
#include "../include/config.h"

// Custom GATT Service & Characteristic UUIDs
#define SERVICE_UUID_PROVISIONING      "0000ffff-0000-1000-8000-00805f9b34fb"
#define CHAR_UUID_DEVICE_INFO          "0000fff1-0000-1000-8000-00805f9b34fb"
#define CHAR_UUID_WIFI_SSID            "0000fff2-0000-1000-8000-00805f9b34fb"
#define CHAR_UUID_WIFI_PASS            "0000fff3-0000-1000-8000-00805f9b34fb"
#define CHAR_UUID_SERVER_URL           "0000fff4-0000-1000-8000-00805f9b34fb"
#define CHAR_UUID_PROV_STATUS          "0000fff5-0000-1000-8000-00805f9b34fb"

enum ProvisioningStatus {
    PROV_STATUS_IDLE = 0,
    PROV_STATUS_RECEIVING_DATA = 1,
    PROV_STATUS_CONNECTING_WIFI = 2,
    PROV_STATUS_SUCCESS = 3,
    PROV_STATUS_FAILED_AUTH = 4,
    PROV_STATUS_FAILED_CONNECT = 5
};

class BleProvisioning {
public:
    BleProvisioning();
    void begin();
    void startAdvertising();
    void stopAdvertising();
    void update();
    bool isProvisioningActive() const { return isAdvertising; }

    void setStatus(ProvisioningStatus status);

private:
    bool isAdvertising;
    NimBLEServer* pServer;
    NimBLECharacteristic* pStatusChar;
};

extern BleProvisioning bleProv;

#endif // BLE_PROVISIONING_H
