#ifndef DEVICE_AUTH_H
#define DEVICE_AUTH_H

#include <Arduino.h>
#include "../include/config.h"

class DeviceAuth {
public:
    DeviceAuth();
    void begin();
    String generateChallengeSignature(const char* nonce, uint32_t timestamp);
    bool verifyDeviceToken(const char* token);
    const char* getDeviceUid() const { return DEFAULT_DEVICE_UID; }
    const char* getHardwareRevision() const { return HARDWARE_REVISION; }

private:
    char deviceSecretKey[64];
    void loadDeviceSecret();
};

extern DeviceAuth deviceAuth;

#endif // DEVICE_AUTH_H
