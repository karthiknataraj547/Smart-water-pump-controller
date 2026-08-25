# 05 — REST API & WebSocket Protocol Reference

## 1. Authentication Endpoints

### `POST /api/v1/auth/register`
Creates a new operator or admin account.
- **Request Body**:
  ```json
  {
    "name": "Alex Operator",
    "email": "alex@waterpump.io",
    "password": "SecurePassword123!",
    "phone": "+1-555-0199"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "...", "name": "Alex Operator", "email": "alex@waterpump.io", "role": "operator" },
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
  ```

### `POST /api/v1/auth/login`
Authenticates user and returns JWT access + refresh tokens.

---

## 2. Pump Control Endpoints

### `GET /api/v1/pumps/:deviceId/status`
Returns latest confirmed pump state, active mode, runtime, and motor current draw.

### `POST /api/v1/pumps/:deviceId/start`
Sends command to activate the pump motor.
- **Headers**: `Authorization: Bearer <TOKEN>`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "commandId": "b182f7c0-1022-4912-8700-1129910aef12",
      "status": "sent",
      "message": "Command START_PUMP dispatched to hardware node WPC-A81F29"
    }
  }
  ```

### `POST /api/v1/pumps/:deviceId/stop`
Sends command to deactivate the pump motor.

### `POST /api/v1/pumps/:deviceId/mode`
Sets operating mode: `MANUAL`, `AUTOMATIC`, `SCHEDULED`, `EMERGENCY_STOP`.

### `POST /api/v1/pumps/:deviceId/emergency-stop`
Triggers hardware lockout and immediately trips the relay interlock.

---

## 3. WebSocket Real-Time Subscription (`/ws`)

Connect via WebSocket with auth token:
`ws://localhost:5000/ws?token=<JWT_TOKEN>&clientType=web`

### Event Types:
1. **`TELEMETRY_UPDATE`**:
   ```json
   {
     "event": "TELEMETRY_UPDATE",
     "data": {
       "deviceUid": "WPC-A81F29",
       "waterLevelPercentage": 72.5,
       "waterLevelLiters": 1450.0,
       "inflowRateLpm": 14.2,
       "totalInflowLiters": 4820.0,
       "tdsPpm": 245.0,
       "temperatureC": 23.8,
       "rssi": -58
     }
   }
   ```
2. **`PUMP_STATE_CHANGED`**:
   ```json
   {
     "event": "PUMP_STATE_CHANGED",
     "data": {
       "deviceUid": "WPC-A81F29",
       "pump_state": "ON",
       "mode": "AUTOMATIC",
       "runtime_seconds": 120,
       "current_draw_amps": 4.8
     }
   }
   ```
3. **`COMMAND_STATUS_UPDATE`**: Broadcasts `sent` -> `executing` -> `successful` / `failed` states.
4. **`ALERT_TRIGGERED`**: Pushes immediate alarm annunciations.
