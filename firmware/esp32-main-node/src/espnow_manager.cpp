#include "espnow_manager.h"

EspNowManager espNowMgr;

EspNowManager::EspNowManager()
    : lastPacketTimestamp(0), lastSequenceNum(0), packetsReceived(0), crcErrors(0) {
    memset(&latestPacket, 0, sizeof(latestPacket));
}

bool EspNowManager::begin() {
    WiFi.mode(WIFI_AP_STA);
    
    if (esp_now_init() != ESP_OK) {
        Serial.println("[ESP-NOW] Error initializing ESP-NOW");
        return false;
    }

    esp_now_register_recv_cb(onDataRecv);
    Serial.println("[ESP-NOW] ESP-NOW Receiver Initialized and Listening on Channel 1");
    return true;
}

void EspNowManager::update() {
    // Check heartbeat timeout
    if (lastPacketTimestamp > 0 && getLastPacketAgeMs() > SUBNODE_TIMEOUT_MS) {
        // Heartbeat timeout detected
    }
}

bool EspNowManager::isSubnodeConnected() const {
    if (lastPacketTimestamp == 0) return false;
    return getLastPacketAgeMs() <= SUBNODE_TIMEOUT_MS;
}

uint32_t EspNowManager::getLastPacketAgeMs() const {
    if (lastPacketTimestamp == 0) return UINT32_MAX;
    return millis() - lastPacketTimestamp;
}

uint16_t EspNowManager::calculateCrc16(const uint8_t *data, size_t length) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < length; i++) {
        crc ^= (uint16_t)data[i] << 8;
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021; // CCITT polynomial
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}

void EspNowManager::onDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
    if (len != sizeof(TankTelemetryPacket)) {
        Serial.printf("[ESP-NOW] Invalid packet size: %d (expected %d)\n", len, (int)sizeof(TankTelemetryPacket));
        return;
    }

    TankTelemetryPacket packet;
    memcpy(&packet, incomingData, sizeof(TankTelemetryPacket));

    if (packet.magic != 0xAA) {
        Serial.printf("[ESP-NOW] Invalid magic byte: 0x%02X\n", packet.magic);
        return;
    }

    // Verify CRC16
    uint16_t computedCrc = calculateCrc16(incomingData, sizeof(TankTelemetryPacket) - sizeof(uint16_t));
    if (computedCrc != packet.crc16) {
        Serial.printf("[ESP-NOW] CRC Mismatch! Computed: 0x%04X, Received: 0x%04X\n", computedCrc, packet.crc16);
        espNowMgr.crcErrors++;
        return;
    }

    espNowMgr.latestPacket = packet;
    espNowMgr.lastPacketTimestamp = millis();
    espNowMgr.packetsReceived++;
    espNowMgr.lastSequenceNum = packet.sequence_num;

    Serial.printf("[ESP-NOW] Packet #%u Recv | Level: %.1f%% (%.0fL) | Flow: %.1f L/m | TDS: %.0f ppm | Temp: %.1f°C | Batt: %umV\n",
                  packet.sequence_num, packet.water_level_pct, packet.water_liters, packet.flow_rate_lpm,
                  packet.tds_ppm, packet.temperature_c, packet.battery_mv);
}
