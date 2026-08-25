# ESP32 Main Node Firmware — Smart IoT Water Pump Controller

## 1. Overview
The ESP32 Main Node acts as the industrial edge controller. It communicates directly with the top water tank Sub Node (ESP8266) via **ESP-NOW (2.4GHz Zero-Internet Link)**, performs local fail-safe automation rules, drives an opto-isolated high-power contactor, monitors ACS712 current feedback, manages BLE provisioning, and synchronizes with the Cloud Backend over secure MQTT.

## 2. Hardware Pinout Table

| ESP32 Pin | Function | Peripheral / Module | Description |
|---|---|---|---|
| **GPIO 23** | Output (Active LOW) | Opto-isolated Relay Module | Drives 230V/415V Industrial Contactor Coil |
| **GPIO 22** | Input (Pullup) | Contactor Aux Feedback | Reads auxiliary contact status for weld/fault detection |
| **GPIO 34** | Analog Input (ADC1) | ACS712 Current Sensor | Measures motor current draw (Amperes) |
| **GPIO 18** | Input (Pullup) | Push Button (Manual) | Tactile push button for local pump toggle |
| **GPIO 19** | Input (Pullup) | Push Button (Provision) | Long press (>5s) triggers BLE Provisioning Mode |
| **GPIO 2**  | Output | Blue Status LED | Board Power Indicator |
| **GPIO 4**  | Output | Green LED | Pump Active Indicator |
| **GPIO 5**  | Output | Cyan LED | Cloud / Wi-Fi Link Indicator |
| **GPIO 21** | Output | Red LED | System Fault / Dry Run Trip Indicator |
| **GPIO 13** | Output | Active Buzzer | Audible Alarm Annunciator |

## 3. High-Power Isolation & Contactor Wiring

```text
[ESP32 GPIO 23] ──────> [Optocoupler (PC817)] ──────> [12V/24V Coil Relay] ──────> [Industrial Contactor] ──────> [3-Phase / 1-Phase Pump]
                                                             ▲                              ▲
                                                             │                              │
                                                      [Flyback Diode]                [Snubber (RC)]
```

> [!WARNING]
> **High Voltage Safety**: Never switch pump motor current (>5A inductive load) directly from micro-relays. Always use an industrial electromagnetic contactor rated for motor duty (AC-3 rating) with an RC snubber network across the contactor coil to suppress inductive voltage spikes.

## 4. Building and Flashing
To compile and upload using PlatformIO:
```bash
cd firmware/esp32-main-node
pio run --target upload
pio device monitor -b 115200
```
