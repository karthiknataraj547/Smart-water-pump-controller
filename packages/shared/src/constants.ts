// System Constants

export const SYSTEM_CONSTANTS = {
  HEARTBEAT_INTERVAL_MS: 5000,
  HEARTBEAT_MISSED_THRESHOLD: 3, // 3 intervals = 15 seconds
  HEARTBEAT_TIMEOUT_MS: 15000,
  
  TELEMETRY_INTERVAL_NORMAL_MS: 1000,
  TELEMETRY_INTERVAL_PUMPING_MS: 300,
  
  DEFAULT_TANK_CAPACITY_LITERS: 1000,
  DRY_RUN_FLOW_THRESHOLD_LPM: 1.0,
  DRY_RUN_DETECTION_SECONDS: 20,
  
  RATE_LIMITS: {
    AUTH_LOGIN: { limit: 5, windowMs: 60 * 1000 },
    AUTH_REGISTER: { limit: 3, windowMs: 10 * 60 * 1000 },
    PUMP_COMMANDS: { limit: 10, windowMs: 60 * 1000 },
    EMERGENCY_STOP: { limit: 60, windowMs: 60 * 1000 },
    GENERAL_API: { limit: 100, windowMs: 60 * 1000 },
  }
} as const;
