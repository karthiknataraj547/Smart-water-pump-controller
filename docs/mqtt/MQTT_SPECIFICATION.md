# MQTT Architecture and Protocol Specification

## Broker Details
- **Broker Engine**: Eclipse Mosquitto 2.0
- **Internal TCP Port**: 1883
- **External TLS Port**: 8883
- **WebSocket Port**: 9001 (used by Web / Flutter fallback)
- **Keep-Alive Interval**: 15 seconds

---

## 1. Topic Hierarchy Standard

All topics are partitioned strictly by `userId` and `deviceId`:

```text
users/{userId}/devices/{deviceId}/heartbeat
users/{userId}/devices/{deviceId}/state
users/{userId}/devices/{deviceId}/telemetry
users/{userId}/devices/{deviceId}/command
users/{userId}/devices/{deviceId}/ack
users/{userId}/devices/{deviceId}/events
users/{userId}/devices/{deviceId}/subnode
```

---

## 2. Topic Details & Message Payloads

### 2.1 Heartbeat
* **Direction**: ESP32 -> Broker -> Backend
* **Topic**: `users/{userId}/devices/{deviceId}/heartbeat`
* **QoS**: 1
* **Frequency**: Every 5,000 ms
* **Payload**:
```json
{
  "uptimeSeconds": 18234,
  "freeHeapBytes": 142800,
  "wifiRssi": -56,
  "timestamp": 1780000000000
}
```

### 2.2 Device State & Last Will and Testament (LWT)
* **Direction**: ESP32 -> Broker (Retained)
* **Topic**: `users/{userId}/devices/{deviceId}/state`
* **QoS**: 1 (Retained: `true`)
* **Online Payload (sent upon connection)**:
```json
{
  "status": "ONLINE",
  "firmwareVersion": "1.2.4",
  "ipAddress": "192.168.1.140",
  "macAddress": "24:6F:28:B2:44:90",
  "timestamp": 1780000000000
}
```
* **LWT Payload (configured in MQTT CONNECT packet)**:
```json
{
  "status": "OFFLINE",
  "reason": "LWT_DISCONNECT",
  "timestamp": 1780000000000
}
```

### 2.3 High-Frequency Telemetry Stream
* **Direction**: ESP32 -> Broker -> Redis/WebSocket
* **Topic**: `users/{userId}/devices/{deviceId}/telemetry`
* **QoS**: 0 (Low latency, high throughput)
* **Frequency**: 1,000 ms (or 300 ms during active pump flow)
* **Payload**:
```json
{
  "tankLevelPct": 72.4,
  "waterVolumeL": 724.0,
  "flowRateLpm": 12.4,
  "tdsPpm": 185.0,
  "tdhMeters": 18.6,
  "pumpState": "ON",
  "timestamp": 1780000001000
}
```

### 2.4 Command Dispatch
* **Direction**: Backend Service -> Broker -> ESP32
* **Topic**: `users/{userId}/devices/{deviceId}/command`
* **QoS**: 1
* **Payload**:
```json
{
  "commandId": "cmd_98231a",
  "command": "PUMP_START",
  "targetMode": "MANUAL",
  "issuedBy": "usr_98a72b",
  "timestamp": 1780000002000
}
```

### 2.5 Command Acknowledgment (ACK)
* **Direction**: ESP32 -> Broker -> Backend Service
* **Topic**: `users/{userId}/devices/{deviceId}/ack`
* **QoS**: 1
* **Payload**:
```json
{
  "commandId": "cmd_98231a",
  "status": "SUCCESS",
  "pumpState": "ON",
  "relayPinActive": true,
  "errorCode": null,
  "timestamp": 1780000002150
}
```

### 2.6 Emergency Stop Packet
* **Direction**: Backend / App -> ESP32
* **Topic**: `users/{userId}/devices/{deviceId}/command`
* **QoS**: 2 (Guaranteed Exactly-Once Delivery)
* **Payload**:
```json
{
  "commandId": "cmd_urg_001",
  "command": "EMERGENCY_STOP",
  "reason": "USER_MANUAL_BUTTON",
  "timestamp": 1780000003000
}
```

---

## 3. Sub-Node Sensor Data (ESP-NOW to ESP32 Gateway)

The ESP8266 / ESP32-C3 sub-node broadcasts sensor readings locally over 2.4 GHz ESP-NOW to the main node MAC address:
```c
typedef struct struct_message {
    char subNodeId[16];     // e.g., "SUB_OVERHEAD_01"
    float distanceCm;       // Ultrasonic sensor distance
    float waterLevelPct;    // Calculated tank percentage
    float flowRate;         // Pulses per minute converted to LPM
    float tdsValue;         // Analog reading converted to PPM
    float batteryVoltage;   // 3.7V Li-ion battery reading
} struct_message;
```
The Main Node receives this frame and bridges it to `users/{userId}/devices/{deviceId}/subnode`.
