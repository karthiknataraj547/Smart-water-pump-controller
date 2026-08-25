#pragma once
#ifndef ESP_IDF_VERSION_H
#define ESP_IDF_VERSION_H

#ifndef ESP_IDF_VERSION_VAL
#define ESP_IDF_VERSION_VAL(major, minor, patch) ((major << 16) | (minor << 8) | (patch))
#endif

#ifndef ESP_IDF_VERSION
#define ESP_IDF_VERSION ESP_IDF_VERSION_VAL(4, 4, 0)
#endif

#endif // ESP_IDF_VERSION_H
