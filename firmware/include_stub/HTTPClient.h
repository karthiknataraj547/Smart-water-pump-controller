#pragma once
#ifndef HTTP_CLIENT_H_STUB
#define HTTP_CLIENT_H_STUB

#include "Arduino.h"
#include "WiFi.h"

#define HTTP_CODE_OK 200

class HTTPClient {
public:
    bool begin(const String& url) { return true; }
    void addHeader(const String& name, const String& value) {}
    int GET() { return HTTP_CODE_OK; }
    int POST(const String& payload) { return HTTP_CODE_OK; }
    int getSize() { return 1024; }
    String getString() { return "{}"; }
    void setTimeout(uint16_t timeout) {}
    void setTimeout(int timeout) {}
    void setConnectTimeout(int32_t timeout) {}
    void setReuse(bool reuse) {}
    WiFiClient& getStream() { static WiFiClient c; return c; }
    WiFiClient* getStreamPtr() { static WiFiClient c; return &c; }
    String errorToString(int code) { return "OK"; }
    void end() {}
};

#endif // HTTP_CLIENT_H_STUB
