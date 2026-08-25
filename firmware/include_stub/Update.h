#pragma once
#ifndef UPDATE_H_STUB
#define UPDATE_H_STUB

#include "Arduino.h"
#include "WiFi.h"

#define U_FLASH 0

class UpdateClass {
public:
    bool begin(size_t size = 0, int command = U_FLASH) { return true; }
    size_t writeStream(WiFiClient& data) { return 1024; }
    bool end(bool evenIfRunning = false) { return true; }
    bool isFinished() { return true; }
    bool hasError() { return false; }
    uint8_t getError() { return 0; }
    void printError(HardwareSerial& out) {}
};

extern UpdateClass Update;

#endif // UPDATE_H_STUB
