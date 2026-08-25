#ifndef FLOW_SENSOR_H
#define FLOW_SENSOR_H

#include <Arduino.h>
#include "../include/config.h"

class FlowSensor {
public:
    FlowSensor();
    void begin();
    void update();

    float getFlowRateLpm() const { return currentFlowRateLpm; }
    float getTotalLiters() const { return totalInflowLiters; }
    static void IRAM_ATTR onPulseInterrupt();

private:
    float currentFlowRateLpm;
    float totalInflowLiters;
    uint32_t lastCalcTime;
};

extern FlowSensor flowSensor;

#endif // FLOW_SENSOR_H
