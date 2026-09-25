import { HeartbeatWatchdog } from '../src/heartbeat-watchdog';
import { HardwareStatus } from '@smartpump/shared';

describe('HeartbeatWatchdog (Hysteresis & Anti-Flickering)', () => {
  it('marks node ONLINE on initial heartbeat', () => {
    let changedStatus: HardwareStatus | null = null;
    const watchdog = new HeartbeatWatchdog((id, newStatus) => {
      changedStatus = newStatus;
    });

    watchdog.recordHeartbeat('hw_101');
    expect(watchdog.getDeviceStatus('hw_101')).toBe(HardwareStatus.ONLINE);
    expect(changedStatus).toBe(HardwareStatus.ONLINE);
  });

  it('keeps status ONLINE when within 15s hysteresis window', () => {
    const watchdog = new HeartbeatWatchdog();
    watchdog.recordHeartbeat('hw_101');

    // Simulate 8 seconds passing (less than 15000ms threshold)
    watchdog.evaluateStatus(15000);
    expect(watchdog.getDeviceStatus('hw_101')).toBe(HardwareStatus.ONLINE);
  });

  it('transitions to OFFLINE only after timeout threshold is exceeded', () => {
    let recordedNewStatus: HardwareStatus | null = null;
    const watchdog = new HeartbeatWatchdog((id, newStatus) => {
      recordedNewStatus = newStatus;
    });

    watchdog.recordHeartbeat('hw_101');

    // Simulate timeout by passing custom timeout of 0ms
    watchdog.evaluateStatus(-1);
    expect(watchdog.getDeviceStatus('hw_101')).toBe(HardwareStatus.OFFLINE);
    expect(recordedNewStatus).toBe(HardwareStatus.OFFLINE);

    // Node reconnects
    watchdog.recordHeartbeat('hw_101');
    expect(watchdog.getDeviceStatus('hw_101')).toBe(HardwareStatus.ONLINE);
  });
});
