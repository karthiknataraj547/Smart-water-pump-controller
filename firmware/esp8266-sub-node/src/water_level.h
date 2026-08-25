#ifndef WATER_LEVEL_H
#define WATER_LEVEL_H

#include <Arduino.h>
#include "../include/config.h"

class WaterLevelSensor {
public:
    WaterLevelSensor();
    void begin();
    void update();

    float getLevelPercentage() const { return levelPct; }
    float getVolumeLiters() const { return volumeLiters; }
    float getRawDistanceCm() const { return rawDistanceCm; }
    bool isHealthy() const { return healthy; }

private:
    float levelPct;
    float volumeLiters;
    float rawDistanceCm;
    bool healthy;
    float samples[5];
    uint8_t sampleIndex;

    float measureDistanceCm();
    float getMedianFilteredDistance();
};

extern WaterLevelSensor waterLevel;

#endif // WATER_LEVEL_H
