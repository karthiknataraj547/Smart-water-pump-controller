#pragma once
#ifndef ESP_TASK_WDT_H
#define ESP_TASK_WDT_H

#include <stdint.h>
#include <stdbool.h>

#ifndef _TASK_HANDLE_T_DEFINED
#define _TASK_HANDLE_T_DEFINED
typedef void* TaskHandle_t;
#endif

inline int esp_task_wdt_init(uint32_t timeout, bool panic) { return 0; }
inline int esp_task_wdt_add(TaskHandle_t handle) { return 0; }
inline int esp_task_wdt_reset() { return 0; }
inline int esp_task_wdt_delete(TaskHandle_t handle) { return 0; }

#endif // ESP_TASK_WDT_H
