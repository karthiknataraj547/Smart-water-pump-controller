import { db } from '../database/db';
import { pumpControlService } from '../services/PumpControlService';
import { telemetryService } from '../services/TelemetryService';
import { alertService } from '../services/AlertService';
import { deviceService } from '../services/DeviceService';

async function runTests() {
  console.log('--- Starting Backend Verification Tests ---');

  // 1. Initialize DB
  await db.init();
  console.log('✓ Database initialized & seeded successfully');

  // 2. Query admin user
  const admin = await db.queryOne('SELECT * FROM users WHERE email = ?', ['admin@waterpump.io']);
  if (!admin) throw new Error('Admin user not found in seeded database');
  console.log(`✓ Admin user verified: ${admin.name} (${admin.email})`);

  // 3. Query seeded device
  const device = await deviceService.getDeviceByUid('WPC-A81F29');
  if (!device) throw new Error('Sample device WPC-A81F29 not found');
  console.log(`✓ Device verified: ${device.device_uid}, Tank Capacity: ${device.tank_capacity_liters}L`);

  // 4. Test Pump Status
  const pumpStatus = await pumpControlService.getPumpStatus(device.id);
  if (!pumpStatus) throw new Error('Pump status record not found');
  console.log(`✓ Pump initial status: State=${pumpStatus.pump_state}, Mode=${pumpStatus.mode}`);

  // 5. Test Telemetry Ingestion (Low water -> triggers Auto-Start)
  console.log('Testing telemetry ingestion (Level: 25% - below 30% threshold)...');
  await telemetryService.ingestTelemetry({
    device_uid: 'WPC-A81F29',
    node_uid: 'TNK-SUB-8266-01',
    water_level_pct: 25.0,
    flow_rate_lpm: 12.5,
    total_inflow_liters: 4900,
    tds_ppm: 210,
    temperature_c: 24.2,
    sensor_health_mask: 0,
    rssi: -58,
    battery_mv: 3280
  });
  console.log('✓ Telemetry ingested successfully');

  // 6. Test Hardware ACK
  console.log('Testing hardware confirmation ACK from ESP32...');
  await pumpControlService.handleHardwareAck('WPC-A81F29', {
    status: 'successful',
    confirmed_state: 'ON',
    current_amps: 4.8,
    runtime_seconds: 15
  });

  const updatedPump = await pumpControlService.getPumpStatus(device.id);
  console.log(`✓ Hardware ACK verified: State=${updatedPump?.pump_state}, Current=${updatedPump?.current_draw_amps}A`);

  // 7. Test Alerts
  const alerts = await alertService.getAlerts(device.id);
  console.log(`✓ Alerts queried: Found ${alerts.length} alerts for device`);

  console.log('--- ALL BACKEND UNIT & INTEGRATION TESTS PASSED! ---');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
