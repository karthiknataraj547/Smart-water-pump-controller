#ifndef CLOUD_CLIENT_H
#define CLOUD_CLIENT_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <string.h>

#if __has_include(<Arduino.h>)
#include <Arduino.h>
#elif __has_include("../../include_stub/Arduino.h")
#include "../../include_stub/Arduino.h"
#endif

#if __has_include(<WiFi.h>)
#include <WiFi.h>
#elif __has_include("../../include_stub/WiFi.h")
#include "../../include_stub/WiFi.h"
#endif

#if __has_include(<PubSubClient.h>)
#include <PubSubClient.h>
#elif __has_include("../../include_stub/PubSubClient.h")
#include "../../include_stub/PubSubClient.h"
#endif

#if __has_include(<ArduinoJson.h>)
#include <ArduinoJson.h>
#elif __has_include("../../include_stub/ArduinoJson.h")
#include "../../include_stub/ArduinoJson.h"
#endif

#include "../include/config.h"

class CloudClient {
public:
    CloudClient();
    void begin();
    void update();

    bool isConnected();
    void publishTelemetry(const TankTelemetryPacket& packet, float currentAmps, uint8_t pumpState);
    void publishAck(const char* commandId, const char* status, const char* confirmedState, float currentAmps, uint32_t runtimeSec);
    void publishStatus(const char* status);

    // Direct HTTP REST API Integration
    void sendHttpAck(const char* commandId, const char* status, const char* confirmedState, float currentAmps, uint32_t runtimeSec);
    void sendHttpTelemetry(const TankTelemetryPacket& packet, float currentAmps, uint8_t pumpState);

    static void onMqttMessage(char* topic, byte* payload, unsigned int length);

private:
    WiFiClient espClient;
    PubSubClient mqttClient;
    uint32_t lastReconnectAttempt;
    uint32_t lastTelemetryPublish;

    void reconnect();
    void handleCommand(JsonObject doc);
};

extern CloudClient cloudClient;

#endif // CLOUD_CLIENT_H
