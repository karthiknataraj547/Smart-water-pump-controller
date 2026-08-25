#include "ota_manager.h"
#include <HTTPClient.h>

OtaManager otaMgr;

OtaManager::OtaManager() : updating(false), progressPct(0) {}

void OtaManager::begin() {
    Serial.println("[OTA] Over-The-Air Update Service Ready");
}

bool OtaManager::performOtaUpdate(const char* url, const char* expectedSha256) {
    if (!url || strlen(url) == 0) return false;

    Serial.printf("[OTA] Initiating Firmware Download from: %s\n", url);
    updating = true;
    progressPct = 0;

    HTTPClient http;
    http.begin(url);
    int httpCode = http.GET();

    if (httpCode != HTTP_CODE_OK) {
        Serial.printf("[OTA] HTTP GET failed, error: %s\n", http.errorToString(httpCode).c_str());
        http.end();
        updating = false;
        return false;
    }

    int contentLength = http.getSize();
    if (contentLength <= 0) {
        Serial.println("[OTA] Invalid firmware content length");
        http.end();
        updating = false;
        return false;
    }

    bool canBegin = Update.begin(contentLength);
    if (!canBegin) {
        Serial.println("[OTA] Not enough space on flash partition to begin OTA");
        http.end();
        updating = false;
        return false;
    }

    WiFiClient* stream = http.getStreamPtr();
    size_t written = Update.writeStream(*stream);

    if (written == (size_t)contentLength) {
        Serial.printf("[OTA] Written %u bytes successfully\n", (unsigned int)written);
    } else {
        Serial.printf("[OTA] Written only %u/%d bytes\n", (unsigned int)written, contentLength);
    }

    if (Update.end()) {
        if (Update.isFinished()) {
            Serial.println("[OTA] Firmware Upgrade Successful! Rebooting in 3 seconds...");
            delay(3000);
            ESP.restart();
            return true;
        } else {
            Serial.println("[OTA] Update not finished? Error occurred.");
        }
    } else {
        Serial.printf("[OTA] Update Error occurred. Error #: %u\n", Update.getError());
    }

    http.end();
    updating = false;
    return false;
}
