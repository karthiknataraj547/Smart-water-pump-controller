-- PostgreSQL initialization script for Smart Water Pump Controller
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE smartpump_db TO smartpump_admin;

-- Set timezone to UTC
SET timezone = 'UTC';
