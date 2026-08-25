# ESP8266 Sub Node Firmware — Tank Sensor Node

## 1. Overview
The ESP8266 Sub Node is installed inside or near the overhead water tank enclosure. It samples water level via an ultrasonic sensor (HC-SR04 or waterproof JSN-SR04T), water flow using a YF-S201 pulse sensor, water quality using an analog TDS probe, and transmits formatted packets via **ESP-NOW directly to the ESP32 Main Node**.

## 2. Hardware Pinout Table

| ESP8266 Pin | Function | Peripheral / Module | Description |
|---|---|---|---|
| **D1 (GPIO 5)** | Output | Ultrasonic Trigger | 10μs trigger pulse |
| **D2 (GPIO 4)** | Input | Ultrasonic Echo | Pulse duration measurement (0-5m) |
| **D5 (GPIO 14)**| Input (Interrupt) | YF-S201 Flow Sensor | Hall-effect pulse frequency input |
| **A0 (ADC0)**   | Analog Input | Analog TDS Sensor | 0-3.3V analog input for ppm calculation |
| **D6 (GPIO 12)**| Input/Output | DS18B20 (Optional) | OneWire temperature probe |
| **D7 (GPIO 13)**| Input (Pullup) | Float Safety Switch | Emergency physical overflow backup |
| **D4 (GPIO 2)** | Output (Active LOW) | Onboard LED | Telemetry transmission flash |

## 3. Sensor Wiring Diagram

```text
[ESP8266 NodeMCU]
  ├── D1 (GPIO 5)  ────────> HC-SR04 / JSN-SR04T (TRIG)
  ├── D2 (GPIO 4)  <──────── HC-SR04 / JSN-SR04T (ECHO) [via 1k/2k voltage divider]
  ├── D5 (GPIO 14) <──────── YF-S201 Flow Sensor (PULSE)
  ├── A0 (ADC0)    <──────── Analog TDS Sensor (SIGNAL)
  ├── 3.3V / 5V    ────────> VCC Rails
  └── GND          ────────> Common Ground
```

## 4. Building and Flashing
```bash
cd firmware/esp8266-sub-node
pio run --target upload
pio device monitor -b 115200
```
