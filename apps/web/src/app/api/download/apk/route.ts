import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(_req: NextRequest) {
  try {
    const candidates = [
      path.join(process.cwd(), 'public', 'downloads', 'smartpump-latest.apk'),
      path.join(process.cwd(), 'public', 'downloads', 'smartpump-v1.2.0.apk'),
      path.resolve(process.cwd(), '..', '..', 'apps', 'mobile', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk'),
      path.resolve(process.cwd(), '..', '..', 'apps', 'mobile', 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk'),
    ];

    let apkPath: string | null = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        apkPath = c;
        break;
      }
    }

    if (!apkPath) {
      return NextResponse.json(
        { error: 'APK is currently being compiled. Please try again in 1 minute.' },
        { status: 404 }
      );
    }

    const stat = fs.statSync(apkPath);
    const fileStream = fs.createReadStream(apkPath);

    // Convert node readstream to web ReadableStream
    const readable = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      }
    });

    return new NextResponse(readable as any, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="SmartPump.apk"',
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=3600',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Download failed' }, { status: 500 });
  }
}
