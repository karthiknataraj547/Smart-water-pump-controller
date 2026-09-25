# Testing Strategy & Test Case Matrix

## 1. Test Architecture Overview

```text
Unit Tests (Jest / Vitest)
  ├── packages/auth        -> Password hashing, JWT token rotation
  ├── packages/validation  -> Zod schema payload checks
  └── packages/shared      -> Topic builder string validation

Integration Tests
  ├── packages/database    -> Scoped queries (WHERE id = $id AND user_id = $userId)
  ├── backend/api          -> Route handlers with auth & rate limit guards
  └── packages/mqtt        -> Command dispatch & ACK loopback

IoT Hardware & Simulation Tests
  ├── Heartbeat Hysteresis -> Jitter simulation, packet loss resilience
  ├── Emergency Stop Latch -> Hardware relay lockout verification
  └── Telemetry Rollup     -> High throughput 1-second batch aggregation into hourly buckets
```

---

## 2. Critical Security & Hardware Test Cases

### TC-SEC-01: Cross-User Hardware Access Rejection
* **Objective**: Confirm that a valid token from User B receives `404 Not Found` or `403 Forbidden` when attempting any operation on User A's `hardwareId`.
* **Execution**:
  1. Create User A, provision Hardware A (`hw_01`).
  2. Create User B, obtain Bearer Token B.
  3. User B issues `GET /api/hardware/hw_01`.
  4. User B issues `POST /api/hardware/hw_01/pump/start`.
* **Expected Result**: Both requests fail with `404 Not Found` without modifying pump state or leaking metadata.

### TC-HW-02: Heartbeat Debounce (Anti-Flickering)
* **Objective**: Verify that dropping 1 or 2 consecutive heartbeats does NOT cause UI state to flip to `OFFLINE`.
* **Execution**:
  1. Main Node publishes heartbeats every 5 seconds. Hardware status is `ONLINE`.
  2. Drop heartbeat at $T=5s$ and $T=10s$.
  3. Query status endpoint.
* **Expected Result**: Node remains `ONLINE` (grace window is 15 seconds / 3 intervals).
* **Step 4**: At $T=16s$ with no packet, status transitions to `OFFLINE`.

### TC-CMD-03: Command & ACK Confirmation Loop
* **Objective**: Verify that the UI does not show `ON` until physical relay ACK is received.
* **Execution**:
  1. User issues `POST /api/hardware/hw_01/pump/start`.
  2. API returns `202 Accepted` with `commandId: "cmd_test_01"`. Status is `PENDING`.
  3. Simulated ESP32 delays ACK by 400ms.
  4. App WebSocket receives `DISPATCHED`.
  5. Simulated ESP32 publishes ACK with `status: "SUCCESS"`.
* **Expected Result**: API updates DB state to `ON`, WebSocket pushes `PUMP_RUNNING`, UI updates to `● RUNNING`.

### TC-ESTOP-04: Emergency Stop Lockout
* **Objective**: Verify that after `EMERGENCY_STOP` is issued, normal `PUMP_START` requests are rejected at both API and firmware levels.
* **Execution**:
  1. Issue `POST /api/hardware/hw_01/emergency-stop`.
  2. Verify relay pin goes LOW immediately.
  3. Issue `POST /api/hardware/hw_01/pump/start`.
* **Expected Result**: API returns `409 Conflict` (`"Hardware is locked in EMERGENCY_STOP state"`). No MQTT start command is sent.
* **Step 4**: Issue `POST /api/hardware/hw_01/emergency-reset`. Normal start is now accepted.

### TC-TEL-05: Telemetry Aggregation Performance
* **Objective**: Ensure 10,000 raw telemetry data points aggregate accurately into hourly rollup buckets without memory leaks.
* **Expected Result**: Correct mathematical calculation of `avgTankLevel`, `totalWaterPumped`, and `avgFlowRate`. Raw records aged > 7 days safely pruned.
