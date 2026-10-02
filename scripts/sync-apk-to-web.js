const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const FLUTTER_APK_DIR = path.join(ROOT_DIR, 'apps', 'mobile', 'build', 'app', 'outputs', 'flutter-apk');
const WEB_DOWNLOADS_DIR = path.join(ROOT_DIR, 'apps', 'web', 'public', 'downloads');

function calculateSha256(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch (_) {
    return null;
  }
}

function syncApk() {
  if (!fs.existsSync(WEB_DOWNLOADS_DIR)) {
    fs.mkdirSync(WEB_DOWNLOADS_DIR, { recursive: true });
  }

  // Priority candidates: universal release first, then arm64, then debug
  const candidates = [
    'app-release.apk',
    'app-arm64-v8a-release.apk',
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
    console.warn('[Sync-APK] No compiled APK found in', FLUTTER_APK_DIR);
    console.log('[Sync-APK] Run "npm run build:apk" or "flutter build apk --release" in apps/mobile.');
    return false;
  }

  const stats = fs.statSync(selectedPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  const hash = calculateSha256(selectedPath);

  const destLatest = path.join(WEB_DOWNLOADS_DIR, 'smartpump-latest.apk');

  // Copy if destination doesn't exist or size/mtime differ
  let needsCopy = true;
  if (fs.existsSync(destLatest)) {
    const destStats = fs.statSync(destLatest);
    if (destStats.size === stats.size && destStats.mtimeMs >= stats.mtimeMs) {
      needsCopy = false;
    }
  }

  if (needsCopy) {
    fs.copyFileSync(selectedPath, destLatest);
    console.log(`[Sync-APK] Successfully copied ${selectedFile} (${sizeMb} MB) -> apps/web/public/downloads/smartpump-latest.apk`);
  } else {
    console.log(`[Sync-APK] Website APK is already up-to-date with ${selectedFile} (${sizeMb} MB).`);
  }

  // Write version metadata for web portal inspection
  const meta = {
    version: '2.5.0',
    buildNumber: 1,
    sizeBytes: stats.size,
    sizeMb: `${sizeMb} MB`,
    sha256: hash,
    lastSynced: new Date().toISOString(),
    filename: 'smartpump-latest.apk',
  };

  fs.writeFileSync(path.join(WEB_DOWNLOADS_DIR, 'version.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log('[Sync-APK] Updated version metadata: apps/web/public/downloads/version.json');
  return true;
}

// Watch mode support
if (process.argv.includes('--watch')) {
  console.log('[Sync-APK] Watching for Flutter APK builds in:', FLUTTER_APK_DIR);
  syncApk();
  if (fs.existsSync(FLUTTER_APK_DIR)) {
    let debounceTimer;
    fs.watch(FLUTTER_APK_DIR, (eventType, filename) => {
      if (filename && filename.endsWith('.apk')) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          console.log(`[Sync-APK] Detected build update: ${filename}`);
          syncApk();
        }, 1500);
      }
    });
  }
} else {
  syncApk();
}
