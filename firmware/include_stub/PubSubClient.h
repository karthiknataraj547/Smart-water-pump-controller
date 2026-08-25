#pragma once
#ifndef PUBSUB_CLIENT_H_STUB
#define PUBSUB_CLIENT_H_STUB

#include "Arduino.h"
#include "WiFi.h"

typedef void (*MQTT_CALLBACK_SIGNATURE)(char*, uint8_t*, unsigned int);

class PubSubClient {
public:
    PubSubClient() {}
    PubSubClient(WiFiClient& client) {}
    void setServer(const char* domain, uint16_t port) {}
    void setCallback(MQTT_CALLBACK_SIGNATURE callback) {}
    bool setBufferSize(uint16_t size) { return true; }
    PubSubClient& setKeepAlive(uint16_t keepAlive) { return *this; }
    PubSubClient& setSocketTimeout(uint16_t timeout) { return *this; }
    bool connect(const char* id, const char* user = NULL, const char* pass = NULL, const char* willTopic = NULL, uint8_t willQos = 0, bool willRetain = false, const char* willMessage = NULL) { return true; }
    void disconnect() {}
    bool publish(const char* topic, const char* payload, bool retained = false) { return true; }
    bool subscribe(const char* topic, uint8_t qos = 0) { return true; }
    bool loop() { return true; }
    bool connected() { return true; }
    int state() { return 0; }
};

#endif // PUBSUB_CLIENT_H_STUB
