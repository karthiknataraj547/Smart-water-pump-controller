import { SYSTEM_CONSTANTS, HardwareStatus } from '@smartpump/shared';

export interface DeviceHeartbeatRecord {
  hardwareId: string;
  lastSeenMs: number;
  missedHeartbeats: number;
  status: HardwareStatus;
}

/**
 * Anti-Flickering Heartbeat Watchdog
 * Prevents rapid toggling between Online and Offline due to transient Wi-Fi drops.
 */
export class HeartbeatWatchdog {
  private devices = new Map<string, DeviceHeartbeatRecord>();
  private onStatusChangeCallback?: (hardwareId: string, newStatus: HardwareStatus, previousStatus: HardwareStatus) => void;

  constructor(onStatusChange?: (hardwareId: string, newStatus: HardwareStatus, previousStatus: HardwareStatus) => void) {
    this.onStatusChangeCallback = onStatusChange;
  }

  /**
   * Called every time a heartbeat or telemetry packet is received from the hardware.
   */
  public recordHeartbeat(hardwareId: string): void {
    const now = Date.now();
    const existing = this.devices.get(hardwareId);

    if (!existing) {
      this.devices.set(hardwareId, {
        hardwareId,
        lastSeenMs: now,
        missedHeartbeats: 0,
        status: HardwareStatus.ONLINE
      });
      this.onStatusChangeCallback?.(hardwareId, HardwareStatus.ONLINE, HardwareStatus.OFFLINE);
      return;
    }

    existing.lastSeenMs = now;
    existing.missedHeartbeats = 0; // Reset consecutive missed counter

    if (existing.status !== HardwareStatus.ONLINE && existing.status !== HardwareStatus.EMERGENCY_LOCKED) {
      const prev = existing.status;
      existing.status = HardwareStatus.ONLINE;
      this.onStatusChangeCallback?.(hardwareId, HardwareStatus.ONLINE, prev);
    }
  }

  /**
   * Periodic evaluation tick (run every 2-5 seconds in background worker)
   */
  public evaluateStatus(timeoutMs = SYSTEM_CONSTANTS.HEARTBEAT_TIMEOUT_MS): void {
    const now = Date.now();

    for (const [hardwareId, record] of this.devices.entries()) {
      const elapsed = now - record.lastSeenMs;

      // Check if threshold exceeded (default 15 seconds / 3 intervals)
      if (elapsed > timeoutMs) {
        if (record.status === HardwareStatus.ONLINE) {
          record.status = HardwareStatus.OFFLINE;
          record.missedHeartbeats = Math.floor(elapsed / SYSTEM_CONSTANTS.HEARTBEAT_INTERVAL_MS);
          this.onStatusChangeCallback?.(hardwareId, HardwareStatus.OFFLINE, HardwareStatus.ONLINE);
        }
      }
    }
  }

  public getDeviceStatus(hardwareId: string): HardwareStatus {
    return this.devices.get(hardwareId)?.status ?? HardwareStatus.OFFLINE;
  }
}
