#pragma once
#ifndef ARDUINO_H_STUB
#define ARDUINO_H_STUB

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <string>

#ifndef NULL
#define NULL ((void*)0)
#endif

#ifndef UINT32_MAX
#define UINT32_MAX 0xFFFFFFFFU
#endif

#ifndef ESP_IDF_VERSION_VAL
#define ESP_IDF_VERSION_VAL(major, minor, patch) ((major << 16) | (minor << 8) | (patch))
#endif

// Standard C library declarations for host IDE language servers
extern "C" {
    size_t strlen(const char *s);
    char *strcpy(char *dest, const char *src);
    char *strncpy(char *dest, const char *src, size_t n);
    char *strcat(char *dest, const char *src);
    char *strncat(char *dest, const char *src, size_t n);
    int strcmp(const char *s1, const char *s2);
    int strncmp(const char *s1, const char *s2, size_t n);
    char *strchr(const char *s, int c);
    char *strstr(const char *haystack, const char *needle);
    void *memset(void *s, int c, size_t n);
    void *memcpy(void *dest, const void *src, size_t n);
    int snprintf(char *str, size_t size, const char *format, ...);
    int sprintf(char *str, const char *format, ...);
    int atoi(const char *nptr);
    double atof(const char *nptr);
    double pow(double base, double exp);
    double fabs(double x);
    float fabsf(float x);
    int abs(int x);
}

// Arduino Constants
#define HIGH 0x1
#define LOW  0x0
#define INPUT 0x0
#define OUTPUT 0x1
#define INPUT_PULLUP 0x2
#define RISING 0x01
#define FALLING 0x02
#define CHANGE 0x03

#define D1 5
#define D2 4
#define D4 2
#define D5 14
#define D6 12
#define D7 13
#define A0 0

#define ESP_OK 0
#define ESP_FAIL -1

typedef uint8_t byte;

// Self-contained Arduino String class stub
class String {
private:
    char _buffer[256];

public:
    String() { _buffer[0] = '\0'; }
    String(const char* s) {
        if (s) {
            strncpy(_buffer, s, sizeof(_buffer) - 1);
            _buffer[sizeof(_buffer) - 1] = '\0';
        } else {
            _buffer[0] = '\0';
        }
    }
    String(int v) { snprintf(_buffer, sizeof(_buffer), "%d", v); }
    String(unsigned int v) { snprintf(_buffer, sizeof(_buffer), "%u", v); }
    String(float v, int dec = 2) { snprintf(_buffer, sizeof(_buffer), "%.2f", v); }
    String(double v, int dec = 2) { snprintf(_buffer, sizeof(_buffer), "%.2f", v); }
    String(const String& other) { strncpy(_buffer, other._buffer, sizeof(_buffer)); }

    String& operator=(const String& other) {
        if (this != &other) {
            strncpy(_buffer, other._buffer, sizeof(_buffer));
        }
        return *this;
    }
    String& operator=(const char* s) {
        if (s) {
            strncpy(_buffer, s, sizeof(_buffer) - 1);
            _buffer[sizeof(_buffer) - 1] = '\0';
        } else {
            _buffer[0] = '\0';
        }
        return *this;
    }

    String operator+(const String& other) const {
        String res(*this);
        strncat(res._buffer, other._buffer, sizeof(res._buffer) - strlen(res._buffer) - 1);
        return res;
    }

    String operator+(const char* s) const {
        String res(*this);
        if (s) {
            strncat(res._buffer, s, sizeof(res._buffer) - strlen(res._buffer) - 1);
        }
        return res;
    }

    bool operator==(const String& other) const { return strcmp(_buffer, other._buffer) == 0; }
    bool operator==(const char* s) const { return s ? strcmp(_buffer, s) == 0 : false; }
    bool operator!=(const String& other) const { return strcmp(_buffer, other._buffer) != 0; }
    bool operator!=(const char* s) const { return s ? strcmp(_buffer, s) != 0 : true; }

