#ifndef TDS_SENSOR_H
#define TDS_SENSOR_H

#include <Arduino.h>
#include "../include/config.h"

class TdsSensor {
public:
    TdsSensor();
    void begin();
    void update(float currentTemperatureC = 25.0f);

    float getTdsPpm() const { return tdsPpm; }
    float getTemperatureC() const { return temperatureC; }
    bool isHealthy() const { return healthy; }

private:
    float tdsPpm;
    float temperatureC;
    bool healthy;
    float samples[10];
    uint8_t sampleIdx;
};

extern TdsSensor tdsSensor;

#endif // TDS_SENSOR_H
