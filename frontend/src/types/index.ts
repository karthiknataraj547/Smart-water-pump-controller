export type UserRole = 'admin' | 'operator' | 'technician' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: 'active' | 'suspended';
  created_at?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id?: string;
  device_id?: string;
  action: string;
  source: string;
  ip_information?: string;
  details?: string;
  user_name?: string;
  user_email?: string;
  device_uid?: string;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  total_devices: number;
  online_devices: number;
  active_alerts: number;
  total_readings: number;
  commands_today: number;
  system_uptime_seconds: number;
  heap_used_mb: string;
  node_version: string;
  mqtt_broker_port: number;
  ws_server_port: number;
}

export interface SafetyPolicy {
  overcurrentLimitAmps: number;
  dryRunTimeoutSec: number;
  maxContinuousRuntimeSec: number;
  autoStartLevelPct: number;
  autoStopLevelPct: number;
  shortCycleDelaySec: number;
}

export type PumpState = 'OFF' | 'ON' | 'FAULT' | 'STARTING' | 'STOPPING';
export type PumpMode = 'MANUAL' | 'AUTOMATIC' | 'SCHEDULED' | 'EMERGENCY_STOP';

export interface PumpStatus {
  id: string;
  device_id: string;
  pump_state: PumpState;
  mode: PumpMode;
  runtime_seconds: number;
  current_draw_amps: number;
  changed_at: string;
  changed_by: string;
}

export interface SensorReading {
  id: string;
  device_id: string;
  water_level_percentage: number;
  water_level_liters: number;
  inflow_rate_lpm: number;
  total_inflow_liters: number;
  tds_ppm: number;
  temperature_c: number;
  sensor_status: string;
  created_at: string;
}

export interface DeviceNode {
  id: string;
  main_device_id: string;
  node_uid: string;
  node_type: string;
  communication_status: 'connected' | 'lost';
  rssi: number;
  battery_level?: number;
  last_seen: string;
}

export interface Device {
  id: string;
  device_uid: string;
  serial_number: string;
  device_type: string;
  owner_id: string;
  status: 'online' | 'offline' | 'degraded' | 'provisioning';
  firmware_version: string;
  local_ip?: string;
  mac_address?: string;
  tank_capacity_liters: number;
  tank_height_cm: number;
  last_seen: string;
  nodes?: DeviceNode[];
}

export interface AutomationRule {
  id: string;
  device_id: string;
  rule_name: string;
  condition_json: {
    level_lt?: number;
    level_gt?: number;
    subnode_online?: boolean;
    max_runtime_minutes?: number;
    no_flow_timeout_seconds?: number;
  };
  action_json: {
    pump_action: 'START' | 'STOP' | 'EMERGENCY_STOP';
    generate_alert?: boolean;
    alert_severity?: 'info' | 'warning' | 'critical';
    alert_title?: string;
  };
  enabled: boolean;
  priority: number;
  created_at: string;
}

export interface Alert {
  id: string;
  device_id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  acknowledged: boolean | number;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
}

export interface BleScanResult {
  deviceUid: string;
  name: string;
  model: string;
  signalRssi: number;
  signalQuality: string;
  status: string;
  macAddress: string;
  advertisedServices?: string[];
}
