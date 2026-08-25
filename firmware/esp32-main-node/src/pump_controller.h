#ifndef PUMP_CONTROLLER_H
#define PUMP_CONTROLLER_H

#include <Arduino.h>
#include "../include/config.h"

enum PumpState {
    PUMP_OFF = 0,
    PUMP_ON = 1,
    PUMP_FAULT = 2,
    PUMP_STARTING = 3,
    PUMP_STOPPING = 4
};

enum PumpMode {
    MODE_MANUAL = 0,
    MODE_AUTOMATIC = 1,
    MODE_SCHEDULED = 2,
    MODE_EMERGENCY_STOP = 3
};

class PumpController {
public:
    PumpController();
    void begin();
    void update();
    
    bool startPump(const char* reason = "MANUAL");
    bool stopPump(const char* reason = "MANUAL");
    void emergencyStop(const char* reason = "EMERGENCY");
    void setMode(PumpMode mode);
    
    PumpState getState() const { return currentState; }
    PumpMode getMode() const { return currentMode; }
    uint32_t getRuntimeSeconds() const;
    float getCurrentAmps() const { return currentAmps; }
    bool isFaulted() const { return isFault; }
    const char* getLastFaultReason() const { return lastFaultReason; }
    void clearFault();

private:
    PumpState currentState;
    PumpMode currentMode;
    uint32_t startTimestamp;
    float currentAmps;
    bool isFault;
    char lastFaultReason[64];

    void readSensors();
    void setRelayOutput(bool enable);
};

extern PumpController pumpCtrl;

#endif // PUMP_CONTROLLER_H
