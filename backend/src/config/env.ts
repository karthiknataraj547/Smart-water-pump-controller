import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  JWT_SECRET: process.env.JWT_SECRET || 'jwt_default_secret_key_pump_ctrl_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'jwt_refresh_default_key_pump_ctrl_2026',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  DB_TYPE: (process.env.DB_TYPE || 'sqlite') as 'sqlite' | 'mysql',
  DB_FILE: path.resolve(process.cwd(), process.env.DB_FILE || './data/water_pump.sqlite'),

  MYSQL: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'pump_admin',
    password: process.env.MYSQL_PASSWORD || 'pump_secure_password',
    database: process.env.MYSQL_DATABASE || 'smart_water_pump',
  },

  MQTT: {
    port: parseInt(process.env.MQTT_PORT || '1883', 10),
    wsPort: parseInt(process.env.MQTT_WS_PORT || '8883', 10),
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    user: process.env.MQTT_USER || 'iot_device',
    password: process.env.MQTT_PASSWORD || 'device_secure_token',
  },

  AUTOMATION: {
    defaultLowWaterStartPct: parseFloat(process.env.DEFAULT_LOW_WATER_START_PCT || '30'),
    defaultHighWaterStopPct: parseFloat(process.env.DEFAULT_HIGH_WATER_STOP_PCT || '95'),
    defaultMaxRuntimeMinutes: parseInt(process.env.DEFAULT_MAX_RUNTIME_MINUTES || '60', 10),
    defaultDryRunTimeoutSeconds: parseInt(process.env.DEFAULT_DRY_RUN_TIMEOUT_SECONDS || '120', 10),
  }
};
