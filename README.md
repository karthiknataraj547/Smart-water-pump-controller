# Smart Water Pump Controller — Production IoT Platform

A production-grade, end-to-end IoT platform for residential and industrial water pump automation, tank level monitoring, and remote telemetry. 

Built with zero-trust hardware architecture, strict backend ownership enforcement, sub-second MQTT command latency, automated dry-run/overflow protection, and interactive 3D spatial water tank visualization.

---

## Architecture Blueprint

```text
Flutter Android App
        │
        │ HTTPS / WebSocket
        ▼
Next.js Backend API
        │
        ├── Authentication (Argon2id + JWT)
        ├── Security & Rate Limiting Middleware
        ├── Hardware Ownership Scoped Engine
        ├── Pump Command & ACK Tracker Service
        ├── Telemetry Aggregation Pipeline
        ├── Automation Rule Engine
        └── Notification & Alert Service
        │
        ├───────────────┐
        ▼               ▼
 PostgreSQL         MQTT Broker
 Database           Eclipse Mosquitto (TLS/WSS)
        ▲               │
        │               │ MQTT / TLS (QoS 1)
        │               ▼
        │          Main Node ESP32 (Wi-Fi + BLE Gateway + Contactor Relay)
        │               │
        │            ESP-NOW (Low Latency Peer-to-Peer)
        │               ▼
        │          Sub Node ESP8266 (Tank Ultrasonics / TDS / Flow Meter)
        │
        └── Telemetry / Realtime Device State
```

---

## Monorepo Layout

```text
smart-pump/
├── apps/
│   ├── mobile/                 # Flutter Android application (Riverpod, 3D Canvas, BLE Provisioning)
│   ├── web/                    # Next.js download portal and product showcase
│   └── admin/                  # Diagnostic portal for device management
│
├── backend/
│   └── api/                    # Next.js App Router API & IoT WebSocket Server
│
├── packages/
│   ├── database/               # Prisma schema & PostgreSQL client with scoped queries
│   ├── auth/                   # Argon2id password hashing & JWT session management
│   ├── mqtt/                   # Mosquitto client, ACK tracking & LWT debouncing
│   ├── validation/             # Zod validation schemas for API & MQTT payloads
│   └── shared/                 # Universal types, command enums & topic builders
│
├── firmware/
│   ├── main-node/              # ESP32 FreeRTOS firmware (BLE, MQTT TLS, ESP-NOW Master)
│   └── sub-node/               # ESP8266 sensor pod firmware (ESP-NOW Slave, Ultrasonic)
│
├── infrastructure/
│   ├── docker-compose.yml      # Local stack: Postgres 16, Redis 7, Mosquitto 2.0
│   ├── mosquitto/              # Broker config, ACLs and TLS certificates
│   └── postgres/               # Initial database schema setup scripts
│
└── docs/                       # Complete Phase 1-24 specifications & testing guides
```

---

## Core Security & Reliability Guarantees

1. **Strict User-to-Hardware Ownership**: Mobile requests never query hardware by raw `hardwareId`. Every query is strictly scoped via `WHERE id = $hardwareId AND user_id = $authenticatedUserId`.
2. **Deterministic Command ACK**: Commands (`PUMP_START`, `PUMP_STOP`, `EMERGENCY_STOP`) return `202 Accepted` with a `commandId`. The UI displays *Starting...* and only transitions to *RUNNING* after the hardware physically energizes the contactor and emits a signed MQTT ACK.
3. **Hardware-Enforced Emergency Stop**: In an emergency stop, the ESP32 latches the relay open locally. Ordinary start commands are rejected until an explicit reset sequence is confirmed.
4. **Anti-Flicker Heartbeat Watchdog**: Eliminates online/offline toggling during minor Wi-Fi jitter by using an MQTT Last Will & Testament (LWT) combined with a 3-interval (15 second) debouncing hysteresis window.
5. **Intelligent Telemetry Aggregation**: Real-time 1-second telemetry streams over MQTT/WebSocket to the live app; the database ingests intelligently sampled and hourly aggregated rollups to prevent storage bloat.

---

## Getting Started

### 1. Start Infrastructure (Docker)
```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

### 2. Install Dependencies & Generate Database Client
```bash
npm install
npm run db:generate
npm run db:migrate
```

### 3. Start Development Services
```bash
npm run dev:backend   # Starts API on http://localhost:3000
npm run dev:web       # Starts Website on http://localhost:3001
```

### 4. Run Mobile App (Flutter)
```bash
cd apps/mobile
flutter pub get
flutter run
```
