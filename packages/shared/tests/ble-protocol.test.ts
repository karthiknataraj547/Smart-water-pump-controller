import { MockBleProvisioningServer, BleProvisioningState, BLE_GATT_UUIDS } from '../src/ble-protocol';

describe('BLE Provisioning Protocol', () => {
  it('has valid GATT UUIDs for service and characteristics', () => {
    expect(BLE_GATT_UUIDS.SERVICE).toBe('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
    expect(BLE_GATT_UUIDS.CHARACTERISTIC_DEVICE_INFO).toBeDefined();
    expect(BLE_GATT_UUIDS.CHARACTERISTIC_WIFI_PROV).toBeDefined();
    expect(BLE_GATT_UUIDS.CHARACTERISTIC_PROV_STATUS).toBeDefined();
  });

  it('successfully provisions Wi-Fi credentials to ESP32 simulator', async () => {
    const server = new MockBleProvisioningServer();
    expect(server.state).toBe(BleProvisioningState.IDLE);

    const finalState = await server.handleWifiProvisioning({
      ssid: 'Office_WiFi',
      password: 'StrongPassword123!',
      claimToken: '982310',
      mqttBrokerHost: '192.168.1.50'
    });

    expect(finalState).toBe(BleProvisioningState.PROVISIONED);
    expect(server.configuredSsid).toBe('Office_WiFi');
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const server = new MockBleProvisioningServer();
    const finalState = await server.handleWifiProvisioning({
      ssid: 'Office_WiFi',
      password: 'short',
      claimToken: '982310',
      mqttBrokerHost: '192.168.1.50'
    });

    expect(finalState).toBe(BleProvisioningState.FAILED_INVALID_PASSWORD);
  });
});
