import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function GET() {
  const apkPath = path.join(process.cwd(), 'public', 'downloads', 'smartpump-latest.apk');
  
  if (!fs.existsSync(apkPath)) {
    return NextResponse.json({ error: 'No APK found' }, { status: 404 });
  }

  const stats = fs.statSync(apkPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  
  let sha256 = '';
  try {
    const data = fs.readFileSync(apkPath);
    sha256 = crypto.createHash('sha256').update(data).digest('hex');
  } catch (_) {}

  return NextResponse.json({
    version: '2.5.0',
    buildNumber: 1,
    sizeBytes: stats.size,
    sizeMb: `${sizeMb} MB`,
    sha256,
    lastModified: stats.mtime.toISOString(),
    filename: 'smartpump-latest.apk',
    downloadUrl: '/downloads/smartpump-latest.apk'
  });
}
