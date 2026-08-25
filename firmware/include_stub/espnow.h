#pragma once
#ifndef ESPNOW_H_STUB
#define ESPNOW_H_STUB

#include "esp_now.h" // IWYU pragma: export

#define ESP_NOW_ROLE_CONTROLLER 1
#define ESP_NOW_ROLE_SLAVE      2

inline int esp_now_set_self_role(int role) { return 0; }
inline int esp_now_add_peer(const uint8_t *mac_addr, int role, uint8_t channel, const uint8_t *key, uint8_t key_len) { return 0; }

#endif // ESPNOW_H_STUB
