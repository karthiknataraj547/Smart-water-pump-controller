#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <string.h>
#include <math.h>

#if __has_include(<Arduino.h>)
#include <Arduino.h>
#elif __has_include("../../include_stub/Arduino.h")
#include "../../include_stub/Arduino.h"
#endif

#if __has_include(<HTTPClient.h>)
#include <HTTPClient.h>
#elif __has_include("../../include_stub/HTTPClient.h")
#include "../../include_stub/HTTPClient.h"
#endif

#include "cloud_client.h"
#include "pump_controller.h"
#include "wifi_manager.h"
#include "espnow_manager.h"

CloudClient cloudClient;

CloudClient::CloudClient() 
    : mqttClient(espClient), lastReconnectAttempt(0), lastTelemetryPublish(0) {}

void CloudClient::begin() {
    mqttClient.setServer(DEFAULT_MQTT_HOST, DEFAULT_MQTT_PORT);
    mqttClient.setCallback(onMqttMessage);
    mqttClient.setBufferSize(1024);
}

void CloudClient::update() {
    if (!wifiMgr.isConnected()) return;

    if (!mqttClient.connected()) {
        if (millis() - lastReconnectAttempt > 5000) {
            lastReconnectAttempt = millis();
            reconnect();
        }
    } else {
        mqttClient.loop();

        // Publish periodic telemetry if Sub Node is alive
        if (millis() - lastTelemetryPublish > HEARTBEAT_INTERVAL_MS) {
            lastTelemetryPublish = millis();
            if (espNowMgr.isSubnodeConnected()) {
                publishTelemetry(
                    espNowMgr.getLatestPacket(),
                    pumpCtrl.getCurrentAmps(),
                    pumpCtrl.getState()
                );
            }
        }
    }
}

bool CloudClient::isConnected() {
    return mqttClient.connected();
}

void CloudClient::reconnect() {
    Serial.println("[MQTT] Connecting to Cloud MQTT Broker...");
    String clientId = "ESP32_PUMP_" + String(DEFAULT_DEVICE_UID);
    
    // Set LWT (Last Will and Testament)
    String lwtTopic = "devices/" DEFAULT_DEVICE_UID "/status";
    const char* lwtMsg = "{\"status\":\"offline\"}";

    if (mqttClient.connect(clientId.c_str(), "iot_device", "device_secure_token", lwtTopic.c_str(), 1, true, lwtMsg)) {
        Serial.println("[MQTT] Connected to Cloud Message Broker!");
        
        // Subscribe to device commands topic
        String commandTopic = "devices/" DEFAULT_DEVICE_UID "/commands";
        mqttClient.subscribe(commandTopic.c_str(), 1);
        Serial.printf("[MQTT] Subscribed to %s\n", commandTopic.c_str());

        // Publish online status
        publishStatus("online");
    } else {
        Serial.printf("[MQTT] Connect failed, rc=%d\n", mqttClient.state());
    }
}

void CloudClient::publishTelemetry(const TankTelemetryPacket& packet, float currentAmps, uint8_t pumpState) {
    if (mqttClient.connected()) {
        StaticJsonDocument<512> doc;
        doc["node_uid"] = "TNK-SUB-8266-01";
        doc["water_level_pct"] = packet.water_level_pct;
        doc["water_liters"] = packet.water_liters;
        doc["flow_rate_lpm"] = packet.flow_rate_lpm;
        doc["total_inflow_liters"] = packet.total_inflow_l;
        doc["tds_ppm"] = packet.tds_ppm;
        doc["temperature_c"] = packet.temperature_c;
        doc["sensor_health_mask"] = packet.sensor_health;
        doc["battery_mv"] = packet.battery_mv;
        doc["current_amps"] = currentAmps;
        doc["pump_state"] = (pumpState == PUMP_ON) ? "ON" : (pumpState == PUMP_FAULT ? "FAULT" : "OFF");
        doc["runtime_sec"] = pumpCtrl.getRuntimeSeconds();
        doc["rssi"] = wifiMgr.getRssi();

        char buffer[512];
        serializeJson(doc, buffer);
        String topic = "devices/" DEFAULT_DEVICE_UID "/telemetry";
        mqttClient.publish(topic.c_str(), buffer, false);
    }

    // Also push direct HTTP REST API to server -> Broadcast to web and mobile apps
    sendHttpTelemetry(packet, currentAmps, pumpState);
}

void CloudClient::publishAck(const char* commandId, const char* status, const char* confirmedState, float currentAmps, uint32_t runtimeSec) {
    if (mqttClient.connected()) {
        StaticJsonDocument<256> doc;
        doc["command_id"] = commandId;
        doc["status"] = status;
        doc["confirmed_state"] = confirmedState;
        doc["current_amps"] = currentAmps;
        doc["runtime_seconds"] = runtimeSec;

        char buffer[256];
        serializeJson(doc, buffer);
        String topic = "devices/" DEFAULT_DEVICE_UID "/ack";
        mqttClient.publish(topic.c_str(), buffer, true);
        Serial.printf("[MQTT] Sent Hardware ACK for command %s -> State: %s\n", commandId, confirmedState);
    }

    // Always push direct HTTP REST API ACK to server -> Reaches backend & broadcast to app
    sendHttpAck(commandId, status, confirmedState, currentAmps, runtimeSec);
}

