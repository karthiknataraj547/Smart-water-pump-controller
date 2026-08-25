#include "ble_provisioning.h"
#include "wifi_manager.h"
#include <string>

BleProvisioning bleProv;

static char tempSsid[64] = {0};
static char tempPass[64] = {0};
static char tempServer[128] = {0};

class SsidCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pCharacteristic) {
        std::string val = pCharacteristic->getValue();
        strncpy(tempSsid, val.c_str(), sizeof(tempSsid) - 1);
        Serial.printf("[BLE] Received Wi-Fi SSID: %s\n", tempSsid);
    }
};

class PassCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pCharacteristic) {
        std::string val = pCharacteristic->getValue();
        strncpy(tempPass, val.c_str(), sizeof(tempPass) - 1);
        Serial.printf("[BLE] Received Wi-Fi Password (%d bytes)\n", (int)val.length());
    }
};

class ServerCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pCharacteristic) {
        std::string val = pCharacteristic->getValue();
        strncpy(tempServer, val.c_str(), sizeof(tempServer) - 1);
        Serial.printf("[BLE] Received Server Endpoint: %s\n", tempServer);

        // When all 3 fields or SSID/Pass are written, trigger Wi-Fi save
        if (strlen(tempSsid) > 0 && strlen(tempPass) > 0) {
            bleProv.setStatus(PROV_STATUS_CONNECTING_WIFI);
            wifiMgr.saveCredentials(tempSsid, tempPass, strlen(tempServer) > 0 ? tempServer : nullptr);
            bleProv.setStatus(PROV_STATUS_SUCCESS);
        }
    }
};

BleProvisioning::BleProvisioning() : isAdvertising(false), pServer(nullptr), pStatusChar(nullptr) {}

void BleProvisioning::begin() {
    NimBLEDevice::init("Water Pump Controller (" DEFAULT_DEVICE_UID ")");
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);

    pServer = NimBLEDevice::createServer();
    NimBLEService* pService = pServer->createService(SERVICE_UUID_PROVISIONING);

    // Characteristic 1: Device Info
    NimBLECharacteristic* pInfoChar = pService->createCharacteristic(
        CHAR_UUID_DEVICE_INFO,
        NIMBLE_PROPERTY::READ
    );
    pInfoChar->setValue("{\"device_uid\":\"" DEFAULT_DEVICE_UID "\",\"firmware\":\"" FIRMWARE_VERSION "\",\"hw\":\"" HARDWARE_REVISION "\"}");

    // Characteristic 2: SSID
    NimBLECharacteristic* pSsidChar = pService->createCharacteristic(
        CHAR_UUID_WIFI_SSID,
        NIMBLE_PROPERTY::WRITE
    );
    pSsidChar->setCallbacks(new SsidCallbacks());

    // Characteristic 3: Password
    NimBLECharacteristic* pPassChar = pService->createCharacteristic(
        CHAR_UUID_WIFI_PASS,
        NIMBLE_PROPERTY::WRITE
    );
    pPassChar->setCallbacks(new PassCallbacks());

    // Characteristic 4: Server URL
    NimBLECharacteristic* pServerChar = pService->createCharacteristic(
        CHAR_UUID_SERVER_URL,
        NIMBLE_PROPERTY::WRITE
    );
    pServerChar->setCallbacks(new ServerCallbacks());

    // Characteristic 5: Provisioning Status
    pStatusChar = pService->createCharacteristic(
        CHAR_UUID_PROV_STATUS,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
    );
    uint8_t initStatus = PROV_STATUS_IDLE;
    pStatusChar->setValue(&initStatus, 1);

    pService->start();
    startAdvertising();
}

void BleProvisioning::startAdvertising() {
    NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID_PROVISIONING);
    pAdvertising->setScanResponse(true);
    pAdvertising->start();
    isAdvertising = true;
    Serial.println("[BLE] Provisioning GATT Server Advertising Started");
}

void BleProvisioning::stopAdvertising() {
    NimBLEDevice::getAdvertising()->stop();
    isAdvertising = false;
    Serial.println("[BLE] Provisioning Advertising Stopped");
}

void BleProvisioning::update() {
    // If successfully connected to Wi-Fi, stop BLE advertising after 30 seconds
    if (wifiMgr.isConnected() && isAdvertising) {
        stopAdvertising();
    }
}

void BleProvisioning::setStatus(ProvisioningStatus status) {
    if (pStatusChar) {
        uint8_t s = (uint8_t)status;
        pStatusChar->setValue(&s, 1);
        pStatusChar->notify();
    }
}
