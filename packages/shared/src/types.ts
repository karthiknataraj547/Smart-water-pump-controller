// Core enums and types for Smart Water Pump Controller

export enum HardwareStatus {
  UNCLAIMED = 'UNCLAIMED',
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE',
  EMERGENCY_LOCKED = 'EMERGENCY_LOCKED'
}

export enum PumpMode {
  MANUAL = 'MANUAL',
  AUTO = 'AUTO',
  DISABLED = 'DISABLED'
}

export enum PumpStateEnum {
  OFF = 'OFF',
  STARTING = 'STARTING',
  ON = 'ON',
  STOPPING = 'STOPPING',
  FAULT = 'FAULT',
  EMERGENCY_STOPPED = 'EMERGENCY_STOPPED'
}

export enum CommandType {
  PUMP_START = 'PUMP_START',
  PUMP_STOP = 'PUMP_STOP',
  SET_MODE = 'SET_MODE',
  EMERGENCY_STOP = 'EMERGENCY_STOP',
  RESET_EMERGENCY = 'RESET_EMERGENCY'
}

export enum CommandStatus {
  PENDING = 'PENDING',
  DISPATCHED = 'DISPATCHED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  FAILED = 'FAILED',
  TIMED_OUT = 'TIMED_OUT'
}

export interface DeviceTelemetryPayload {
  tankLevelPct: number;
  waterVolumeL: number;
  flowRateLpm: number;
  tdsPpm: number;
  tdhMeters: number;
  pumpState: PumpStateEnum;
  timestamp: number;
}

export interface DeviceHeartbeatPayload {
  uptimeSeconds: number;
  freeHeapBytes: number;
  wifiRssi: number;
  timestamp: number;
}

export interface DeviceStatePayload {
  status: 'ONLINE' | 'OFFLINE';
  firmwareVersion?: string;
  ipAddress?: string;
  macAddress?: string;
  reason?: string;
  timestamp: number;
}

export interface CommandPayload {
  commandId: string;
  command: CommandType;
  targetMode?: PumpMode;
  issuedByUserId: string;
  timestamp: number;
  reason?: string;
}

export interface CommandAckPayload {
  commandId: string;
  status: 'SUCCESS' | 'FAILED';
  pumpState: PumpStateEnum;
  relayPinActive: boolean;
  errorCode?: string | null;
  timestamp: number;
}

export interface SubNodeSensorPayload {
  subNodeId: string;
  distanceCm: number;
  waterLevelPct: number;
  flowRateLpm: number;
  tdsPpm: number;
  batteryPercent: number;
  rssi: number;
  timestamp: number;
}
