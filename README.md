# Smart IoT Water Pump Monitoring & Control Ecosystem — Master Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://reactjs.org/)
[![ESP32](https://img.shields.io/badge/Hardware-ESP32%20%2B%20ESP8266-red.svg)](https://espressif.com/)
[![ESP-NOW](https://img.shields.io/badge/Protocol-ESP--NOW%20%2B%20MQTT-green.svg)](https://www.espressif.com/en/products/software/esp-now/overview)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

An enterprise-grade, commercial-quality **Smart Water Pump Monitoring, Local Fail-Safe Automation, and Multi-Platform Control Ecosystem**.

---

## 🌟 Key Capabilities & Highlights

1. **Dual-Microcontroller Architecture**:
   - **ESP32 Main Node**: Opto-isolated relay & contactor interlock control, ACS712 current feedback, FreeRTOS edge automation task, BLE GATT provisioning server, MQTT over TLS client with command ACK state machine, and OTA update engine.
   - **ESP8266 Sub Node**: Overhead water tank telemetry node with ultrasonic distance median filtering, YF-S201 Hall flow pulse counter, temperature-compensated TDS ppm meter, and ESP-NOW sender with CRC16-CCITT checksum validation.
2. **Multi-Platform Control Applications**:
   - **Responsive Luxury Web App**: Modern skeuomorphic interface with animated fluid wave dynamics canvas, tactile industrial rocker switches, digital LCD readouts, and live 50Hz WebSocket telemetry.
   - **Android Mobile App (APK-ready)**: Capacitor native mobile application with BLE device discovery radar wizard.
   - **Windows Projector & Control Room Application**: Electron-based kiosk display with giant distance-readable typography and high-contrast projection modes.
3. **Local Fail-Safe Autonomous Operation**:
   - Executes local safety policies inside the ESP32 even during total internet or cloud outages (e.g. low water auto-start, tank-full auto-stop, dry-run 120s zero-inflow emergency trip, and Sub Node communication loss shutdown).
4. **Cloud Gateway & Relational DB**:
   - Node.js + TypeScript REST & WebSocket API, embedded/external MQTT broker bridge, MySQL relational schema with indexing, JWT access/refresh token rotation, HMAC device authentication.
5. **Hardware Simulator**:
   - Full virtual IoT emulation suite for automated testing and demonstrations without requiring physical hardware.
6. **Complete 16-Part Technical Documentation**:
   - Detailed guides covering hardware wiring, isolation, ESP-NOW protocols, DB schema, REST API spec, BLE provisioning, troubleshooting, and APK compilation.

---

## 📁 Repository Structure

```text
.
├── backend/                     # Node.js + TypeScript REST & WebSocket API, Auth, MQTT Bridge
├── frontend/                    # React + Vite + TypeScript Luxury Skeuomorphic Application
├── windows-app/                 # Windows Desktop / Projector Display Launcher (Electron)
├── firmware/
│   ├── esp32-main-node/         # ESP32 Main Node Firmware (FreeRTOS, Relay, BLE, ESP-NOW)
│   └── esp8266-sub-node/        # ESP8266 Sub Node Firmware (Ultrasonic, Flow, TDS, ESP-NOW)
├── simulator/                   # Virtual Hardware & Physics Emulation Engine
├── docker/                      # Docker Compose, MySQL, Redis, Mosquitto, Nginx configurations
└── docs/                        # Complete 16-Part Comprehensive Technical Documentation Suite
```

---

## 🚀 Quickstart Guide

### 1. Launch Backend Service
```bash
cd backend
npm install
npm run dev
```
*Backend API active at `http://localhost:5000/api/v1` and WebSocket at `ws://localhost:5000/ws`.*

### 2. Launch Frontend Web App
```bash
cd frontend
npm install
npm run dev
```
*Web application active at `http://localhost:3000`.*

### 3. Launch Hardware Simulator (Virtual ESP32 + ESP8266)
```bash
cd simulator
npm install
npm start
```
*Simulates real-time water drawdown, pumping fill, and MQTT packet exchange.*

### 4. Default Authentication Credentials
- **Standard User / Station Operator**:
  - **Email**: `user@waterpump.io`
  - **Password**: `User@123456`
  - **Portal URL**: `http://localhost:3000/`
- **System Administrator**:
  - **Email**: `admin@waterpump.io`
  - **Password**: `Admin@123456`
  - **Security PIN**: `9921`
  - **Admin Command Portal**: `http://localhost:3000/admin`

---

## 📚 Technical Documentation Index

- [01. System Architecture & Topology](docs/01_system_architecture.md)
- [02. Hardware Architecture & Isolation Schematics](docs/02_hardware_architecture_and_wiring.md)
- [03. Network Architecture & ESP-NOW Protocol](docs/03_network_and_espnow_protocol.md)
- [04. Database Schema & Relational Models](docs/04_database_schema_and_migrations.md)
- [05. REST API & WebSocket Protocol Reference](docs/05_rest_and_websocket_api_spec.md)
- [06. Hardware Authentication & Security Guide](docs/06_hardware_authentication_and_security.md)
- [07. BLE & Wi-Fi Device Provisioning Guide](docs/07_ble_and_wifi_provisioning_guide.md)
- [08. ESP32 Main Node Firmware Architecture](docs/08_esp32_firmware_guide.md)
- [09. ESP8266 Sub Node Firmware Architecture](docs/09_esp8266_firmware_guide.md)
- [10. Physical Installation & Wiring Schematics](docs/10_installation_and_wiring_schematics.md)
- [11. Production Deployment & Docker Guide](docs/11_deployment_and_docker_guide.md)
- [12. Windows Projector & Control Room Mode Guide](docs/12_projector_control_room_mode_guide.md)
- [13. Troubleshooting & Fail-Safe Emergency Manual](docs/13_troubleshooting_and_fail_safe_manual.md)
- [14. Over-The-Air (OTA) Firmware Upgrade Guide](docs/14_ota_firmware_update_guide.md)
- [15. Testing & Quality Assurance Suite](docs/15_automated_and_manual_testing_suite.md)
- [16. Android Mobile Application APK Build Guide](docs/16_android_apk_build_and_release_guide.md)
