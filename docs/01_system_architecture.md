# 01 — Complete System Architecture & Topology

## 1. System Vision
The **Smart IoT Water Pump Control & Telemetry Platform** is an enterprise-grade industrial automation ecosystem. It solves the critical reliability challenges in residential, agricultural, and commercial water management:
1. **Zero-Internet Local Operation**: The system continues automated filling, dry-run safety lockouts, and tank monitoring even if cloud connectivity is completely severed.
2. **Dual-Microcontroller Hierarchy**: 
   - **ESP8266 Sub Node**: Low-power, tank-top sensor telemetry acquisition node.
   - **ESP32 Main Node**: Industrial edge controller driving opto-isolated contactor switches, running FreeRTOS automation tasks, BLE provisioning, and MQTT/TLS telemetry relay.
3. **True Real-time Multi-Platform Synchronization**: Web, Android Mobile APK, and Windows Projector / Control Room display receive 50Hz sub-second telemetry and hardware state confirmation ACKs.

## 2. High-Level Architecture Diagram

```mermaid
graph TD
    subgraph WaterTank["Top Water Tank Subsystem"]
        Ultrasonic["HC-SR04 / JSN-SR04T Sensor"] --> SubNode["ESP8266 Sub Node"]
        FlowMeter["YF-S201 Flow Pulse Counter"] --> SubNode
        TDS["Analog TDS ppm Sensor"] --> SubNode
        FloatSwitch["Emergency Float Backup"] --> SubNode
    end

    subgraph PumpRoom["Pump / Control Room Subsystem"]
        MainNode["ESP32 Main Controller Node\n(Dual Core FreeRTOS)"]
        Relay["Opto-Isolated Relay (PC817)"]
        Contactor["Industrial 3-Phase / 1-Phase Contactor"]
        Pump["High-Power Pump Motor"]
        ACS712["ACS712 Motor Current Feedback"]
        
        MainNode -->|GPIO 23| Relay --> Contactor --> Pump
        Pump -.->|Current Draw| ACS712 -->|ADC1 CH6| MainNode
    end

    SubNode -->|"ESP-NOW Protocol (2.4GHz Local Direct Link)"| MainNode

    subgraph CloudLayer["Cloud Gateway & Middleware (Docker / Node.js + TypeScript)"]
        Gateway["REST & WebSocket API Gateway"]
        Broker["MQTT 5.0 / TLS Message Broker"]
        DB[(MySQL 8.0 Relational DB / Persistent Engine)]
        Redis[(Redis Cache & Session Hub)]
        RulesEngine["Cloud Automation & Alerting Engine"]

        Gateway <--> DB
        Gateway <--> Redis
        Broker <--> Gateway
        RulesEngine <--> DB
    end

    MainNode <-->|"MQTT over TLS / Secure WS (QoS 1 with Hardware ACK)"| CloudLayer

    subgraph ClientLayer["Multi-Platform Client Applications"]
        WebApp["Luxury Skeuomorphic Web Application"]
        AndroidApp["Native Android Mobile APK (Capacitor + BLE)"]
        WindowsApp["Windows Projector & Control Room Console"]
    end

    CloudLayer <-->|HTTPS REST & WSS| WebApp
    CloudLayer <-->|HTTPS REST & WSS| AndroidApp
    CloudLayer <-->|HTTPS REST & WSS| WindowsApp
```

## 3. Data Flow Progression
1. **Sensor Acquisition (ESP8266)**: Measures time-of-flight distance, pulse count, and analog TDS voltage every 2000ms.
2. **Local Transmission (ESP-NOW)**: Packages payload with sequence number, magic byte `0xAA`, and CRC16 checksum. Unicasts to ESP32 Main Node.
3. **Edge Rule Evaluation (ESP32)**: FreeRTOS Core 1 evaluates local safety rules (low water start, high water stop, dry-run zero inflow trip).
4. **Hardware Actuation**: Triggers opto-isolated relay to pull down contactor coil. Reads current feedback from ACS712.
5. **Cloud Telemetry Relay**: FreeRTOS Core 0 publishes JSON telemetry payload to MQTT topic `devices/{device_uid}/telemetry`.
6. **Real-time Client Broadcast**: Cloud backend ingests packet, persists to database, and broadcasts over WebSocket (`/ws`) to all connected Web, Android, and Windows clients without page reload.
