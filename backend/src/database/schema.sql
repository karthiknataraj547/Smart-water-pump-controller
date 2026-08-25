-- Smart IoT Water Pump Controller Database Schema (MySQL 8.0+)
-- Supports multi-tenant devices, high-frequency telemetry time-series, pump audit logs & local automation policies.

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    phone VARCHAR(30) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'operator', 'viewer') DEFAULT 'operator',
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(36) PRIMARY KEY,
    device_uid VARCHAR(64) NOT NULL UNIQUE,
    serial_number VARCHAR(64) NOT NULL UNIQUE,
    device_type VARCHAR(50) DEFAULT 'ESP32_MAIN_CONTROLLER',
    owner_id VARCHAR(36) NOT NULL,
    status ENUM('online', 'offline', 'degraded', 'provisioning') DEFAULT 'offline',
    firmware_version VARCHAR(20) DEFAULT 'v1.0.0',
    local_ip VARCHAR(45) NULL,
    mac_address VARCHAR(17) NULL,
    tank_capacity_liters DECIMAL(10,2) DEFAULT 1000.00,
    tank_height_cm DECIMAL(10,2) DEFAULT 150.00,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_device_uid (device_uid),
    INDEX idx_device_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS device_nodes (
    id VARCHAR(36) PRIMARY KEY,
    main_device_id VARCHAR(36) NOT NULL,
    node_uid VARCHAR(64) NOT NULL UNIQUE,
    node_type VARCHAR(50) DEFAULT 'esp8266_tank_subnode',
    communication_status ENUM('connected', 'lost') DEFAULT 'connected',
    rssi INT DEFAULT -65,
    battery_level DECIMAL(5,2) DEFAULT 100.0,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (main_device_id) REFERENCES devices(id) ON DELETE CASCADE,
    INDEX idx_node_uid (node_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pump_status (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    pump_state ENUM('OFF', 'ON', 'FAULT', 'STARTING', 'STOPPING') DEFAULT 'OFF',
    mode ENUM('MANUAL', 'AUTOMATIC', 'SCHEDULED', 'EMERGENCY_STOP') DEFAULT 'AUTOMATIC',
    runtime_seconds INT DEFAULT 0,
    current_draw_amps DECIMAL(6,2) DEFAULT 0.0,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(100) DEFAULT 'SYSTEM',
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    INDEX idx_pump_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sensor_readings (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    water_level_percentage DECIMAL(5,2) NOT NULL,
    water_level_liters DECIMAL(10,2) NOT NULL,
    inflow_rate_lpm DECIMAL(8,2) DEFAULT 0.0,
    total_inflow_liters DECIMAL(12,2) DEFAULT 0.0,
    tds_ppm DECIMAL(8,2) DEFAULT 150.0,
    temperature_c DECIMAL(5,2) DEFAULT 24.5,
    sensor_status VARCHAR(50) DEFAULT 'HEALTHY',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    INDEX idx_sensor_time (device_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_rules (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    condition_json JSON NOT NULL,
    action_json JSON NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    severity ENUM('info', 'warning', 'critical') DEFAULT 'info',
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(36) NULL,
    acknowledged_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    INDEX idx_alerts_device_ack (device_id, acknowledged)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NULL,
    device_id VARCHAR(36) NULL,
    action VARCHAR(100) NOT NULL,
    source ENUM('web', 'android', 'windows', 'hardware', 'automation') DEFAULT 'web',
    ip_information VARCHAR(64) NULL,
    details TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS device_commands (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    command_type VARCHAR(50) NOT NULL,
    payload JSON NOT NULL,
    status ENUM('pending', 'sent', 'executing', 'successful', 'failed', 'timeout') DEFAULT 'pending',
    requested_by VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_at DATETIME NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    INDEX idx_command_status (device_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
