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
    
    bool connect(const char* id) { return true; }
    bool connect(const char* id, const char* user, const char* pass) { return true; }
    bool connect(const char* id, const char* willTopic, uint8_t willQos, bool willRetain, const char* willMessage) { return true; }
    bool connect(const char* id, const char* user, const char* pass, const char* willTopic, uint8_t willQos, bool willRetain, const char* willMessage) { return true; }
    bool connect(const char* id, const char* user, const char* pass, const char* willTopic, uint8_t willQos, bool willRetain, const char* willMessage, bool cleanSession) { return true; }
    
    void disconnect() {}
    bool publish(const char* topic, const char* payload, bool retained = false) { return true; }
    bool publish(const char* topic, const uint8_t* payload, unsigned int plength, bool retained = false) { return true; }
    bool subscribe(const char* topic, uint8_t qos = 0) { return true; }
    bool unsubscribe(const char* topic) { return true; }
    bool loop() { return true; }
    bool connected() { return true; }
    int state() { return 0; }
};

#endif // PUBSUB_CLIENT_H_STUB
