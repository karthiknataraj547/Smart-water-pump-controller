# 02 — Hardware Architecture, Isolation & Wiring Schematics

## 1. Electrical Isolation Philosophy
High-power water pumps (1 HP to 10+ HP, single-phase 230V or three-phase 415V) generate massive inductive kickback, electromagnetic interference (EMI), and transient voltage spikes during start/stop transitions.

> [!CAUTION]
> **Microcontroller Protection Rule**: The low-voltage digital microcontroller circuitry (3.3V / 5V DC) must never be galvanically connected to the AC line voltage or motor supply. 

### Multi-Stage Isolation Architecture:
1. **Stage 1 (Logic Level)**: ESP32 GPIO pin drives the LED of a high-speed **PC817 optocoupler**.
2. **Stage 2 (Pilot Relay)**: The optocoupler phototransistor energizes the coil of a 12V/24V DC industrial pilot relay. A **1N4007 flyback diode** is placed anti-parallel across the DC coil.
3. **Stage 3 (Power Contactor)**: The pilot relay contacts switch the 230V AC control coil of a heavy-duty **AC-3 rated industrial contactor**.
4. **Stage 4 (Snubber Suppression)**: An RC snubber network (100Ω 2W resistor + 0.1μF 630V capacitor) is wired across the contactor coil to absorb inductive flyback spikes.

```text
+3.3V ──[ 330Ω ]──> (A) [PC817 Opto] (C) ──> [ESP32 GPIO 23 (Active LOW)]
                        (E)           (C)
                         │             │
                        GND_12V      +12V ──[ 1N4007 ]──> [Pilot Relay Coil]
                                                  ▲
                                                  │
                                            [Flyback Diode]
```

## 2. Pin Allocation Table

### ESP32 Main Controller Node
| GPIO Pin | Function | Electrical Standard | Connected Peripheral |
|---|---|---|---|
| GPIO 23 | Digital Output | Active LOW (3.3V Logic) | PC817 Optocoupler Relay Trigger |
| GPIO 22 | Digital Input | Internal Pull-Up (3.3V) | Contactor Auxiliary NO Contact (Weld Feedback) |
| GPIO 34 | Analog Input | ADC1 CH6 (0 - 3.3V) | ACS712-30A Current Sensor Output |
| GPIO 18 | Digital Input | Internal Pull-Up | Tactile Push Button (Manual Start/Stop) |
| GPIO 19 | Digital Input | Internal Pull-Up | Tactile Push Button (BLE Provisioning Reset) |
| GPIO 2 | Digital Output | Active HIGH | Blue Status LED (Power Rail) |
| GPIO 4 | Digital Output | Active HIGH | Green LED (Pump Motor Energized) |
| GPIO 5 | Digital Output | Active HIGH | Cyan LED (Wi-Fi / MQTT Link Active) |
| GPIO 21 | Digital Output | Active HIGH | Red LED (System Fault / Lockout) |
| GPIO 13 | Digital Output | Active HIGH | 5V Piezo Buzzer Annunciator |

### ESP8266 Sub Node (Tank Top)
| Pin (NodeMCU) | Function | Connected Sensor |
|---|---|---|
| D1 (GPIO 5) | Digital Output | Ultrasonic Sensor (TRIG) |
| D2 (GPIO 4) | Digital Input | Ultrasonic Sensor (ECHO) via 1k/2k voltage divider |
| D5 (GPIO 14) | Interrupt Input | YF-S201 Flow Sensor Pulse Signal |
| A0 (ADC0) | Analog Input | Analog TDS Sensor Signal (0 - 3.3V) |
| D6 (GPIO 12) | OneWire Bus | DS18B20 Digital Temperature Sensor |
| D7 (GPIO 13) | Digital Input | Physical Float Safety Switch (Backup Cutoff) |
