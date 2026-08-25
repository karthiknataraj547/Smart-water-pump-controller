#pragma once
#ifndef WEBSERVER_H_STUB
#define WEBSERVER_H_STUB

#include "Arduino.h"

// PROGMEM storage macro (no-op on host)
#ifndef PROGMEM
#define PROGMEM
#endif

typedef void (*THandlerFunction)(void);

enum HTTPMethod {
    HTTP_ANY     = 0,
    HTTP_GET     = 1,
    HTTP_POST    = 2,
    HTTP_PUT     = 3,
    HTTP_PATCH   = 4,
    HTTP_DELETE  = 5,
    HTTP_OPTIONS = 6
};

class WebServer {
public:
    WebServer(int port = 80) {}
    void begin() {}
    void stop() {}
    void handleClient() {}
    void on(const String& uri, THandlerFunction handler) {}
    void on(const String& uri, int method, THandlerFunction handler) {}
    void onNotFound(THandlerFunction handler) {}
    void send(int code, const char* contentType = "text/plain", const char* content = "") {}
    void send(int code, const char* contentType, const String& content) {}
    void send(int code, const String& contentType, const String& content) {}
    void sendHeader(const String& name, const String& value, bool first = false) {}
    String arg(const String& name) { return ""; }
    bool hasArg(const String& name) { return false; }
    String header(const String& name) { return ""; }
    String header(const char* name) { return ""; }
    bool hasHeader(const String& name) { return false; }
    bool hasHeader(const char* name) { return false; }
};

#endif // WEBSERVER_H_STUB
