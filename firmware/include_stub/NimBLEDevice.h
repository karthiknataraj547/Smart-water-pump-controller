#pragma once
#ifndef NIMBLE_DEVICE_H_STUB
#define NIMBLE_DEVICE_H_STUB

#include "Arduino.h"

// NimBLE property flags
namespace NIMBLE_PROPERTY {
    const uint32_t READ       = 0x01;
    const uint32_t WRITE      = 0x02;
    const uint32_t NOTIFY     = 0x04;
    const uint32_t INDICATE   = 0x08;
    const uint32_t WRITE_NR   = 0x10;
    const uint32_t BROADCAST  = 0x20;
}

// ESP power levels
#define ESP_PWR_LVL_N12  0
#define ESP_PWR_LVL_N9   1
#define ESP_PWR_LVL_N6   2
#define ESP_PWR_LVL_N3   3
#define ESP_PWR_LVL_N0   4
#define ESP_PWR_LVL_P3   5
#define ESP_PWR_LVL_P6   6
#define ESP_PWR_LVL_P9   7

class NimBLECharacteristic;

class NimBLECharacteristicCallbacks {
public:
    virtual ~NimBLECharacteristicCallbacks() {}
    virtual void onWrite(NimBLECharacteristic* pCharacteristic) {}
    virtual void onRead(NimBLECharacteristic* pCharacteristic) {}
};

class NimBLECharacteristic {
public:
    std::string getValue() { return std::string(""); }
    void setValue(const char* val) {}
    void setValue(const String& val) {}
    void setValue(const std::string& val) {}
    void setValue(const uint8_t* data, size_t size) {}
    void setValue(uint8_t* data, size_t size) {}
    void setValue(int val) {}
    void setCallbacks(NimBLECharacteristicCallbacks* pCallbacks) {}
    void notify() {}
};

class NimBLEService {
public:
    NimBLECharacteristic* createCharacteristic(const char* uuid, uint32_t properties) {
        return new NimBLECharacteristic();
    }
    void start() {}
};

class NimBLEServer {
public:
    NimBLEService* createService(const char* uuid) {
        return new NimBLEService();
    }
};

class NimBLEAdvertising {
public:
    void addServiceUUID(const char* uuid) {}
    void setScanResponse(bool set) {}
    void setMinPreferred(uint16_t val) {}
    void setMaxPreferred(uint16_t val) {}
    void start() {}
    void stop() {}
};

class NimBLEDevice {
public:
    static void init(const String& name) {}
    static void init(const char* name) {}
    static void setPower(int powerLevel) {}
    static NimBLEServer* createServer() { return new NimBLEServer(); }
    static NimBLEAdvertising* getAdvertising() { return new NimBLEAdvertising(); }
    static void startAdvertising() {}
    static void stopAdvertising() {}
    static void deinit(bool release = true) {}
};

#endif // NIMBLE_DEVICE_H_STUB
