export type UserRole = 'admin' | 'operator' | 'viewer';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export type DeviceStatus = 'online' | 'offline' | 'degraded' | 'provisioning';

export interface Device {
  id: string;
  device_uid: string;
  serial_number: string;
  device_type: string;
  owner_id: string;
  status: DeviceStatus;
  firmware_version: string;
  local_ip?: string;
  mac_address?: string;
  tank_capacity_liters: number;
  tank_height_cm: number;
  last_seen: string;
  created_at: string;
}

export type NodeCommunicationStatus = 'connected' | 'lost';

export interface DeviceNode {
  id: string;
  main_device_id: string;
  node_uid: string;
  node_type: 'esp8266_tank_subnode' | 'esp32_flow_subnode' | 'custom_sensor';
  communication_status: NodeCommunicationStatus;
  rssi: number;
  battery_level?: number;
  last_seen: string;
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
    schedule_cron?: string;
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

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  device_id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  device_id?: string;
  action: string;
  source: 'web' | 'android' | 'windows' | 'hardware' | 'automation';
  ip_information?: string;
  details?: string;
  created_at: string;
}

export type CommandStatus = 'pending' | 'sent' | 'executing' | 'successful' | 'failed' | 'timeout';

export interface DeviceCommand {
  id: string;
  device_id: string;
  command_type: 'START_PUMP' | 'STOP_PUMP' | 'SET_MODE' | 'SET_THRESHOLDS' | 'REBOOT' | 'OTA_START' | 'CALIBRATE_SENSORS';
  payload: Record<string, any>;
  status: CommandStatus;
  requested_by: string;
  created_at: string;
  executed_at?: string;
}

export interface TelemetryPayload {
  device_uid: string;
  node_uid?: string;
  water_level_pct: number;
  water_liters?: number;
  flow_rate_lpm: number;
  total_inflow_liters: number;
  tds_ppm: number;
  temperature_c: number;
  pump_state?: PumpState;
  current_amps?: number;
  sensor_health_mask?: number;
  rssi?: number;
  battery_mv?: number;
}
