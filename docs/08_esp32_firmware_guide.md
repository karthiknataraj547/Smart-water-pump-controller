# 08 — ESP32 Main Node Firmware Architecture & Flashing Guide

## 1. Multi-Core FreeRTOS Partitioning
The ESP32 dual-core processor is partitioned to guarantee safety-critical real-time response times:

```text
┌────────────────────────────────────────────────────────┐
│                   ESP32 DUAL-CORE CPU                  │
├───────────────────────────┬────────────────────────────┤
│          CORE 0           │           CORE 1           │
│   (Networking & Cloud)    │   (Safety & Automation)    │
├───────────────────────────┼────────────────────────────┤
│ • Wi-Fi Station & AP      │ • Relay GPIO Actuation     │
│ • BLE GATT Server         │ • Contactor Aux Feedback   │
│ • MQTT / TLS Client       │ • ACS712 Current Sampling  │
│ • ESP-NOW Packet Receiver │ • Local Automation Task    │
│ • HTTPS Signed OTA Task   │ • Dry-Run Interlock Trip   │
└───────────────────────────┴────────────────────────────┘
```

## 2. GPIO Pinout & Hardware Connections

| GPIO Pin | Function | Electrical Standard | Connected Peripheral |
|---|---|---|---|
| **GPIO 23** | Relay Trigger | Active LOW (3.3V Logic) | PC817 Opto-Isolated Relay Input |
| **GPIO 34** | Current Sensor | ADC1_CH6 (0 - 3.3V) | ACS712-30A Current Sensor VOUT |
| **GPIO 18** | Manual Button | Internal Pull-Up (INPUT_PULLUP) | Tactile Push Button (START/STOP) |
| **GPIO 19** | Reset / BLE | Internal Pull-Up (INPUT_PULLUP) | Tactile Push Button (Provisioning) |
| **GPIO 2** | Power LED | Active HIGH | Blue LED (Power Rail Active) |
| **GPIO 4** | Motor Run LED | Active HIGH | Green LED (Pump Motor Energized) |
| **GPIO 5** | Wi-Fi / Link LED | Active HIGH | Cyan LED (MQTT / Cloud Linked) |
| **GPIO 21** | Fault LED | Active HIGH | Red LED (System Fault / Trip) |
| **GPIO 13** | Alarm Buzzer | Active HIGH | 5V Piezo Buzzer Output |

## 3. How to Build & Flash

### Option A: PlatformIO (Recommended)
```bash
cd "d:\Smart water pump conroller\firmware\esp32-main-node"
pio run --target upload
pio device monitor -b 115200
```

### Option B: Arduino IDE
1. Open the Arduino sketch:
   [`firmware/arduino-ide-sketches/ESP32_Main_Node/ESP32_Main_Node.ino`](file:///d:/Smart%20water%20pump%20conroller/firmware/arduino-ide-sketches/ESP32_Main_Node/ESP32_Main_Node.ino)
2. In **Tools > Board**, select **ESP32 Dev Module**.
3. Install required libraries from Library Manager:
   - `PubSubClient` by Nick O'Leary
   - `ArduinoJson` (v6.x) by Benoit Blanchon
   - `NimBLE-Arduino` by h2zero
4. Select COM port and click **Upload**.
