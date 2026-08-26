#pragma once
#ifndef DNS_SERVER_H_STUB
#define DNS_SERVER_H_STUB

#include "Arduino.h"
#include "WiFi.h"

class DNSServer {
public:
    DNSServer() {}
    bool start(uint16_t port, const String& domainName, const IPAddress& resolvedIP) { return true; }
    void processNextRequest() {}
    void stop() {}
};

#endif // DNS_SERVER_H_STUB
