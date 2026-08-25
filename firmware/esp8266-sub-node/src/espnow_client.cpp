#include "espnow_client.h"

EspNowClient espNowClient;

EspNowClient::EspNowClient() 
    : sequenceNum(1), packetsSent(0), packetsFailed(0) {}

bool EspNowClient::begin() {
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();

    if (esp_now_init() != 0) {
        Serial.println("[ESP-NOW] Initialization failed on Sub Node");
        return false;
    }

    esp_now_set_self_role(ESP_NOW_ROLE_CONTROLLER);
    esp_now_register_send_cb(onDataSent);

    // Register broadcast / target peer
    uint8_t targetMac[6];
    memcpy(targetMac, MAIN_NODE_MAC, 6);
    esp_now_add_peer(targetMac, ESP_NOW_ROLE_SLAVE, ESPNOW_CHANNEL, NULL, 0);

    Serial.println("[ESP-NOW] Sub Node ESP-NOW Client Initialized Successfully");
    return true;
}

uint16_t EspNowClient::calculateCrc16(const uint8_t *data, size_t length) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < length; i++) {
        crc ^= (uint16_t)data[i] << 8;
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}

bool EspNowClient::sendTelemetry(float levelPct, float volumeL, float flowLpm, float totalInflowL, float tdsPpm, float tempC, uint8_t healthMask, uint16_t battMv) {
    TankTelemetryPacket packet;
    packet.magic = 0xAA;
    packet.node_id = 0x01;
    packet.sequence_num = sequenceNum++;
    packet.water_level_pct = levelPct;
    packet.water_liters = volumeL;
    packet.flow_rate_lpm = flowLpm;
    packet.total_inflow_l = totalInflowL;
    packet.tds_ppm = tdsPpm;
    packet.temperature_c = tempC;
    packet.sensor_health = healthMask;
    packet.battery_mv = battMv;

    // Compute CRC16 over packet payload (excluding crc16 field itself)
    packet.crc16 = calculateCrc16((const uint8_t*)&packet, sizeof(TankTelemetryPacket) - sizeof(uint16_t));

    uint8_t targetMac[6];
    memcpy(targetMac, MAIN_NODE_MAC, 6);
    int result = esp_now_send(targetMac, (uint8_t*)&packet, sizeof(TankTelemetryPacket));

    if (result == 0) {
        packetsSent++;
        return true;
    } else {
        packetsFailed++;
        Serial.printf("[ESP-NOW] Send failed with error code: %d\n", result);
        return false;
    }
}

void EspNowClient::onDataSent(uint8_t *mac, uint8_t status) {
    if (status == 0) {
        // Transmission successful
    } else {
        Serial.println("[ESP-NOW] Delivery ACK failed (ESP32 may be out of range)");
    }
}
