import { prisma } from '@smartpump/database';
import { DeviceTelemetryPayload } from '@smartpump/shared';

interface TelemetryBufferItem {
  hardwareId: string;
  payload: DeviceTelemetryPayload;
  receivedAt: number;
}

export class TelemetryAggregatorService {
  private static buffer: TelemetryBufferItem[] = [];
  private static lastDbFlushPerHardware = new Map<string, number>();
  private static FLUSH_INTERVAL_MS = 5000; // Ingest 1 raw point per 5 seconds per hardware

  /**
   * Called whenever a high-frequency telemetry packet arrives over MQTT
   */
  public static async ingest(hardwareId: string, payload: DeviceTelemetryPayload): Promise<void> {
    const now = Date.now();
    this.buffer.push({ hardwareId, payload, receivedAt: now });

    const lastFlush = this.lastDbFlushPerHardware.get(hardwareId) || 0;
    if (now - lastFlush >= this.FLUSH_INTERVAL_MS) {
      this.lastDbFlushPerHardware.set(hardwareId, now);

      // Persist sampled sensor reading to database
      await prisma.sensorReading.create({
        data: {
          hardwareId,
          tankLevelPct: payload.tankLevelPct,
          waterVolumeL: payload.waterVolumeL,
          flowRateLpm: payload.flowRateLpm,
          tdsPpm: payload.tdsPpm,
          tdhMeters: payload.tdhMeters,
          timestamp: new Date(payload.timestamp)
        }
      });

      // Update live pumpState cache in database
      await prisma.pumpState.updateMany({
        where: { hardwareId },
        data: {
          currentFlowRateLpm: payload.flowRateLpm,
          headPressureMeters: payload.tdhMeters,
          updatedAt: new Date()
        }
      });
    }
  }

  /**
   * Rolls up raw sensor readings into hourly summary buckets
   * Run periodically (e.g., hourly cron or background worker)
   */
  public static async rollupHourlyBucket(hardwareId: string, hourStart: Date): Promise<void> {
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

    const readings = await prisma.sensorReading.findMany({
      where: {
        hardwareId,
        timestamp: {
          gte: hourStart,
          lt: hourEnd
        }
      }
    });

    if (readings.length === 0) return;

    let totalTankLevel = 0;
    let minTankLevel = 100;
    let maxTankLevel = 0;
    let totalFlow = 0;
    let totalTds = 0;

    for (const r of readings) {
      totalTankLevel += r.tankLevelPct;
      minTankLevel = Math.min(minTankLevel, r.tankLevelPct);
      maxTankLevel = Math.max(maxTankLevel, r.tankLevelPct);
      totalFlow += r.flowRateLpm;
      totalTds += r.tdsPpm;
    }

    const count = readings.length;
    const avgTankLevel = totalTankLevel / count;
    const avgFlowRate = totalFlow / count;
    const avgTds = totalTds / count;
    // Approximated pumped liters in this hour based on avg flow rate
    const totalWaterPumped = avgFlowRate * 60;

    await prisma.telemetryHourly.upsert({
      where: {
        hardwareId_bucketStart: {
          hardwareId,
          bucketStart: hourStart
        }
      },
      update: {
        avgTankLevel,
        minTankLevel,
        maxTankLevel,
        totalWaterPumped,
        avgFlowRate,
        avgTds,
        sampleCount: count
      },
      create: {
        hardwareId,
        bucketStart: hourStart,
        avgTankLevel,
        minTankLevel,
        maxTankLevel,
        totalWaterPumped,
        avgFlowRate,
        avgTds,
        totalPumpRuntimeSec: 0,
        sampleCount: count
      }
    });
  }

  /**
   * Prune raw telemetry readings older than retention period (e.g. 7 days)
   */
  public static async pruneOldRawReadings(retentionDays = 7): Promise<number> {
    const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.sensorReading.deleteMany({
      where: {
        timestamp: { lt: threshold }
      }
    });
    return result.count;
  }
}
