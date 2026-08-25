# 15 — Testing & Quality Assurance Suite

## 1. Automated Test Execution
Run the automated test suite against the backend gateway:
```bash
cd backend
npm test
```
Verifies:
- DB seeding and initialization
- Operator authentication & JWT generation
- Device lookup and telemetry ingestion
- Real-time rule evaluation & dry-run trigger
- Hardware ACK state machine verification

## 2. Hardware Simulator Verification
Run the virtual ESP32 + ESP8266 simulator:
```bash
cd simulator
npm install
npm start
```
Verifies:
- Virtual water level drawdown and pumping fill physics
- ESP-NOW packet generation with CRC16
- MQTT command reception and hardware confirmation ACK
