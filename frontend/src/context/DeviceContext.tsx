import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Device, PumpStatus, PumpState, SensorReading, Alert, AutomationRule } from '../types';
import { ApiService, getCustomGatewayUrl } from '../services/api';
import { useAuth } from './AuthContext';
import mqtt, { MqttClient } from 'mqtt';

interface DeviceContextType {
  devices: Device[];
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device) => void;
  pumpStatus: PumpStatus | null;
  telemetry: SensorReading | null;
  alerts: Alert[];
  rules: AutomationRule[];
  wsConnected: boolean;
  mqttConnected: boolean;
  isDeviceOnline: boolean;
  isSubnodeOnline: boolean;
  subnodeError: string | null;
  isWaterLevelSensorOnline: boolean;
  waterLevelSensorError: string | null;
  commandPending: boolean;
  commandStatusText: string;
  refreshDevices: () => Promise<void>;
  refreshRules: () => Promise<void>;
  syncRulesToHardware: (rulesList?: AutomationRule[]) => Promise<void>;
  reconnectWs: () => Promise<void>;
  startPump: () => Promise<void>;
  stopPump: () => Promise<void>;
  setMode: (mode: string) => Promise<void>;
  emergencyStop: (reason?: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

function getWsUrl(token: string | null): string | null {
  const custom = getCustomGatewayUrl() || localStorage.getItem('pump_custom_gateway');
  if (custom && custom.trim().length > 0) {
    const clean = custom.trim().replace(/^http/, 'ws');
    return `${clean}/ws?token=${token || ''}&clientType=web`;
  }

  const metaEnv = (import.meta as any)?.env;
  if (metaEnv?.VITE_API_URL) {
    const clean = metaEnv.VITE_API_URL.replace(/^http/, 'ws');
    return `${clean}/ws?token=${token || ''}&clientType=web`;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost';
    if (host === 'localhost' || host === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${host}:5000/ws?token=${token || ''}&clientType=web`;
    }
  }

  return null;
}

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [pumpStatus, setPumpStatus] = useState<PumpStatus | null>(null);
  const [telemetry, setTelemetry] = useState<SensorReading | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [mqttConnected, setMqttConnected] = useState<boolean>(false);
  const [commandPending, setCommandPending] = useState<boolean>(false);
  const [commandStatusText, setCommandStatusText] = useState<string>('');
  
  // Real-Time Heartbeat & Sensor Health Tracker
  const [isDeviceOnline, setIsDeviceOnline] = useState<boolean>(false);
  const [isSubnodeOnline, setIsSubnodeOnline] = useState<boolean>(true);
  const [subnodeError, setSubnodeError] = useState<string | null>(null);
  const [isWaterLevelSensorOnline, setIsWaterLevelSensorOnline] = useState<boolean>(true);
  const [waterLevelSensorError, setWaterLevelSensorError] = useState<string | null>(null);
  const lastTelemetryTimestampRef = useRef<number>(0);
  const lastSubnodeTimestampRef = useRef<number>(Date.now());

  const wsRef = useRef<WebSocket | null>(null);
  const mqttClientRef = useRef<MqttClient | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1-second interval heartbeat check (no UI freezing, stable online detection)
  useEffect(() => {
    const timer = setInterval(() => {
      const isOnline = Date.now() - lastTelemetryTimestampRef.current < 10000;
      setIsDeviceOnline(prev => (prev !== isOnline ? isOnline : prev));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load devices on auth change
  const refreshDevices = useCallback(async () => {
    try {
      const list = await ApiService.getDevices();
      setDevices(list);
      if (list.length > 0) {
        setSelectedDevice(prev => {
          if (!prev) {
            const wpc = list.find((d: Device) => d.device_uid === 'WPC-A81F29');
            return wpc || list[0];
          }
          const found = list.find((d: Device) => d.id === prev.id);
          return found || list[0];
        });
      }
    } catch (err) {
      console.warn('[DeviceContext] Error fetching devices:', err);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
  }, [token, refreshDevices]);

  const lastActionTimeRef = useRef<number>(0);

  // Load device-specific data when selected device changes
  const loadDeviceData = useCallback(async (deviceId: string) => {
    try {
      const [pStatus, aList, rList, sLatest] = await Promise.allSettled([
        ApiService.getPumpStatus(deviceId),
        ApiService.getAlerts(deviceId),
        ApiService.getAutomationRules(deviceId),
        ApiService.getLatestSensorReading(deviceId)
      ]);

      if (pStatus.status === 'fulfilled' && pStatus.value) {
        // Protect active live MQTT stream and recent operator actions from being overwritten by stale REST polling
        const isLiveTelemetryActive = (Date.now() - lastTelemetryTimestampRef.current < 8000);
        if (!isLiveTelemetryActive && (Date.now() - lastActionTimeRef.current >= 6000)) {
          setPumpStatus(pStatus.value);
        }
      }
      if (aList.status === 'fulfilled' && aList.value) setAlerts(aList.value);
      if (rList.status === 'fulfilled' && rList.value) setRules(rList.value);
      if (sLatest.status === 'fulfilled' && sLatest.value) {
        const isLiveTelemetryActive = (Date.now() - lastTelemetryTimestampRef.current < 8000);
        if (!isLiveTelemetryActive) {
          setTelemetry(prev => prev || sLatest.value);
        }
      }
    } catch (err) {
      console.warn('[DeviceContext] Error loading device details:', err);
    }
  }, []);

  // Real-time periodic synchronization poll (every 5 seconds)
  useEffect(() => {
    if (!selectedDevice) return;
    loadDeviceData(selectedDevice.id);

    const pollTimer = setInterval(() => {
      loadDeviceData(selectedDevice.id);
    }, 5000);

    return () => clearInterval(pollTimer);
  }, [selectedDevice, loadDeviceData]);

  const refreshRules = useCallback(async () => {
    if (!selectedDevice) return;
    try {
      const updated = await ApiService.getAutomationRules(selectedDevice.id);
      setRules(updated);
    } catch (err) {
      console.warn('[DeviceContext] Error refreshing rules:', err);
    }
  }, [selectedDevice]);

  const selectedDeviceRef = useRef<Device | null>(selectedDevice);
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  // =========================================================================
  // CLOUD MQTT DIRECT WEBSOCKET CONNECTION (wss://broker.emqx.io:8084/mqtt)
  // =========================================================================
  useEffect(() => {
    const connectMqtt = () => {
      const brokerWsUrl = 'wss://broker.emqx.io:8084/mqtt';
      console.log('[MQTT] Connecting browser MQTT client to:', brokerWsUrl);

      try {
        const client = mqtt.connect(brokerWsUrl, {
          clientId: `AquaControl_Web_${Math.random().toString(16).substring(2, 8)}`,
          username: 'WPC-A81F29',
          password: 'WPC_AUTH_SECURE_KEY_2026',
          reconnectPeriod: 2000,
          connectTimeout: 8000,
          keepalive: 30
        });
        mqttClientRef.current = client;

        client.on('connect', () => {
          console.log('[MQTT] ✓ Browser connected to Cloud MQTT Broker (broker.emqx.io)! Subscribing to AquaControl topics...');
          setMqttConnected(true);
          // Subscribe specifically to target namespaces
          client.subscribe('devices/WPC-A81F29/telemetry');
          client.subscribe('devices/WPC-A81F29/ack');
          client.subscribe('devices/WPC-A81F29/status');
          client.subscribe('aquacontrol/WPC-A81F29/telemetry');
          client.subscribe('aquacontrol/WPC-A81F29/ack');
          client.subscribe('aquacontrol/WPC-A81F29/status');
          client.subscribe('aquacontrol/telemetry');
          client.subscribe('aquacontrol/status');
          client.subscribe('aquacontrol/ack');
        });

        client.on('message', (topic: string, message: Buffer) => {
          try {
            const payloadStr = message.toString();
            if (!payloadStr || payloadStr.trim().length === 0) return;
            const data = JSON.parse(payloadStr);

            // STRICT FILTER: Discard public messages from other strangers' devices
            const isOurDevice = topic.includes('WPC-A81F29') || 
                                topic.startsWith('aquacontrol') || 
                                data.device_uid === 'WPC-A81F29' || 
                                data.deviceUid === 'WPC-A81F29';

            if (!isOurDevice) return;

            console.log(`%c[AquaControl LIVE HW] Topic: '${topic}'`, 'color: #10b981; font-weight: bold;', data);

            let deviceUid = data.device_uid || data.deviceUid || 'WPC-A81F29';
            let subTopic = '';

            const parts = topic.split('/');
            if (parts[0] === 'devices') {
              if (parts.length === 2) {
                subTopic = parts[1];
              } else if (parts.length >= 3) {
                deviceUid = parts[1];
                subTopic = parts[2];
              }
            } else if (parts[0] === 'aquacontrol') {
              if (parts.length >= 5) {
                deviceUid = parts[3];
                subTopic = parts[4];
              } else if (parts.length >= 2) {
                subTopic = parts[parts.length - 1];
              }
            }

            // Fallback inference if payload contains specific fields
            if (!subTopic) {
              if (data.water_level_pct !== undefined || data.water_level_percentage !== undefined) {
                subTopic = 'telemetry';
              } else if (data.confirmed_state !== undefined || data.pump_state !== undefined) {
                subTopic = 'ack';
              } else if (data.status !== undefined) {
                subTopic = 'status';
              }
            }

            if (subTopic === 'telemetry' || data.water_level_pct !== undefined || data.water_level_percentage !== undefined) {
              const now = Date.now();
              lastTelemetryTimestampRef.current = now;
              setIsDeviceOnline(true);
              setSelectedDevice(prev => prev ? { ...prev, status: 'online' } : prev);
              setDevices(prev => prev.map(d => d.device_uid === deviceUid ? { ...d, status: 'online' } : d));

              const isSubOnline = data.subnode_online !== undefined ? Boolean(data.subnode_online) : 
                                  (data.subNodeOnline !== undefined ? Boolean(data.subNodeOnline) : true);
              setIsSubnodeOnline(isSubOnline);

              // Granular Water Level Sensor Probe Fault Detection
              const isUltrasonicFault = Boolean(data.water_level_fault) || 
                                        (data.ultrasonic_online === false) ||
                                        (data.sensor_status === 'ULTRASONIC_FAULT') || 
                                        (data.water_level_pct < 0);
              const isLevelOk = isSubOnline && !isUltrasonicFault;
              setIsWaterLevelSensorOnline(isLevelOk);

              if (isSubOnline) {
                lastSubnodeTimestampRef.current = now;
                setSubnodeError(null);

                if (isUltrasonicFault) {
                  setWaterLevelSensorError('Water Level Sensor Fault: Ultrasonic probe (JSN-SR04T) disconnected or not responding');
                  setAlerts(prev => {
                    if (prev.some(a => a.id === 'alert_ultrasonic_fault' && !a.acknowledged)) return prev;
                    return [
                      {
                        id: 'alert_ultrasonic_fault',
                        device_id: selectedDeviceRef.current?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
                        severity: 'warning',
                        title: 'WATER LEVEL SENSOR HARDWARE FAULT',
                        message: 'Sub-Node (ESP8266) is communicating via ESP-NOW, but the ultrasonic level probe (JSN-SR04T) is unplugged or returning invalid echoes.',
                        acknowledged: false,
                        created_at: new Date().toISOString()
                      },
                      ...prev
                    ];
                  });
                } else {
                  setWaterLevelSensorError(null);
                }
              } else {
                setSubnodeError('Tank Sub-Node Disconnected (ESP-NOW RF Link Lost)');
                setWaterLevelSensorError('Sensor Unreachable (Sub-Node Disconnected)');
                setAlerts(prev => {
                  if (prev.some(a => a.id === 'alert_subnode_lost' && !a.acknowledged)) return prev;
                  return [
                    {
                      id: 'alert_subnode_lost',
                      device_id: selectedDeviceRef.current?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
                      severity: 'critical',
                      title: 'TANK SENSOR SUB-NODE DISCONNECTED',
                      message: 'Main controller is not receiving data from Tank Sub-Node (ESP8266). Water level and flow sensors are offline.',
                      acknowledged: false,
                      created_at: new Date().toISOString()
                    },
                    ...prev
                  ];
                });
              }

              const rawPct = Number(data.water_level_percentage ?? data.water_level_pct ?? data.waterLevelPercentage ?? 0);
              const waterPct = isLevelOk ? Math.max(0, rawPct) : 0;
              const waterLiters = isLevelOk ? Number(data.water_level_liters ?? data.waterLevelLiters ?? (waterPct * 20)) : 0;
              const flowRate = isSubOnline ? Number(data.inflow_rate_lpm ?? data.flow_rate_lpm ?? data.inflowRateLpm ?? 0) : 0;
              const totalLiters = isSubOnline ? Number(data.total_inflow_liters ?? data.total_inflow_l ?? data.totalInflowLiters ?? 0) : 0;
              const tds = isSubOnline ? Number(data.tds_ppm ?? data.tdsPpm ?? 0) : 0;
              const temp = isSubOnline ? Number(data.temperature_c ?? data.temperatureC ?? 25) : 0;
              const status = !isSubOnline ? 'SUBNODE_DISCONNECTED' : (isUltrasonicFault ? 'ULTRASONIC_FAULT' : (data.sensor_status || 'HEALTHY'));

              setTelemetry({
                id: `tel_${now}`,
                device_id: selectedDeviceRef.current?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
                water_level_percentage: waterPct,
                water_level_liters: waterLiters,
                inflow_rate_lpm: flowRate,
                total_inflow_liters: totalLiters,
                tds_ppm: tds,
                temperature_c: temp,
                sensor_status: status,
                created_at: new Date(now).toISOString()
              });

              if (typeof data.pump_running === 'boolean' || data.pump_state) {
                const isRunning = data.pump_running === true || data.pump_state === 'ON' || String(data.pump_state).toUpperCase() === 'ON';
                const hwAmps = Number(data.current_amps ?? (isRunning ? 4.8 : 0.0));
                const hwRuntime = Number(data.runtime_seconds ?? 0);
                const hwMode = (data.pump_mode || 'AUTOMATIC') as any;
                const hwState: PumpState = isRunning ? 'ON' : (data.pump_state === 'FAULT' ? 'FAULT' : 'OFF');

                setPumpStatus(prev => ({
                  ...(prev || {
                    id: 'ps_live',
                    device_id: selectedDeviceRef.current?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
                    mode: hwMode,
                    runtime_seconds: 0,
                    changed_at: new Date().toISOString(),
                    changed_by: 'HARDWARE_TELEMETRY'
                  }),
                  pump_state: hwState,
                  mode: hwMode,
                  current_draw_amps: hwAmps,
                  runtime_seconds: hwRuntime > 0 ? hwRuntime : (prev?.runtime_seconds || 0)
                }));

                setCommandPending(false);
              }
            } else if (subTopic === 'ack') {
              const isHwOn = data.confirmed_state === 'ON' || data.pump_state === 'ON' || data.state === 'ON';
              const isHwFault = data.confirmed_state === 'FAULT' || data.confirmed_state === 'EMERGENCY_STOP' || data.pump_state === 'FAULT';
              const confirmedState: PumpState = isHwOn ? 'ON' : (isHwFault ? 'FAULT' : 'OFF');
              const hwAmps = Number(data.current_amps ?? (confirmedState === 'ON' ? 4.8 : 0.0));
              const hwRuntime = Number(data.runtime_seconds ?? 0);

              setPumpStatus(prev => ({
                ...(prev || {
                  id: 'ps_live',
                  device_id: selectedDeviceRef.current?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
                  mode: 'AUTOMATIC',
                  runtime_seconds: 0,
                  changed_at: new Date().toISOString(),
                  changed_by: 'HARDWARE_ACK'
                }),
                pump_state: confirmedState,
                mode: (data.pump_mode || prev?.mode || 'AUTOMATIC') as any,
                current_draw_amps: hwAmps,
                runtime_seconds: hwRuntime > 0 ? hwRuntime : (prev?.runtime_seconds || 0)
              }));

              setCommandPending(false);
            } else if (subTopic === 'status') {
              const isOnline = data.status === 'online';
              if (isOnline) {
                const now = Date.now();
                lastTelemetryTimestampRef.current = now;
                setIsDeviceOnline(true);
                setSelectedDevice(prev => prev ? { ...prev, status: 'online' } : prev);
                setDevices(prev => prev.map(d => d.device_uid === deviceUid ? { ...d, status: 'online' } : d));
                if (data.pump_state) {
                  const isRunning = data.pump_state === 'ON' || data.pump_running === true;
                  const hwState: PumpState = isRunning ? 'ON' : (data.pump_state === 'FAULT' ? 'FAULT' : 'OFF');
                  setPumpStatus(prev => {
                    if (prev?.pump_state === 'STARTING' && !isRunning && (Date.now() - lastActionTimeRef.current < 2500)) {
                      return prev;
                    }
                    if (prev?.pump_state === 'STOPPING' && isRunning && (Date.now() - lastActionTimeRef.current < 2500)) {
                      return prev;
                    }
                    return prev ? { ...prev, pump_state: hwState } : null;
                  });
                  setCommandPending(false);
                }
              } else {
                setSelectedDevice(prev => prev ? { ...prev, status: 'offline' } : prev);
                setDevices(prev => prev.map(d => d.device_uid === deviceUid ? { ...d, status: 'offline' } : d));
              }
            }
          } catch (err) {
            console.warn('[MQTT Client] Error processing message payload:', err);
          }
        });
      } catch (err) {
        console.warn('[MQTT Client] Init error:', err);
      }
    };

    connectMqtt();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (mqttClientRef.current) {
        mqttClientRef.current.end(true);
        mqttClientRef.current = null;
      }
    };
  }, [token]);

  // Local Gateway WebSocket Connection (Dual-Path Ingestion)
  const connectWs = useCallback(() => {
    const wsUrl = getWsUrl(token);
    if (!wsUrl) {
      setWsConnected(false);
      return;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to Local Gateway Hub!');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleWebSocketMessage(msg);
        } catch (e) {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => connectWs(), 3000);
      };

      ws.onerror = () => {
        try { ws.close(); } catch (e) {}
      };
    } catch (err) {
      setWsConnected(false);
    }
  }, [token]);

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWs]);

  // WebSocket Inbound Message Handler
  const handleWebSocketMessage = (msg: { event: string; data: any }) => {
    const { event, data } = msg;

    if (event === 'DEVICE_STATUS' || event === 'DEVICE_STATUS_CHANGED') {
      const { deviceId, deviceUid, status } = data;
      setDevices(prev =>
        prev.map(d => (d.id === deviceId || d.device_uid === deviceUid ? { ...d, status } : d))
      );
      setSelectedDevice(prev => {
        if (!prev) return prev;
        if (prev.id === deviceId || prev.device_uid === deviceUid) {
          return { ...prev, status };
        }
        return prev;
      });

      if (status === 'offline') {
        lastTelemetryTimestampRef.current = 0;
        setIsDeviceOnline(false);
      }
    } else if (event === 'TELEMETRY_UPDATE') {
      lastTelemetryTimestampRef.current = Date.now();
      setIsDeviceOnline(true);
      setSelectedDevice(prev => prev ? { ...prev, status: 'online' } : prev);
      setDevices(prev => prev.map(d => d.device_uid === data.deviceUid ? { ...d, status: 'online' } : d));
      
      if (!selectedDevice || data.deviceUid === selectedDevice.device_uid) {
        setTelemetry({
          id: data.readingId || 'latest',
          device_id: data.deviceId || selectedDevice?.id || '',
          water_level_percentage: Number(data.waterLevelPercentage ?? 0),
          water_level_liters: Number(data.waterLevelLiters ?? 0),
          inflow_rate_lpm: Number(data.inflowRateLpm ?? 0),
          total_inflow_liters: Number(data.totalInflowLiters ?? 0),
          tds_ppm: Number(data.tdsPpm ?? 0),
          temperature_c: Number(data.temperatureC ?? 25),
          sensor_status: data.sensorStatus || 'HEALTHY',
          created_at: data.timestamp || new Date().toISOString()
        });

        if (data.pumpState !== undefined || typeof data.pumpRunning === 'boolean') {
          const isRunning = data.pumpRunning === true || data.pumpState === 'ON';
          setPumpStatus(prev => {
            if (prev?.pump_state === 'STARTING' && !isRunning) {
              return prev; // Await hardware verification
            }
            return {
              ...(prev || {
                id: 'ps_live',
                device_id: data.deviceId || selectedDevice?.id || '',
                mode: data.pumpMode || 'AUTOMATIC',
                runtime_seconds: 0,
                changed_at: new Date().toISOString(),
                changed_by: 'HARDWARE_TELEMETRY'
              }),
              pump_state: isRunning ? 'ON' : (data.pumpState === 'FAULT' ? 'FAULT' : 'OFF'),
              mode: (data.pumpMode || prev?.mode || 'AUTOMATIC') as any,
              current_draw_amps: Number(data.currentAmps ?? (isRunning ? 4.8 : 0.0)),
              runtime_seconds: Number(data.runtimeSeconds ?? prev?.runtime_seconds ?? 0)
            };
          });

          if (isRunning) {
            setCommandPending(false);
          }
        }
      }
    } else if (event === 'PUMP_STATE_CHANGED') {
      setSelectedDevice(prev => prev ? { ...prev, status: 'online' } : prev);
      setDevices(prev => prev.map(d => d.device_uid === data.deviceUid ? { ...d, status: 'online' } : d));
      if (!selectedDevice || data.deviceUid === selectedDevice.device_uid) {
        setPumpStatus(prev => ({
          ...(prev || {}),
          ...data
        }));
        if (data.pump_state === 'ON' || data.pump_state === 'OFF') {
          setCommandPending(false);
        }
      }
    } else if (event === 'NEW_ALERT') {
      setAlerts(prev => [data, ...prev]);
    }
  };

  // Helper to publish direct MQTT command (100ms ultra-low latency)
  const publishDirectMqttCommand = (cmdType: string, actionStr: string, payload: any = {}) => {
    const devUid = selectedDevice?.device_uid || 'WPC-A81F29';
    const cmdId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cmdPayload = JSON.stringify({
      cmd_id: cmdId,
      command: actionStr,
      command_type: cmdType,
      auth_token: 'WPC_AUTH_SECURE_KEY_2026',
      payload,
      timestamp: Math.floor(Date.now() / 1000)
    });

    if (mqttClientRef.current && mqttClientRef.current.connected) {
      mqttClientRef.current.publish(`devices/${devUid}/commands`, cmdPayload, { qos: 0 });
      mqttClientRef.current.publish(`aquacontrol/${devUid}/commands`, cmdPayload, { qos: 0 });
      mqttClientRef.current.publish(`aquacontrol/v1/devices/${devUid}/commands`, cmdPayload, { qos: 0 });
      console.log(`[MQTT Direct 100ms] Published command to '${devUid}':`, cmdPayload);
    }
  };

  // Immediate Zero-Wait Pump Command Actions (Instant UI Response, Backend Handles Verification & Logic)
  const startPump = async () => {
    const dev = selectedDeviceRef.current || selectedDevice;
    if (!dev) return;
    lastActionTimeRef.current = Date.now();
    setCommandPending(false);
    setCommandStatusText('');

    // 1. Instant optimistic state update on frontend
    setPumpStatus(prev => ({
      ...(prev || {
        id: 'ps_live',
        device_id: dev.id,
        mode: 'MANUAL',
        runtime_seconds: 0,
        changed_at: new Date().toISOString(),
        changed_by: 'WEB_OPERATOR'
      }),
      pump_state: 'ON',
      mode: prev?.mode === 'AUTOMATIC' ? 'AUTOMATIC' : 'MANUAL',
      current_draw_amps: 4.8
    }));

    // 2. Direct MQTT Command dispatch to hardware
    publishDirectMqttCommand('START_PUMP', 'START');

    // 3. Parallel REST API notification (Backend handles database persistence, command queuing & verification)
    ApiService.startPump(dev.id, user?.email || 'web_operator')
      .catch((err: any) => {
        console.warn('[DeviceContext] Backend start notification note:', err.message);
      });
  };

  const stopPump = async () => {
    const dev = selectedDeviceRef.current || selectedDevice;
    if (!dev) return;
    lastActionTimeRef.current = Date.now();
    setCommandPending(false);
    setCommandStatusText('');

    // 1. Instant optimistic state update on frontend
    setPumpStatus(prev => ({
      ...(prev || {
        id: 'ps_live',
        device_id: dev.id,
        mode: 'MANUAL',
        runtime_seconds: 0,
        changed_at: new Date().toISOString(),
        changed_by: 'WEB_OPERATOR'
      }),
      pump_state: 'OFF',
      current_draw_amps: 0.0
    }));

    // 2. Direct MQTT Command dispatch to hardware
    publishDirectMqttCommand('STOP_PUMP', 'STOP');

    // 3. Parallel REST API notification
    ApiService.stopPump(dev.id, user?.email || 'web_operator')
      .catch((err: any) => {
        console.warn('[DeviceContext] Backend stop notification note:', err.message);
      });
  };

  const setMode = async (mode: string) => {
    const dev = selectedDeviceRef.current || selectedDevice;
    if (!dev) return;
    lastActionTimeRef.current = Date.now();

    // 1. Instant 0ms Optimistic UI Update
    setPumpStatus(prev => prev ? { ...prev, mode: mode as any } : null);

    // 2. Direct Instant MQTT Command dispatch
    publishDirectMqttCommand('SET_MODE', 'SET_MODE', { mode });

    // 3. Parallel REST API notification
    ApiService.setPumpMode(dev.id, mode, user?.email || 'web_operator')
      .catch(err => console.warn('[DeviceContext] Backend setMode notification note:', err.message));
  };

  const emergencyStop = async (reason?: string) => {
    const dev = selectedDeviceRef.current || selectedDevice;
    if (!dev) return;
    lastActionTimeRef.current = Date.now();
    setCommandPending(false);
    setCommandStatusText('');

    // 1. Instant 0ms Optimistic UI Update
    setPumpStatus(prev => ({
      ...(prev || {
        id: 'ps_live',
        device_id: dev.id,
        mode: 'MANUAL',
        runtime_seconds: 0,
        changed_at: new Date().toISOString(),
        changed_by: 'EMERGENCY_STOP'
      }),
      pump_state: 'FAULT',
      current_draw_amps: 0.0
    }));

    // 2. Direct Instant MQTT Command dispatch
    publishDirectMqttCommand('EMERGENCY_STOP', 'EMERGENCY_STOP', { reason: reason || 'Operator UI E-Stop' });

    // 3. Parallel REST API notification
    ApiService.emergencyStop(dev.id, reason || 'Operator UI E-Stop')
      .catch((err: any) => {
        console.warn('[DeviceContext] Backend emergencyStop notification note:', err.message);
      });
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await ApiService.acknowledgeAlert(alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
    } catch (err: any) {
      alert(`Could not acknowledge alert: ${err.message}`);
    }
  };

  const syncRulesToHardware = useCallback(async (rulesList?: AutomationRule[]) => {
    const activeRules = rulesList || rules;
    const devUid = selectedDevice?.device_uid || 'WPC-A81F29';
    publishDirectMqttCommand('SYNC_RULES', 'SYNC_RULES', {
      rules: activeRules.map(r => ({
        id: r.id,
        rule_name: r.rule_name,
        enabled: Boolean(r.enabled),
        priority: r.priority || 1,
        condition_json: typeof r.condition_json === 'string' ? JSON.parse(r.condition_json) : (r.condition_json || {}),
        action_json: typeof r.action_json === 'string' ? JSON.parse(r.action_json) : (r.action_json || {})
      }))
    });
    console.log('[DeviceContext] Direct MQTT Sync Rules sent to hardware:', activeRules.length, 'rules');
  }, [rules, selectedDevice, publishDirectMqttCommand]);

  return (
    <DeviceContext.Provider
      value={{
        devices,
        selectedDevice,
        setSelectedDevice,
        pumpStatus,
        telemetry,
        alerts,
        rules,
        wsConnected,
        mqttConnected,
        isDeviceOnline,
        isSubnodeOnline,
        subnodeError,
        isWaterLevelSensorOnline,
        waterLevelSensorError,
        commandPending,
        commandStatusText,
        refreshDevices,
        refreshRules,
        syncRulesToHardware,
        reconnectWs: async () => { connectWs(); },
        startPump,
        stopPump,
        setMode,
        emergencyStop,
        acknowledgeAlert
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) throw new Error('useDevice must be used within DeviceProvider');
  return context;
};
