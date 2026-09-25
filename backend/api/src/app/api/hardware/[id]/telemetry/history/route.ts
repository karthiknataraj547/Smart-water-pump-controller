import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@smartpump/database';
import { authenticateRequest } from '@/middleware/auth-guard';
import { verifyHardwareOwnership } from '@/middleware/ownership-guard';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { id: hardwareId } = await params;
  const ownership = await verifyHardwareOwnership(hardwareId, auth.user.userId);
  if (ownership.errorResponse) return ownership.errorResponse;

  const url = new URL(req.url);
  const range = url.searchParams.get('range') || 'DAY'; // 'LIVE' | 'DAY' | 'WEEK' | 'MONTH'

  const now = new Date();
  let startDate = new Date();

  switch (range) {
    case 'WEEK':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'MONTH':
      startDate.setDate(now.getDate() - 30);
      break;
    case 'LIVE':
      // Return last 60 raw sensor readings
      const liveReadings = await prisma.sensorReading.findMany({
        where: { hardwareId },
        orderBy: { timestamp: 'desc' },
        take: 60
      });
      return NextResponse.json({
        hardwareId,
        range: 'LIVE',
        points: liveReadings.reverse()
      });
    case 'DAY':
    default:
      startDate.setDate(now.getDate() - 1);
      break;
  }

  // Fetch hourly aggregated rollups to protect performance and avoid sending millions of raw rows
  const hourlyRollups = await prisma.telemetryHourly.findMany({
    where: {
      hardwareId,
      bucketStart: { gte: startDate }
    },
    orderBy: { bucketStart: 'asc' }
  });

  return NextResponse.json({
    hardwareId,
    range,
    points: hourlyRollups
  });
}
