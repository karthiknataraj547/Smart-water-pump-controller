# 13 — Troubleshooting & Fail-Safe Emergency Manual

## 1. Fail-Safe Scenarios & Automatic Mitigations

| Failure Event | Detection Mechanism | System Action & Local Fail-Safe |
|---|---|---|
| **Sub Node Power Loss / Radio Outage** | No ESP-NOW packet received for >30s | If pump is ON, immediately STOP pump to prevent tank overflow disaster. Broadcast critical alert. |
| **Dry-Run (Borewell / Source Dry)** | Flow sensor reports < 0.5 L/min for 120s while pump is active | Trip relay into `FAULT` state. Sound local buzzer and lockout auto-restart until manual reset. |
| **High Water Overflow** | Water level >= 95% | Immediate hardware cutoff. Ignored by manual overrides for safety. |
| **Wi-Fi / Internet Failure** | Wi-Fi disconnect callback | ESP32 continues running FreeRTOS local automation task without interruption. |
| **Motor Overcurrent (Weld / Jam)** | ACS712 current > 15.0A | Immediate relay trip and emergency hardware lockout. |
