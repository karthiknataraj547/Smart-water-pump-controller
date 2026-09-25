# REST & WebSocket API Specification

## Base URL
- Production: `https://api.smartpump.io`
- Local Development: `http://localhost:3000/api`

All requests except public auth routes (`/api/auth/register`, `/api/auth/login`) require a Bearer Access Token in the `Authorization` header or a valid `accessToken` HttpOnly cookie:
```text
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

---

## 1. Authentication Endpoints

### 1.1 Register Account
* **Route**: `POST /api/auth/register`
* **Rate Limit**: 3 requests / 10 min / IP
* **Request Body**:
```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "phoneNumber": "+1234567890",
  "password": "SecurePassword123!"
}
```
* **Success Response (201 Created)**:
```json
{
  "user": {
    "id": "usr_98a72b",
    "email": "jane@example.com",
    "fullName": "Jane Doe"
  },
  "tokens": {
    "accessToken": "eyJhbG...",
    "expiresIn": 900
  }
}
```

### 1.2 User Login
* **Route**: `POST /api/auth/login`
* **Rate Limit**: 5 attempts / min / IP
* **Request Body**:
```json
{
  "email": "jane@example.com",
  "password": "SecurePassword123!"
}
```
* **Success Response (200 OK)**:
```json
{
  "user": {
    "id": "usr_98a72b",
    "email": "jane@example.com",
    "fullName": "Jane Doe",
    "hasHardware": true
  },
  "tokens": {
    "accessToken": "eyJhbG...",
    "expiresIn": 900
  }
}
```

### 1.3 Refresh Access Token
* **Route**: `POST /api/auth/refresh`
* **Rate Limit**: 30 requests / min
* **Request Headers**: Expects rotating `refreshToken` cookie.
* **Success Response (200 OK)**: Returns renewed access token.

### 1.4 Logout
* **Route**: `POST /api/auth/logout`
* **Rate Limit**: 10 requests / min
* **Action**: Revokes session in database and invalidates cookies.

---

## 2. Hardware Management Endpoints

### 2.1 List Claimed Hardware
* **Route**: `GET /api/hardware`
* **Authorization**: User
* **Response (200 OK)**:
```json
[
  {
    "id": "hw_771a",
    "serialNumber": "SP-3918-B",
    "name": "Main Overhead Tank Pump",
    "status": "ONLINE",
    "firmwareVersion": "1.2.4",
    "wifiSsid": "Home_WiFi_5G",
    "wifiRssi": -58,
    "emergencyStopActive": false,
    "lastHeartbeat": "2026-09-24T16:30:00.000Z",
    "pumpState": {
      "mode": "MANUAL",
      "state": "ON",
      "currentFlowRateLpm": 12.4,
      "headPressureMeters": 18.6
    }
  }
]
```

### 2.2 Claim Device (Provisioning Finalization)
* **Route**: `POST /api/hardware/claim`
* **Rate Limit**: 5 requests / min
* **Request Body**:
```json
{
  "serialNumber": "SP-3918-B",
  "claimCode": "982310",
  "name": "Rooftop Pump"
}
```
* **Success Response (201 Created)**: Links hardware to `authenticatedUser.id`.

---

## 3. Pump Command Endpoints

### 3.1 Start Pump
* **Route**: `POST /api/hardware/:id/pump/start`
* **Rate Limit**: 10 requests / min / hardware
* **Verification**: Checks that hardware belongs to user AND `emergencyStopActive == false`.
* **Response (202 Accepted)**:
```json
{
  "commandId": "cmd_88921a",
  "status": "DISPATCHED",
  "message": "Command dispatched to hardware broker. Awaiting physical relay ACK."
}
```

### 3.2 Stop Pump
* **Route**: `POST /api/hardware/:id/pump/stop`
* **Rate Limit**: 10 requests / min / hardware
* **Response (202 Accepted)**: Returns `commandId` and dispatches `PUMP_STOP` MQTT packet.

### 3.3 Emergency Stop (Priority Override)
* **Route**: `POST /api/hardware/:id/emergency-stop`
* **Rate Limit**: 60 requests / min
* **Action**:
  1. Instantly sets `Hardware.emergencyStopActive = true` in DB.
  2. Inserts audit record in `EmergencyStopEvent`.
  3. Publishes high-priority emergency command to MQTT broker.
* **Response (200 OK)**:
```json
{
  "status": "EMERGENCY_STOPPED",
  "timestamp": "2026-09-24T16:31:00.000Z"
}
```

### 3.4 Clear Emergency Stop Latch
* **Route**: `POST /api/hardware/:id/emergency-reset`
* **Rate Limit**: 5 requests / min
* **Request Body**:
```json
{
  "acknowledgedWarning": true
}
```
* **Response (200 OK)**: Clears emergency stop latch, allowing manual or auto start.

---

## 4. Telemetry Endpoints

### 4.1 Historical Aggregates
* **Route**: `GET /api/hardware/:id/telemetry/history?range=DAY` (Options: `DAY`, `WEEK`, `MONTH`)
* **Response (200 OK)**:
```json
{
  "hardwareId": "hw_771a",
  "range": "DAY",
  "points": [
    {
      "timestamp": "2026-09-24T12:00:00.000Z",
      "avgTankLevel": 74.2,
      "totalWaterPumpedL": 420.5,
      "avgFlowRateLpm": 12.1,
      "avgTdsPpm": 182.0
    }
  ]
}
```

---

## 5. Automation Rules Endpoints

### 5.1 List Rules
* **Route**: `GET /api/hardware/:id/rules`
* **Response (200 OK)**: Array of automation rules for the specified hardware.

### 5.2 Create Rule
* **Route**: `POST /api/hardware/:id/rules`
* **Request Body**:
```json
{
  "name": "Auto Fill Tank Under 30%",
  "conditionMetric": "TANK_LEVEL_PERCENT",
  "operator": "LESS_THAN",
  "thresholdValue": 30.0,
  "action": "PUMP_START",
  "cooldownSeconds": 600
}
```
* **Response (201 Created)**: Returns created rule record.
