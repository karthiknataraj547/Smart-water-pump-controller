# 03 — Network Architecture & ESP-NOW Protocol Specification

## 1. Network Hierarchy
The system uses a two-tier network topology:
1. **Local Sensor Tier (ESP-NOW)**: High-speed, point-to-point 2.4GHz radio communication between the ESP8266 Sub Node (tank) and ESP32 Main Node (pump room). Operates completely independent of the local Wi-Fi router or internet connectivity.
2. **Cloud Uplink Tier (MQTT over TLS / WebSockets)**: Secure connection between ESP32 Main Node and Cloud Backend Gateway.

## 2. ESP-NOW Binary Packet Structure

The binary packet is packed with `__attribute__((packed))` to ensure 0 byte alignment padding across compilers:

```cpp
typedef struct __attribute__((packed)) {
    uint8_t  magic;           // Byte 0: 0xAA (Packet Start Delimiter)
    uint8_t  node_id;         // Byte 1: 0x01 (Sub Node UID)
    uint32_t sequence_num;    // Bytes 2-5: Monotonically increasing packet sequence counter
    float    water_level_pct; // Bytes 6-9: Calibrated water level (0.0% to 100.0%)
    float    water_liters;    // Bytes 10-13: Calibrated water volume in Liters
    float    flow_rate_lpm;   // Bytes 14-17: Current flow rate (Liters / Minute)
    float    total_inflow_l;  // Bytes 18-21: Total accumulated inflow (Liters)
    float    tds_ppm;         // Bytes 22-25: Water purity TDS (ppm)
    float    temperature_c;   // Bytes 26-29: Water temperature (Celsius)
    uint8_t  sensor_health;   // Byte 30: Bitmask [0: Ultrasonic, 1: Flow, 2: TDS, 3: Float]
    uint16_t battery_mv;      // Bytes 31-32: Battery / Supply rail voltage in mV
    uint16_t crc16;           // Bytes 33-34: CRC16-CCITT Checksum over bytes 0-32
} TankTelemetryPacket;
```

Total Packet Size: **35 Bytes**.

## 3. Packet Integrity & CRC16-CCITT Verification
To eliminate corrupted packets caused by 2.4GHz RF interference or motor noise, each packet is validated against a CRC16-CCITT polynomial:

$$P(x) = x^{16} + x^{12} + x^5 + 1 \quad (\text{Polynomial } 0x1021, \text{ Init } 0xFFFF)$$

```cpp
uint16_t calculateCrc16(const uint8_t *data, size_t length) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < length; i++) {
        crc ^= (uint16_t)data[i] << 8;
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}
```

## 4. Heartbeat & Disconnection Watchdog
- The Sub Node transmits telemetry packets every **2000ms**.
- If the ESP32 Main Node does not receive a valid CRC16-verified packet for **> 30,000ms (30 seconds)**, it transitions the Sub Node state to `COMMUNICATION_LOST`.
- **Fail-Safe Action**: If the water pump is currently active when the Sub Node disconnects, the ESP32 immediately turns the pump OFF to prevent tank overflow disasters.
