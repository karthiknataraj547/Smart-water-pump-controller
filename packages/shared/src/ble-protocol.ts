// BLE GATT Service & Characteristics UUIDs and Protocol Contracts

export const BLE_GATT_UUIDS = {
  SERVICE: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
  CHARACTERISTIC_DEVICE_INFO: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
  CHARACTERISTIC_WIFI_SCAN: 'beb5483e-36e1-4688-b7f5-ea07361b26a9',
  CHARACTERISTIC_WIFI_PROV: 'beb5483e-36e1-4688-b7f5-ea07361b26aa',
  CHARACTERISTIC_PROV_STATUS: 'beb5483e-36e1-4688-b7f5-ea07361b26ab'
} as const;

export enum BleProvisioningState {
  IDLE = 'IDLE',
  CONNECTING_WIFI = 'CONNECTING_WIFI',
  WIFI_CONNECTED = 'WIFI_CONNECTED',
  CONNECTING_MQTT = 'CONNECTING_MQTT',
  PROVISIONED = 'PROVISIONED',
  FAILED_INVALID_PASSWORD = 'FAILED_INVALID_PASSWORD',
  FAILED_AP_NOT_FOUND = 'FAILED_AP_NOT_FOUND'
}

export interface BleDeviceInfo {
  serialNumber: string;
  firmwareVersion: string;
  chipModel: string;
  macAddress: string;
}

export interface BleWifiCredentialsPayload {
  ssid: string;
  password: string;
  claimToken: string;
  mqttBrokerHost: string;
}

/**
 * Mock simulator of ESP32 BLE GATT Server for automated testing
 */
export class MockBleProvisioningServer {
  public state: BleProvisioningState = BleProvisioningState.IDLE;
  public configuredSsid?: string;

  public async handleWifiProvisioning(payload: BleWifiCredentialsPayload): Promise<BleProvisioningState> {
    if (!payload.ssid) {
      this.state = BleProvisioningState.FAILED_AP_NOT_FOUND;
      return this.state;
    }

    if (payload.password.length < 8) {
      this.state = BleProvisioningState.FAILED_INVALID_PASSWORD;
      return this.state;
    }

    this.state = BleProvisioningState.CONNECTING_WIFI;
    this.configuredSsid = payload.ssid;
    
    // Simulate Wi-Fi connection followed by MQTT connection
    this.state = BleProvisioningState.WIFI_CONNECTED;
    this.state = BleProvisioningState.CONNECTING_MQTT;
    this.state = BleProvisioningState.PROVISIONED;
    return this.state;
  }
}
