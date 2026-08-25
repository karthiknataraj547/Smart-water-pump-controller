#ifndef AUTOMATION_ENGINE_H
#define AUTOMATION_ENGINE_H

#include <Arduino.h>
#include "../include/config.h"

class AutomationEngine {
public:
    AutomationEngine();
    void begin();
    void update();

    void setAutoThresholds(float lowStartPct, float highStopPct);
    float getLowStartPct() const { return lowStartThreshold; }
    float getHighStopPct() const { return highStopThreshold; }

private:
    float lowStartThreshold;
    float highStopThreshold;
    uint32_t zeroFlowStartTime;

    void evaluateLocalRules();
};

extern AutomationEngine autoEngine;

#endif // AUTOMATION_ENGINE_H
