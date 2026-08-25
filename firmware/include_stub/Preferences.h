#pragma once
#ifndef PREFERENCES_H_STUB
#define PREFERENCES_H_STUB

#include "Arduino.h"

class Preferences {
public:
    bool begin(const char * name, bool readOnly = false, const char * partition_label = NULL) { return true; }
    void end() {}
    bool clear() { return true; }

    // String
    size_t putString(const char* key, const String value) { return value.length(); }
    size_t putString(const char* key, const char* value) { return String(value).length(); }
    String getString(const char* key, const String defaultValue = String()) { return defaultValue; }

    // Integer
    size_t putInt(const char* key, int32_t value) { return 4; }
    int32_t getInt(const char* key, int32_t defaultValue = 0) { return defaultValue; }

    // Unsigned Integer
    size_t putUInt(const char* key, uint32_t value) { return 4; }
    uint32_t getUInt(const char* key, uint32_t defaultValue = 0) { return defaultValue; }

    // Bool
    size_t putBool(const char* key, bool value) { return 1; }
    bool getBool(const char* key, bool defaultValue = false) { return defaultValue; }

    // Float
    size_t putFloat(const char* key, float value) { return 4; }
    float getFloat(const char* key, float defaultValue = 0.0f) { return defaultValue; }

    // Bytes
    size_t putBytes(const char* key, const void* value, size_t len) { return len; }
    size_t getBytes(const char* key, void* buf, size_t maxLen) { return 0; }

    bool remove(const char* key) { return true; }
};

#endif // PREFERENCES_H_STUB
