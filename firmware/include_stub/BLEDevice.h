#ifndef BLE_DEVICE_H_STUB
#define BLE_DEVICE_H_STUB

#include "Arduino.h"

class BLECharacteristic;
class BLEServer;
class BLEService;
class BLEAdvertising;

class BLEUUID {
public:
    BLEUUID() {}
    BLEUUID(const char* uuid) {}
    BLEUUID(const String& uuid) {}
    BLEUUID(uint16_t uuid) {}
    BLEUUID(uint32_t uuid) {}
};

class BLEDescriptor {
public:
    virtual ~BLEDescriptor() {}
};

class BLE2902 : public BLEDescriptor {
public:
    BLE2902() {}
    void setNotifications(bool val) {}
};

class BLEAdvertisementData {
public:
    void setName(const String& name) {}
    void setName(const char* name) {}
    void setCompleteServices(const BLEUUID& uuid) {}
    void setFlags(uint8_t flags) {}
};

class BLECharacteristicCallbacks {
public:
    virtual ~BLECharacteristicCallbacks() {}
    virtual void onWrite(BLECharacteristic* pCharacteristic) {}
    virtual void onRead(BLECharacteristic* pCharacteristic) {}
};

class BLECharacteristic {
public:
    static const uint32_t PROPERTY_READ   = 1 << 0;
    static const uint32_t PROPERTY_WRITE  = 1 << 1;
    static const uint32_t PROPERTY_NOTIFY = 1 << 2;
    static const uint32_t PROPERTY_WRITE_NR = 1 << 3;

    String getValue() { return String(""); }
    void setValue(const String& val) {}
    void setValue(const char* val) {}
    void setCallbacks(BLECharacteristicCallbacks* pCallbacks) {}
    void notify() {}
    void addDescriptor(BLEDescriptor* pDescriptor) {}
};

class BLEService {
public:
    BLECharacteristic* createCharacteristic(const char* uuid, uint32_t properties) {
        return new BLECharacteristic();
    }
    BLECharacteristic* createCharacteristic(const BLEUUID& uuid, uint32_t properties) {
        return new BLECharacteristic();
    }
    void start() {}
};

class BLEServerCallbacks {
public:
    virtual ~BLEServerCallbacks() {}
    virtual void onConnect(BLEServer* pServer) {}
    virtual void onDisconnect(BLEServer* pServer) {}
};

class BLEServer {
public:
    BLEService* createService(const char* uuid) {
        return new BLEService();
    }
    BLEService* createService(const BLEUUID& uuid) {
        return new BLEService();
    }
    void setCallbacks(BLEServerCallbacks* pCallbacks) {}
    void startAdvertising() {}
};

class BLEAdvertising {
public:
    void addServiceUUID(const char* uuid) {}
    void addServiceUUID(const BLEUUID& uuid) {}
    void setAdvertisementData(const BLEAdvertisementData& data) {}
    void setScanResponseData(const BLEAdvertisementData& data) {}
    void setScanResponse(bool set) {}
    void setMinPreferred(uint16_t val) {}
    void setMaxPreferred(uint16_t val) {}
    void start() {}
    void stop() {}
};

class BLEDevice {
public:
    static void init(const String& name) {}
    static void init(const char* name) {}
    static BLEServer* createServer() { return new BLEServer(); }
    static BLEAdvertising* getAdvertising() { return new BLEAdvertising(); }
    static void startAdvertising() {}
    static void deinit(bool release = true) {}
};

#endif // BLE_DEVICE_H_STUB
