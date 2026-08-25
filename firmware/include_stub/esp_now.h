#pragma once
#ifndef ESP_NOW_H_STUB
#define ESP_NOW_H_STUB

#include "Arduino.h"

#define ESP_NOW_ROLE_CONTROLLER 1
#define ESP_NOW_ROLE_SLAVE 2
#define ESP_NOW_ROLE_COMBO 3
#define ESP_OK 0

typedef enum {
    WIFI_IF_STA = 0,
    WIFI_IF_AP = 1,
} wifi_interface_t;

typedef struct {
    signed rssi : 8;
    unsigned rate : 4;
    unsigned is_group : 1;
    unsigned : 1;
    unsigned sig_mode : 2;
    unsigned legacy_length : 12;
    unsigned damatch0 : 1;
    unsigned damatch1 : 1;
    unsigned bssidmatch0 : 1;
    unsigned bssidmatch1 : 1;
    unsigned mcs : 7;
    unsigned cwb : 1;
    unsigned HT_length : 16;
    unsigned smoothing : 1;
    unsigned not_sounding : 1;
    unsigned : 1;
    unsigned aggregation : 1;
    unsigned stbc : 2;
    unsigned fec_coding : 1;
    unsigned sgi : 1;
    unsigned rxend_state : 8;
    unsigned ampdu_cnt : 8;
    unsigned channel : 4;
    unsigned : 4;
    signed noise_floor : 8;
} wifi_pkt_rx_ctrl_t;

typedef struct {
    uint8_t *src_addr;
    uint8_t *des_addr;
    wifi_pkt_rx_ctrl_t *rx_ctrl;
} esp_now_recv_info_t;

typedef struct esp_now_peer_info {
    uint8_t peer_addr[6];
    uint8_t lmk[16];
    uint8_t channel;
    wifi_interface_t ifidx;
    bool encrypt;
    void *priv;
} esp_now_peer_info_t;

typedef void (*esp_now_recv_cb_t)(const uint8_t *mac_addr, const uint8_t *data, int data_len);
typedef void (*esp_now_recv_info_cb_t)(const esp_now_recv_info_t *info, const uint8_t *data, int data_len);
typedef void (*esp8266_now_recv_cb_t)(uint8_t *mac_addr, uint8_t *data, uint8_t data_len);
typedef void (*esp_now_send_cb_t)(const uint8_t *mac_addr, uint8_t status);
typedef void (*esp8266_now_send_cb_t)(uint8_t *mac_addr, uint8_t status);

inline int esp_now_init() { return 0; }
inline int esp_now_deinit() { return 0; }
inline int esp_now_set_self_role(uint8_t role) { return 0; }
inline int esp_now_add_peer(const esp_now_peer_info_t *peer) { return 0; }
inline int esp_now_add_peer(const uint8_t *mac_addr, uint8_t role, uint8_t channel, const uint8_t *key, uint8_t key_len) { return 0; }
inline int esp_now_register_recv_cb(esp_now_recv_cb_t cb) { return 0; }
inline int esp_now_register_recv_cb(esp_now_recv_info_cb_t cb) { return 0; }
inline int esp_now_register_recv_cb(esp8266_now_recv_cb_t cb) { return 0; }
inline int esp_now_register_send_cb(esp_now_send_cb_t cb) { return 0; }
inline int esp_now_register_send_cb(esp8266_now_send_cb_t cb) { return 0; }
inline int esp_now_send(const uint8_t *mac_addr, const uint8_t *data, size_t len) { return 0; }
inline int esp_now_send(uint8_t *mac_addr, uint8_t *data, int len) { return 0; }

#endif // ESP_NOW_H_STUB
