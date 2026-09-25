# Smart Water Pump Controller — Master Engineering Specification (Phases 1–24)

## Executive Summary
This document establishes the production-grade architecture, data contracts, security mechanisms, hardware telemetry pipelines, and mobile-backend synchronization protocols for the **Smart Water Pump Controller IoT Platform**.

The platform is designed around zero-trust client principles: mobile devices and remote nodes are never granted implicit hardware access. User-to-device ownership, hardware registration, command authorization, telemetry rate limiting, and emergency overrides are strictly mediated by the backend server and cryptographic broker access control lists (ACLs).

---

## 1. Complete Architecture Topology

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

## 2. PostgreSQL Relational Model

The core relationship guarantees that hardware is owned by an individual user, and every database query MUST enforce `WHERE id = $hardwareId AND user_id = $authenticatedUserId`:

```text
users
  id
   │
   └──── hardware.user_id
              │
              ├── main_nodes (1:1 with hardware)
              ├── sub_nodes (1:N with hardware)
              ├── device_credentials (1:1)
              ├── pump_state (1:1)
              ├── pump_events (1:N)
              ├── sensor_readings (1:N high-frequency telemetry)
              ├── telemetry_hourly (1:N aggregated rollups)
              ├── device_commands (1:N with ACK statuses)
              ├── emergency_stop_events (1:N audit logs)
              └── automation_rules (1:N)
                     └── automation_logs
```

---

## 3. Strict Scoped Query & Ownership Enforcement Pattern

No endpoint accepts a hardware or device identifier without binding it to the user identity extracted from the verified JWT:

```sql
-- CORRECT: Scoped by Authenticated User
SELECT * FROM hardware WHERE id = $hardware_id AND user_id = $authenticated_user_id;

-- NEVER ALLOWED: Unscoped query allowing horizontal privilege escalation
SELECT * FROM hardware WHERE id = $hardware_id;
```

---

## 4. Phase-by-Phase Execution Roadmap (Phases 1 to 24)

- **Phase 01: Monorepo and Infrastructure**: Workspace setup, TypeScript base configs, Docker Compose for Postgres 16, Redis 7, Mosquitto 2.0.
- **Phase 02: PostgreSQL Schema & Database Package**: Prisma schema, client generation, and scoped query utilities.
- **Phase 03: Authentication Engine**: Argon2id password hashing, JWT generation, session tracking, token rotation.
- **Phase 04: Security Middleware**: Per-route rate limiting, IP tracking, Auth Guard, Zod request body validation.
- **Phase 05: Hardware Ownership Service**: Claiming workflow, cryptographic unicity verification, ownership guards.
- **Phase 06: Eclipse Mosquitto Configuration**: ACL patterns, username/password auth, TLS listener, WebSocket listener.
- **Phase 07: Device Authentication & Provisioning Backend**: Hardware credential generation, OTP exchange.
- **Phase 08: BLE Provisioning Protocol**: GATT Service, Characteristic contracts, Wi-Fi credential encryption.
- **Phase 09: Hardware State & Heartbeat Watchdog**: 5-second MQTT heartbeat with 15-second debounce window to prevent online/offline flickering.
- **Phase 10: Pump Command Dispatch & ACK Tracker**: Asynchronous command flow with `202 Accepted` and real-time ACK confirmation.
- **Phase 11: Emergency Stop System**: High-priority MQTT queue, hardware latching relay, manual reset requirement.
- **Phase 12: Telemetry Pipeline & Aggregation**: Real-time MQTT stream -> Redis pub/sub -> Background worker hourly database rollups.
- **Phase 13: Automation Engine**: Rule evaluation loop (low water auto-start, full tank stop, dry-run protection).
- **Phase 14: Flutter Authentication**: Riverpod state management, secure token storage, registration and login UI.
- **Phase 15: Flutter BLE Provisioning Wizard**: Bluetooth permission, BLE device discovery, Wi-Fi credential transmission, claiming.
- **Phase 16: Minimalist Dashboard & 3D Spatial Canvas**: Real-time water tank visualizer, dual sine-wave fluid animation, rotating impeller.
- **Phase 17: Pump Control Interface**: Manual Start/Stop buttons, Auto mode indicator, prominent Emergency Stop button.
- **Phase 18: Hardware Health Monitor**: Main node Wi-Fi/MQTT status, Sub-node battery and signal strength.
- **Phase 19: Telemetry Analytics Screens**: Interactive charts (Live, Day, Week, Month) for tank level, flow rate, TDS, TDH.
- **Phase 20: Automation Rules UI**: Visual threshold configuration, schedule builder, trigger history logs.
- **Phase 21: Settings & Notification Preferences**: Alert switches (pump running, low tank, offline), dark mode toggle.
- **Phase 22: Marketing & Download Website**: Sleek Next.js landing page with feature showcase and direct APK download.
- **Phase 23: End-to-End Testing & Security Audit**: Penetration testing for ownership spoofing, latency benchmarks, failover drills.
- **Phase 24: Docker Deployment & Hardening**: Production Dockerfile images, environment variable audit, systemd/k8s readiness.
