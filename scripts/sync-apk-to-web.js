const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const FLUTTER_APK_DIR = path.join(ROOT_DIR, 'apps', 'mobile', 'build', 'app', 'outputs', 'flutter-apk');
const WEB_DOWNLOADS_DIR = path.join(ROOT_DIR, 'apps', 'web', 'public', 'downloads');

console.log('[Sync-APK] Syncing latest compiled mobile APK to website downloads directory...');

if (!fs.existsSync(WEB_DOWNLOADS_DIR)) {
  fs.mkdirSync(WEB_DOWNLOADS_DIR, { recursive: true });
}

// Candidates in order of preference (release builds first, then debug)
const candidates = [
  'app-arm64-v8a-release.apk',
  'app-release.apk',
  'app-armeabi-v7a-release.apk',
  'app-debug.apk',
];

let selectedFile = null;
let selectedPath = null;

for (const name of candidates) {
  const p = path.join(FLUTTER_APK_DIR, name);
  if (fs.existsSync(p)) {
    selectedFile = name;
    selectedPath = p;
    break;
  }
}

if (!selectedPath) {
  console.error('[Sync-APK] No compiled APK found in', FLUTTER_APK_DIR);
  console.log('[Sync-APK] Run "npm run build:apk" or "flutter build apk --release" first.');
  process.exit(0);
}

const stats = fs.statSync(selectedPath);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
console.log(`[Sync-APK] Found ${selectedFile} (${sizeMb} MB)`);

// Destinations
const destLatest = path.join(WEB_DOWNLOADS_DIR, 'smartpump-latest.apk');
const destVersioned = path.join(WEB_DOWNLOADS_DIR, 'smartpump-v1.2.0.apk');

fs.copyFileSync(selectedPath, destLatest);
fs.copyFileSync(selectedPath, destVersioned);

console.log(`[Sync-APK] Successfully copied to:`);
console.log(`  -> apps/web/public/downloads/smartpump-latest.apk`);
console.log(`  -> apps/web/public/downloads/smartpump-v1.2.0.apk`);
console.log(`[Sync-APK] Website download buttons and QR codes will now serve this APK build.`);
