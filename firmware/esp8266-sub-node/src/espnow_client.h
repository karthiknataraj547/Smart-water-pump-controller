#ifndef ESPNOW_CLIENT_H
#define ESPNOW_CLIENT_H

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <espnow.h>
#include "../include/config.h"

class EspNowClient {
public:
    EspNowClient();
    bool begin();
    bool sendTelemetry(float levelPct, float volumeL, float flowLpm, float totalInflowL, float tdsPpm, float tempC, uint8_t healthMask, uint16_t battMv);

    uint32_t getPacketsSent() const { return packetsSent; }
    uint32_t getPacketsFailed() const { return packetsFailed; }

    static void onDataSent(uint8_t *mac, uint8_t status);

private:
    uint32_t sequenceNum;
    uint32_t packetsSent;
    uint32_t packetsFailed;

    static uint16_t calculateCrc16(const uint8_t *data, size_t length);
};

extern EspNowClient espNowClient;

#endif // ESPNOW_CLIENT_H