void CloudClient::sendHttpAck(const char* commandId, const char* status, const char* confirmedState, float currentAmps, uint32_t runtimeSec) {
    if (!wifiMgr.isConnected()) return;

    HTTPClient http;
    http.setTimeout(300);
    String url = "http://" DEFAULT_API_HOST ":" + String(DEFAULT_API_PORT) + "/api/v1/pump/ack";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["device_uid"] = DEFAULT_DEVICE_UID;
    doc["command_id"] = commandId;
    doc["status"] = status;
    doc["confirmed_state"] = confirmedState;
    doc["current_amps"] = currentAmps;
    doc["runtime_seconds"] = runtimeSec;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpCode = http.POST(jsonPayload);
    if (httpCode > 0) {
        Serial.printf("[HTTP REST ACK] State pushed to server (HTTP %d)\n", httpCode);
    } else {
        Serial.printf("[HTTP REST ACK] Request failed. Error: %s\n", http.errorToString(httpCode).c_str());
    }
    http.end();
}

void CloudClient::sendHttpTelemetry(const TankTelemetryPacket& packet, float currentAmps, uint8_t pumpState) {
    if (!wifiMgr.isConnected()) return;

    HTTPClient http;
    http.setTimeout(300);
    String url = "http://" DEFAULT_API_HOST ":" + String(DEFAULT_API_PORT) + "/api/v1/sensors/telemetry";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<512> doc;
    doc["device_uid"] = DEFAULT_DEVICE_UID;
    doc["water_level_pct"] = packet.water_level_pct;
    doc["water_level_percentage"] = packet.water_level_pct;
    doc["water_level_liters"] = packet.water_liters;
    doc["flow_rate_lpm"] = packet.flow_rate_lpm;
    doc["inflow_rate_lpm"] = packet.flow_rate_lpm;
    doc["total_inflow_liters"] = packet.total_inflow_l;
    doc["total_inflow_l"] = packet.total_inflow_l;
    doc["tds_ppm"] = packet.tds_ppm;
    doc["temperature_c"] = packet.temperature_c;
    doc["pump_running"] = (pumpState == PUMP_ON);
    doc["current_amps"] = currentAmps;
    doc["subnode_online"] = true;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpCode = http.POST(jsonPayload);
    if (httpCode > 0) {
        Serial.printf("[HTTP REST TELEMETRY] Telemetry pushed to server (HTTP %d)\n", httpCode);
    }
    http.end();
}

void CloudClient::publishStatus(const char* status) {
    if (!mqttClient.connected()) return;
    StaticJsonDocument<128> doc;
    doc["status"] = status;
    doc["firmware"] = FIRMWARE_VERSION;
    doc["ip"] = wifiMgr.getLocalIp();
    doc["rssi"] = wifiMgr.getRssi();

    char buffer[128];
    serializeJson(doc, buffer);
    String topic = "devices/" DEFAULT_DEVICE_UID "/status";
    mqttClient.publish(topic.c_str(), buffer, true);
}

void CloudClient::onMqttMessage(char* topic, byte* payload, unsigned int length) {
    char message[1024];
    if (length >= sizeof(message)) length = sizeof(message) - 1;
    memcpy(message, payload, length);
    message[length] = '\0';

    Serial.printf("[MQTT] Received message on topic %s: %s\n", topic, message);

    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (error) {
        Serial.println("[MQTT] JSON parse error on incoming command");
        return;
    }

    const char* commandId = doc["command_id"] | "";
    const char* commandType = doc["command_type"] | "";

    if (strcmp(commandType, "START_PUMP") == 0) {
        bool ok = pumpCtrl.startPump("CLOUD_COMMAND");
        cloudClient.publishAck(
            commandId,
            ok ? "successful" : "failed",
            ok ? "ON" : "OFF",
            pumpCtrl.getCurrentAmps(),
            pumpCtrl.getRuntimeSeconds()
        );
    } else if (strcmp(commandType, "STOP_PUMP") == 0) {
        bool ok = pumpCtrl.stopPump("CLOUD_COMMAND");
        cloudClient.publishAck(
            commandId,
            ok ? "successful" : "failed",
            "OFF",
            0.0f,
            0
        );
    } else if (strcmp(commandType, "SET_MODE") == 0) {
        const char* modeStr = doc["payload"]["mode"] | "AUTOMATIC";
        if (strcmp(modeStr, "MANUAL") == 0) pumpCtrl.setMode(MODE_MANUAL);
        else if (strcmp(modeStr, "AUTOMATIC") == 0) pumpCtrl.setMode(MODE_AUTOMATIC);
        else if (strcmp(modeStr, "SCHEDULED") == 0) pumpCtrl.setMode(MODE_SCHEDULED);
        else if (strcmp(modeStr, "EMERGENCY_STOP") == 0) pumpCtrl.setMode(MODE_EMERGENCY_STOP);
        cloudClient.publishAck(commandId, "successful", (pumpCtrl.getState() == PUMP_ON) ? "ON" : "OFF", pumpCtrl.getCurrentAmps(), pumpCtrl.getRuntimeSeconds());
    } else if (strcmp(commandType, "EMERGENCY_STOP") == 0) {
        pumpCtrl.emergencyStop("REMOTE_EMERGENCY_TRIGGER");
        cloudClient.publishAck(commandId, "successful", "FAULT", 0.0f, 0);
    }
}
