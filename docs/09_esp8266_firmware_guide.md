# 09 — ESP8266 Sub Node Firmware Architecture & Flashing Guide

## 1. Responsibilities
The ESP8266 Sub Node is mounted at the top of the overhead water storage tank. It runs continuous sensor acquisition and transmits a 35-byte binary telemetry packet to the ESP32 Main Node every 2000ms over direct 2.4GHz ESP-NOW.

## 2. GPIO Pinout & Hardware Connections

| NodeMCU Pin | GPIO | Function | Connected Peripheral |
|---|---|---|---|
| **D1** | GPIO 5 | Digital Output | Ultrasonic Sensor TRIG Pin |
| **D2** | GPIO 4 | Digital Input | Ultrasonic Sensor ECHO Pin (via 1k/2k divider) |
| **D5** | GPIO 14 | Interrupt Input | YF-S201 Flow Sensor Pulse Signal |
| **A0** | ADC0 | Analog Input (0-3.3V) | Analog TDS Water Purity Sensor Signal |
| **D4** | GPIO 2 | Digital Output | Onboard Blue Status LED (Active LOW) |

## 3. How to Build & Flash

### Option A: PlatformIO (Recommended)
```bash
cd "d:\Smart water pump conroller\firmware\esp8266-sub-node"
pio run --target upload
pio device monitor -b 115200
```

### Option B: Arduino IDE
1. Open the Arduino sketch:
   [`firmware/arduino-ide-sketches/ESP8266_Sub_Node/ESP8266_Sub_Node.ino`](file:///d:/Smart%20water%20pump%20conroller/firmware/arduino-ide-sketches/ESP8266_Sub_Node/ESP8266_Sub_Node.ino)
2. In **Tools > Board**, select **NodeMCU 1.0 (ESP-12E Module)**.
3. Select CPU Frequency: **80 MHz** or **160 MHz**.
4. Select COM port and click **Upload**.
