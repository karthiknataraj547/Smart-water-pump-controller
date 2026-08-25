#ifndef ESPNOW_MANAGER_H
#define ESPNOW_MANAGER_H

#include <Arduino.h>
#include <esp_now.h>
#include <WiFi.h>
#include "../include/config.h"

class EspNowManager {
public:
    EspNowManager();
    bool begin();
    void update();
    
    bool isSubnodeConnected() const;
    const TankTelemetryPacket& getLatestPacket() const { return latestPacket; }
    uint32_t getLastPacketAgeMs() const;
    uint32_t getPacketsReceived() const { return packetsReceived; }
    uint32_t getCrcErrors() const { return crcErrors; }

    static void onDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len);

private:
    TankTelemetryPacket latestPacket;
    uint32_t lastPacketTimestamp;
    uint32_t lastSequenceNum;
    uint32_t packetsReceived;
    uint32_t crcErrors;

    static uint16_t calculateCrc16(const uint8_t *data, size_t length);
};

extern EspNowManager espNowMgr;

#endif // ESPNOW_MANAGER_H
