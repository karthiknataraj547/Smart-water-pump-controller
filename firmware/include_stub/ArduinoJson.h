#ifndef ARDUINO_JSON_H_STUB
#define ARDUINO_JSON_H_STUB

#include "Arduino.h"

class JsonObject;
class JsonArray;

class JsonVariant {
public:
    JsonVariant() {}
    
    template<typename T>
    JsonVariant& operator=(const T& v) { return *this; }

    JsonVariant operator[](const char* key) const { return JsonVariant(); }
    JsonVariant operator[](int index) const { return JsonVariant(); }

    template<typename T>
    operator T() const { return T(); }

    operator const char*() const { return ""; }
    operator String() const { return String(""); }
    operator int() const { return 0; }
    operator float() const { return 0.0f; }
    operator bool() const { return false; }

    template<typename T>
    T operator|(const T& fallback) const { return fallback; }
    
    const char* operator|(const char* fallback) const { return fallback; }
};

class JsonObject {
public:
    JsonObject() {}
    
    JsonVariant operator[](const char* key) const { return JsonVariant(); }
    JsonVariant operator[](const String& key) const { return JsonVariant(); }
    bool containsKey(const char* key) const { return false; }
};

class JsonArray {
public:
    JsonArray() {}
    JsonObject createNestedObject() { return JsonObject(); }
    JsonVariant operator[](size_t index) const { return JsonVariant(); }
    size_t size() const { return 0; }
    template<typename T>
    bool add(T v) { return true; }
};

template<size_t CAPACITY>
class StaticJsonDocument {
public:
    StaticJsonDocument() {}
    
    JsonObject as() { return JsonObject(); }
    
    template<typename T>
    void set(T v) {}

    JsonArray createNestedArray(const char* key) { return JsonArray(); }
    JsonObject createNestedObject(const char* key) { return JsonObject(); }

    JsonVariant operator[](const char* key) { return JsonVariant(); }
    const JsonVariant operator[](const char* key) const { return JsonVariant(); }

    JsonVariant operator[](const String& key) { return JsonVariant(); }
    const JsonVariant operator[](const String& key) const { return JsonVariant(); }
};

class DeserializationError {
public:
    enum Code { Ok = 0, InvalidInput, NoMemory };
    Code code() const { return Ok; }
    operator bool() const { return false; }
    bool operator==(Code c) const { return c == Ok; }
    bool operator!=(Code c) const { return c != Ok; }
    const char* c_str() const { return "Ok"; }
};

template<typename TDoc>
DeserializationError deserializeJson(TDoc& doc, const char* input) {
    return DeserializationError();
}

template<typename TDoc>
DeserializationError deserializeJson(TDoc& doc, const char* input, size_t length) {
    return DeserializationError();
}

template<typename TDoc>
DeserializationError deserializeJson(TDoc& doc, const uint8_t* input, size_t length) {
    return DeserializationError();
}

template<typename TDoc>
DeserializationError deserializeJson(TDoc& doc, const String& input) {
    return DeserializationError();
}

template<typename TDoc>
size_t serializeJson(const TDoc& doc, String& output) {
    output = "{}";
    return output.length();
}

template<typename TDoc>
size_t serializeJson(const TDoc& doc, char* output) {
    if (output) strcpy(output, "{}");
    return 2;
}

template<typename TDoc>
size_t serializeJson(const TDoc& doc, char* output, size_t maxLen) {
    if (output && maxLen > 2) strcpy(output, "{}");
    return 2;
}

#endif // ARDUINO_JSON_H_STUB
