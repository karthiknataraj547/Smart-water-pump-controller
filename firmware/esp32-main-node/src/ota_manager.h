#ifndef OTA_MANAGER_H
#define OTA_MANAGER_H

#include <Arduino.h>
#include <Update.h>
#include <WiFiClientSecure.h>
#include "../include/config.h"

class OtaManager {
public:
    OtaManager();
    void begin();
    bool performOtaUpdate(const char* url, const char* expectedSha256 = nullptr);
    int getProgressPercentage() const { return progressPct; }
    bool isUpdating() const { return updating; }

private:
    bool updating;
    int progressPct;
};

extern OtaManager otaMgr;

#endif // OTA_MANAGER_H
