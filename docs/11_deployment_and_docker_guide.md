# 11 — Production Deployment & Docker Guide

## 1. Quick Start with Docker Compose
To spin up the complete cloud platform (MySQL 8.0, Redis 7, Mosquitto MQTT broker, Node.js Gateway, and Nginx reverse proxy):

```bash
cd docker
docker-compose up -d --build
```

Verify running containers:
```bash
docker-compose ps
```

## 2. Ports and Endpoints
- **Web App**: `http://localhost` (Port 80) / `https://localhost` (Port 443)
- **REST API Gateway**: `http://localhost:5000/api/v1`
- **WebSocket Realtime Hub**: `ws://localhost:5000/ws`
- **MQTT Broker (TCP)**: `localhost:1883`
- **MQTT Broker (WebSockets)**: `localhost:8883`
- **MySQL Relational Database**: `localhost:3306`
