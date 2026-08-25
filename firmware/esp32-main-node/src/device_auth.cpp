#include "device_auth.h"
#include <mbedtls/md.h>
#include <Preferences.h>

DeviceAuth deviceAuth;

DeviceAuth::DeviceAuth() {
    memset(deviceSecretKey, 0, sizeof(deviceSecretKey));
}

void DeviceAuth::begin() {
    loadDeviceSecret();
    Serial.printf("[DeviceAuth] Hardware Identity Loaded for UID: %s (HW: %s)\n",
                  getDeviceUid(), getHardwareRevision());
}

void DeviceAuth::loadDeviceSecret() {
    Preferences prefs;
    prefs.begin("dev_sec", true);
    String key = prefs.getString("secret", "DEV_HMAC_SECRET_9823479823749823");
    prefs.end();
    strncpy(deviceSecretKey, key.c_str(), sizeof(deviceSecretKey) - 1);
}

String DeviceAuth::generateChallengeSignature(const char* nonce, uint32_t timestamp) {
    String payload = String(DEFAULT_DEVICE_UID) + ":" + String(nonce) + ":" + String(timestamp);
    
    byte hmacResult[32];
    mbedtls_md_context_t ctx;
    mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
    mbedtls_md_hmac_starts(&ctx, (const unsigned char*)deviceSecretKey, strlen(deviceSecretKey));
    mbedtls_md_hmac_update(&ctx, (const unsigned char*)payload.c_str(), payload.length());
    mbedtls_md_hmac_finish(&ctx, hmacResult);
    mbedtls_md_free(&ctx);

    char hexStr[65];
    for (int i = 0; i < 32; i++) {
        sprintf(&hexStr[i * 2], "%02x", (unsigned int)hmacResult[i]);
    }
    hexStr[64] = '\0';
    return String(hexStr);
}

bool DeviceAuth::verifyDeviceToken(const char* token) {
    return (token != nullptr && strlen(token) > 10);
}
