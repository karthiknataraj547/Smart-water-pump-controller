# 16 — Android Mobile Application APK Build Guide

## 1. Architecture
The Android mobile app is packaged via **Capacitor**, providing a native-feeling application with full hardware BLE peripheral scanning, push notifications, and background status sync.

## 2. Generating the Android Project & APK
```bash
# 1. Build frontend distribution bundle
cd frontend
npm run build

# 2. Add Capacitor Android platform (if not already initialized)
npx cap add android

# 3. Sync web assets with Android native wrapper
npx cap sync android

# 4. Open in Android Studio or build release APK via Gradle
cd android
./gradlew assembleRelease
```

The compiled release APK will be located at:
`frontend/android/app/build/outputs/apk/release/app-release-unsigned.apk`