    int toInt() const { return atoi(_buffer); }
    float toFloat() const { return (float)atof(_buffer); }
    const char* c_str() const { return _buffer; }
    size_t length() const { return strlen(_buffer); }
    int indexOf(char ch, unsigned int fromIndex = 0) const {
        if (fromIndex >= strlen(_buffer)) return -1;
        const char* p = strchr(_buffer + fromIndex, ch);
        return p ? (int)(p - _buffer) : -1;
    }
    int indexOf(const char* s, unsigned int fromIndex = 0) const {
        if (!s || fromIndex >= strlen(_buffer)) return -1;
        const char* p = strstr(_buffer + fromIndex, s);
        return p ? (int)(p - _buffer) : -1;
    }
    int indexOf(const String& s, unsigned int fromIndex = 0) const {
        return indexOf(s.c_str(), fromIndex);
    }
    String substring(unsigned int from, unsigned int to = 0) const {
        size_t len = strlen(_buffer);
        if (from >= len) return String("");
        if (to == 0 || to > len) to = (unsigned int)len;
        if (to <= from) return String("");
        char temp[256];
        size_t copyLen = to - from;
        if (copyLen >= sizeof(temp)) copyLen = sizeof(temp) - 1;
        strncpy(temp, _buffer + from, copyLen);
        temp[copyLen] = '\0';
        return String(temp);
    }
    void trim() {}
    bool startsWith(const char* prefix) const {
        if (!prefix) return false;
        return strncmp(_buffer, prefix, strlen(prefix)) == 0;
    }
    bool startsWith(const String& prefix) const {
        return startsWith(prefix.c_str());
    }
    bool endsWith(const char* suffix) const {
        if (!suffix) return false;
        size_t len = strlen(_buffer);
        size_t slen = strlen(suffix);
        if (slen > len) return false;
        return strcmp(_buffer + len - slen, suffix) == 0;
    }
    bool endsWith(const String& suffix) const {
        return endsWith(suffix.c_str());
    }
    bool equalsIgnoreCase(const char* s) const {
        if (!s) return false;
        size_t len = strlen(_buffer);
        if (len != strlen(s)) return false;
        for (size_t i = 0; i < len; i++) {
            char a = _buffer[i];
            char b = s[i];
            if (a >= 'A' && a <= 'Z') a += 32;
            if (b >= 'A' && b <= 'Z') b += 32;
            if (a != b) return false;
        }
        return true;
    }
    bool equalsIgnoreCase(const String& s) const {
        return equalsIgnoreCase(s.c_str());
    }
};

inline String operator+(const char* a, const String& b) {
    String res(a);
    return res + b;
}

// Serial mock
class HardwareSerial {
public:
    void begin(unsigned long baud) {}
    int available() { return 0; }
    int read() { return -1; }
    String readStringUntil(char terminator) { return String(""); }
    void print(const char* s) {}
    void print(int v) {}
    void print(float v) {}
    void print(const String& s) {}
    void println(const char* s = "") {}
    void println(int v) {}
    void println(float v) {}
    void println(const String& s) {}
    void printf(const char* format, ...) {}
};
extern HardwareSerial Serial;

// Basic Arduino core functions
inline unsigned long millis() { return 0; }
inline unsigned long micros() { return 0; }
inline void delay(unsigned long ms) {}
inline void delayMicroseconds(unsigned int us) {}
inline void pinMode(uint8_t pin, uint8_t mode) {}
inline void digitalWrite(uint8_t pin, uint8_t val) {}
inline int digitalRead(uint8_t pin) { return 0; }
inline int analogRead(uint8_t pin) { return 0; }
inline void attachInterrupt(uint8_t pin, void (*userFunc)(void), int mode) {}
inline void detachInterrupt(uint8_t pin) {}
inline void interrupts() {}
inline void noInterrupts() {}
inline void yield() {}
inline unsigned long pulseIn(uint8_t pin, uint8_t state, unsigned long timeout = 1000000L) { return 0; }
inline uint8_t digitalPinToInterrupt(uint8_t pin) { return pin; }
#ifndef IRAM_ATTR
#define IRAM_ATTR
#endif
#ifndef ICACHE_RAM_ATTR
#define ICACHE_RAM_ATTR
#endif

inline float abs(float x) { return x < 0.0f ? -x : x; }
inline double abs(double x) { return x < 0.0 ? -x : x; }
inline int abs(int x) { return x < 0 ? -x : x; }
inline long random(long min, long max) { return min; }
inline long random(long max) { return 0; }

// FreeRTOS types & macros
#ifndef _TASK_HANDLE_T_DEFINED
#define _TASK_HANDLE_T_DEFINED
typedef void* TaskHandle_t;
#endif

#ifndef _TASK_FUNCTION_T_DEFINED
#define _TASK_FUNCTION_T_DEFINED
typedef void (*TaskFunction_t)(void*);
#endif

#define pdMS_TO_TICKS(ms) (ms)
#define portMAX_DELAY 0xFFFFFFFF
inline void vTaskDelay(unsigned long ticks) {}
inline void xTaskCreatePinnedToCore(TaskFunction_t pvTaskCode, const char * const pcName, const uint32_t usStackDepth, void * const pvParameters, unsigned int uxPriority, TaskHandle_t * const pvCreatedTask, const int xCoreID) {}

#include "esp_task_wdt.h"

// ESP system mock
class ESPClass {
public:
    void restart() {}
    uint32_t getFreeHeap() { return 200000; }
    uint32_t getHeapSize() { return 320000; }
    uint32_t getMinFreeHeap() { return 180000; }
    uint32_t getMaxAllocHeap() { return 100000; }
    uint32_t getCpuFreqMHz() { return 240; }
    uint32_t getSdkVersion() { return 4; }
    const char* getChipModel() { return "ESP32-D0WDQ6"; }
    uint8_t getChipRevision() { return 1; }
};
extern ESPClass ESP;

#endif // ARDUINO_H_STUB
