# 14 — Over-The-Air (OTA) Firmware Upgrade Guide

## 1. Secure Dual-Bank OTA Partitioning
The ESP32 flash is divided into two OTA app partitions (`app0` and `app1`) alongside an `otadata` partition:
- Active firmware runs from `app0`.
- Incoming firmware update is downloaded and written to `app1`.
- If new firmware boots and confirms self-test within 30 seconds, `otadata` marks `app1` as permanent.
- If a crash or watchdog panic occurs, the bootloader automatically rolls back to `app0`.

## 2. OTA Upgrade API Flow
1. Cloud Admin issues POST request to `/api/v1/firmware/ota/trigger`.
2. ESP32 receives command over MQTT, verifies SHA256 signature, begins HTTPS download, flashes partition, and reboots.
