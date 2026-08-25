# Windows Projector & Control Room Application

## 1. Overview
This desktop application is optimized for wall projectors, 4K control room monitoring screens, and facility manager terminals. It connects securely to the same backend REST API and WebSocket hub as the Web and Android applications.

## 2. Features
- **F11 Full-Screen Projector Mode**: Ultra-high contrast large display readable from 20+ feet away.
- **Monitoring Mode**: Clean, dense telemetry view.
- **Control Mode**: Dedicated hardware contactor switches and emergency stop cutoff.
- **Kiosk Mode**: Runs as a dedicated kiosk display on Windows boot without window chrome.

## 3. Running & Building
```bash
# Run locally
cd windows-app
npm install
npm start

# Build Windows .exe installer
npm run build
```
