# 07 — BLE & Wi-Fi Device Provisioning Guide

## 1. Provisioning Workflow
The device provisioning process delivers a seamless commercial smart-home experience:

```mermaid
sequenceDiagram
    participant User as Operator / Home Owner
    participant App as Android Mobile App
    participant ESP32 as ESP32 Main Node
    participant Cloud as Backend Gateway

    User->>ESP32: Long press physical button (5 sec)
    ESP32->>ESP32: Enters BLE Advertising Mode (Blue LED blinks fast)
    User->>App: Tap "Add New Device" -> "Water Pump Controller"
    App->>App: Scans BLE GATT Advertisements
    App->>User: Displays "Water Pump Controller (WPC-A81F29) - Excellent Signal"
    User->>App: Selects WPC-A81F29 & enters Wi-Fi SSID / Password
    App->>ESP32: Writes SSID & Encrypted Password to BLE GATT Characteristics
    ESP32->>ESP32: Saves credentials to NVS Flash & Connects to Wi-Fi
    ESP32->>Cloud: Authenticates with Cloud Gateway over MQTT/TLS
    Cloud-->>App: Confirms Device Registered & Active
    App-->>User: Displays "Device Successfully Connected!"
```

## 2. BLE Custom GATT Service UUIDs
- **Service UUID**: `0000ffff-0000-1000-8000-00805f9b34fb`
- **Characteristic UUIDs**:
  - `0000fff1-0000-1000-8000-00805f9b34fb`: Device Identity (Read)
  - `0000fff2-0000-1000-8000-00805f9b34fb`: Wi-Fi SSID (Write)
  - `0000fff3-0000-1000-8000-00805f9b34fb`: Wi-Fi Password (Write)
  - `0000fff4-0000-1000-8000-00805f9b34fb`: Server URL (Write)
  - `0000fff5-0000-1000-8000-00805f9b34fb`: Provisioning Status (Read/Notify)
