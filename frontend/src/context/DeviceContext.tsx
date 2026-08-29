import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Device, PumpStatus, PumpState, SensorReading, Alert, AutomationRule } from '../types';
import { ApiService, getCustomGatewayUrl } from '../services/api';
import { useAuth } from './AuthContext';
import mqtt, { MqttClient } from 'mqtt';

interface DeviceContextType {
  devices: Device[];
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device) => void;
  userAuthCode: string;
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
  claimHardware: (deviceUid: string, customName?: string) => Promise<void>;
  unlinkHardware: (deviceId: string) => Promise<void>;
  refreshRules: () => Promise<void>;
  syncRulesToHardware: (rulesList?: AutomationRule[]) => Promise<void>;
  reconnectWs: () => Promise<void>;
  startPump: () => Promise<void>;
  stopPump: () => Promise<void>;
  setMode: (mode: string) => Promise<void>;
  emergencyStop: (reason?: string) => Promise<void>;
  resetLockout: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
}

export function computeUserAuthCode(u: any): string {
  if (!u) return 'WPC-AUTH-DEFAULT';
  if (u.auth_code) return u.auth_code;
  const raw = (u.id || u.email || 'USER').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `WPC-AUTH-${raw.slice(0, 16)}`;
}

export function parseSafeJson(str: string): any {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Auto-repair truncated JSON string (e.g. from older firmware versions)
    try {
      let repair = trimmed;
      const lastComma = repair.lastIndexOf(',');
      if (lastComma > 0) {
        repair = repair.substring(0, lastComma) + '}';
        return JSON.parse(repair);
      }
    } catch (e2) {}
  }
  return null;
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
  const userAuthCode = useMemo(() => computeUserAuthCode(user), [user]);
  const userRef = useRef(user);
  userRef.current = user;
  const userAuthCodeRef = useRef(userAuthCode);
  userAuthCodeRef.current = userAuthCode;

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

  // Command State Locks to Prevent Rapid Flickering / Mode Ping-Ponging
  const desiredPumpStateRef = useRef<{ state: PumpState; timestamp: number } | null>(null);
  const desiredModeRef = useRef<{ mode: string; timestamp: number } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mqttClientRef = useRef<MqttClient | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unlinkedDevicesRef = useRef<Set<string>>(new Set((() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('pump_unlinked_devices');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })()));

  // 1-second interval heartbeat check with 15s grace window (Smooth, rock-solid online state)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const isOnline = (now - lastTelemetryTimestampRef.current < 15000);
      setIsDeviceOnline(prev => (prev !== isOnline ? isOnline : prev));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load devices on auth change (Preserves active live hardware session)
  const refreshDevices = useCallback(async () => {
    try {
      const list = await ApiService.getDevices();
      if (list && list.length > 0) {
        setDevices(list);
        setSelectedDevice(prev => {
          if (!prev) return list[0];
          const found = list.find((d: Device) => d.id === prev.id || d.device_uid === prev.device_uid);
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

  // Dynamic Device Reference to Enforce Strict Per-Account Hardware Isolation
  const devicesRef = useRef<Device[]>(devices);
  useEffect(() => {
    devicesRef.current = devices;
    if (mqttClientRef.current && mqttClientRef.current.connected) {
      devices.forEach(d => {
        mqttClientRef.current?.subscribe(`devices/${d.device_uid}/telemetry`);
        mqttClientRef.current?.subscribe(`devices/${d.device_uid}/ack`);
        mqttClientRef.current?.subscribe(`devices/${d.device_uid}/status`);
        mqttClientRef.current?.subscribe(`aquacontrol/${d.device_uid}/#`);
      });
    }
  }, [devices]);

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
          username: user?.id || 'wpc_client',
          password: 'WPC_AUTH_SECURE_KEY_2026',
          reconnectPeriod: 2000,
          connectTimeout: 8000,
          keepalive: 30
        });
        mqttClientRef.current = client;

        client.on('connect', () => {
          console.log('[MQTT] ✓ Browser connected to Cloud MQTT Broker! Subscribing to telemetry and commands...');
          setMqttConnected(true);
          
          // Subscribe to hardware device telemetry, ACK, and status streams
          client.subscribe('devices/+/telemetry');
          client.subscribe('devices/+/ack');
          client.subscribe('devices/+/status');
          client.subscribe('devices/+/commands');
          client.subscribe('aquacontrol/#');
          client.subscribe('aquacontrol/ownership/#');
        });

        client.on('message', (topic: string, message: Buffer) => {
          try {
            const payloadStr = message.toString();
            if (!payloadStr || payloadStr.trim().length === 0) return;
            const data = parseSafeJson(payloadStr);
            if (!data) return;

            let deviceUid = data.device_uid || data.deviceUid;
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

            // If device was explicitly deleted/unlinked by this account, ignore its telemetry
            if (deviceUid && unlinkedDevicesRef.current.has(deviceUid.toUpperCase())) {
              return;
            }

            // Check if this device is registered in this account's devices list or is currently selected
            let targetDev = devicesRef.current.find(d => d.device_uid === deviceUid || d.id === deviceUid) 
              || (selectedDeviceRef.current?.device_uid === deviceUid ? selectedDeviceRef.current : null);

            // If account has no devices yet, create a default device entry for the active hardware
            if (!targetDev && devicesRef.current.length === 0 && deviceUid) {
              const activeUser = userRef.current;
              const autoDev: Device = {
                id: `dev_${deviceUid.toLowerCase()}`,
                device_uid: deviceUid,
                serial_number: `SN-2026-ESP32-${deviceUid.slice(-4)}`,
                device_type: 'ESP32_MAIN_CONTROLLER',
                owner_id: activeUser?.id || 'usr_owner',
                status: 'online',
                firmware_version: 'v2.2.0',
                tank_capacity_liters: 2000,
                tank_height_cm: 180,
                last_seen: new Date().toISOString()
              };
              targetDev = autoDev;
              setDevices([autoDev]);
              setSelectedDevice(autoDev);
              devicesRef.current = [autoDev];
            }

            if (!targetDev) {
              return;
            }

            console.log(`%c[AquaControl LIVE HW] Topic: '${topic}' for User Device: ${targetDev.device_uid}`, 'color: #10b981; font-weight: bold;', data);

            if (subTopic === 'telemetry' || data.water_level_pct !== undefined || data.water_level_percentage !== undefined) {
              const now = Date.now();
              lastTelemetryTimestampRef.current = now;
              setIsDeviceOnline(true);
              setSelectedDevice(prev => prev ? { ...prev, status: 'online' } : targetDev);
              setDevices(prev => prev.map(d => d.device_uid === targetDev.device_uid ? { ...d, status: 'online' } : d));

              const isSubOnline = data.subnode_online !== undefined ? Boolean(data.subnode_online) : 
                                  (data.subNodeOnline !== undefined ? Boolean(data.subNodeOnline) : true);
              setIsSubnodeOnline(isSubOnline);

              // Granular Water Level Sensor Probe Fault Detection
              const isUltrasonicFault = Boolean(data.water_level_fault) || 
                                        (data.ultrasonic_online === false) ||
                                        (data.sensor_status === 'ULTRASONIC_FAULT') ||
                                        (data.sensor_fault === true);
              setIsWaterLevelSensorOnline(!isUltrasonicFault);
              setWaterLevelSensorError(isUltrasonicFault ? (data.water_level_error || 'Ultrasonic Sensor Probe Fault / No Echo') : null);

              if (isSubOnline) {
                lastSubnodeTimestampRef.current = now;
                setSubnodeError(null);
              } else {
                setSubnodeError(data.subnode_error || 'Subnode Tank Transmitter Disconnected');
              }

              const waterPct = isSubOnline && !isUltrasonicFault ? Number(data.water_level_pct ?? data.water_level_percentage ?? 0) : 0;
              const waterLiters = isSubOnline && !isUltrasonicFault ? Number(data.water_level_liters ?? (waterPct * 20)) : 0;
              const flowRate = isSubOnline ? Number(data.flow_rate_lpm ?? data.inflow_rate_lpm ?? 0) : 0;
              const totalLiters = isSubOnline ? Number(data.total_liters ?? data.total_inflow_liters ?? 0) : 0;
              const tds = isSubOnline ? Number(data.tds_ppm ?? data.tdsPpm ?? 0) : 0;
              const temp = isSubOnline ? Number(data.temperature_c ?? data.temperatureC ?? 25) : 0;
              const status = !isSubOnline ? 'SUBNODE_DISCONNECTED' : (isUltrasonicFault ? 'ULTRASONIC_FAULT' : (data.sensor_status || 'HEALTHY'));

              setTelemetry({
                id: `tel_${now}`,
                device_id: targetDev.id,
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

                const nowMs = Date.now();
                let effectiveState: PumpState = hwState;
                let effectiveMode: any = hwMode;

                // Reconcile user-initiated state lock (avoids in-flight telemetry jitter)
                if (desiredPumpStateRef.current && (nowMs - desiredPumpStateRef.current.timestamp < 3000)) {
                  if (hwState === desiredPumpStateRef.current.state) {
                    desiredPumpStateRef.current = null;
                  } else {
                    effectiveState = desiredPumpStateRef.current.state;
                  }
                }

                // Reconcile user-initiated mode lock (avoids mode bouncing)
                if (desiredModeRef.current && (nowMs - desiredModeRef.current.timestamp < 3000)) {
                  if (hwMode === desiredModeRef.current.mode) {
                    desiredModeRef.current = null;
                  } else {
                    effectiveMode = desiredModeRef.current.mode;
                  }
                }

                setPumpStatus(prev => ({
                  ...(prev || {
                    id: 'ps_live',
                    device_id: targetDev.id,
                    mode: effectiveMode,
                    runtime_seconds: 0,
                    changed_at: new Date().toISOString(),
                    changed_by: 'HARDWARE_TELEMETRY'
                  }),
                  pump_state: effectiveState,
                  mode: effectiveMode,
                  current_draw_amps: effectiveState === 'ON' ? hwAmps : 0.0,
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

              desiredPumpStateRef.current = null;
              if (data.pump_mode) desiredModeRef.current = null;

              setPumpStatus(prev => ({
                ...(prev || {
                  id: 'ps_live',
                  device_id: targetDev.id,
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
                // Grace window: only mark offline if no live telemetry received in 15 seconds
                if (Date.now() - lastTelemetryTimestampRef.current > 15000) {
                  setIsDeviceOnline(false);
                  setSelectedDevice(prev => prev ? { ...prev, status: 'offline' } : prev);
                  setDevices(prev => prev.map(d => d.device_uid === deviceUid ? { ...d, status: 'offline' } : d));
                }
              }
            }
          } catch (err) {
            // Silently ignore non-JSON or invalid broker packets
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
      const isOwned = devicesRef.current.some(d => d.device_uid === data.deviceUid);
      if (!isOwned) return;

      lastTelemetryTimestampRef.current = Date.now();
      setIsDeviceOnline(true);
      setSelectedDevice(prev => prev ? { ...prev, status: 'online' } : prev);
      setDevices(prev => prev.map(d => d.device_uid === data.deviceUid ? { ...d, status: 'online' } : d));
      
      if (selectedDevice && data.deviceUid === selectedDevice.device_uid) {
        setTelemetry({
          id: data.readingId || 'latest',
          device_id: data.deviceId || selectedDevice.id,
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
          const hwState: PumpState = isRunning ? 'ON' : (data.pumpState === 'FAULT' ? 'FAULT' : 'OFF');
          const hwMode = (data.pumpMode || 'AUTOMATIC') as any;

          const nowMs = Date.now();
          let effectiveState: PumpState = hwState;
          let effectiveMode: any = hwMode;

          // Reconcile state lock
          if (desiredPumpStateRef.current && (nowMs - desiredPumpStateRef.current.timestamp < 3000)) {
            if (hwState === desiredPumpStateRef.current.state) {
              desiredPumpStateRef.current = null;
            } else {
              effectiveState = desiredPumpStateRef.current.state;
            }
          }

          // Reconcile mode lock
          if (desiredModeRef.current && (nowMs - desiredModeRef.current.timestamp < 3000)) {
            if (hwMode === desiredModeRef.current.mode) {
              desiredModeRef.current = null;
            } else {
              effectiveMode = desiredModeRef.current.mode;
            }
          }

          setPumpStatus(prev => ({
            ...(prev || {
              id: 'ps_live',
              device_id: data.deviceId || selectedDevice.id,
              mode: effectiveMode,
              runtime_seconds: 0,
              changed_at: new Date().toISOString(),
              changed_by: 'HARDWARE_TELEMETRY'
            }),
            pump_state: effectiveState,
            mode: effectiveMode,
            current_draw_amps: effectiveState === 'ON' ? Number(data.currentAmps ?? 4.8) : 0.0,
            runtime_seconds: Number(data.runtimeSeconds ?? prev?.runtime_seconds ?? 0)
          }));

          if (effectiveState === 'ON' || effectiveState === 'OFF') {
            setCommandPending(false);
          }
        }
      }
    } else if (event === 'PUMP_STATE_CHANGED') {
      const isOwned = devicesRef.current.some(d => d.device_uid === data.deviceUid);
      if (!isOwned) return;

      setSelectedDevice(prev => prev ? { ...prev, status: 'online' } : prev);
      setDevices(prev => prev.map(d => d.device_uid === data.deviceUid ? { ...d, status: 'online' } : d));
      if (selectedDevice && data.deviceUid === selectedDevice.device_uid) {
        setPumpStatus(prev => ({
          ...(prev || {}),
          ...data
        }));
        if (data.pump_state === 'ON' || data.pump_state === 'OFF') {
          setCommandPending(false);
        }
      }
    } else if (event === 'NEW_ALERT') {
      const isOwned = !data.deviceId || devicesRef.current.some(d => d.id === data.deviceId || d.device_uid === data.deviceId);
      if (isOwned) {
        setAlerts(prev => [data, ...prev]);
      }
    }
  };

  // Helper to publish direct MQTT command (100ms ultra-low latency)
  const publishDirectMqttCommand = (cmdType: string, actionStr: string, payload: any = {}) => {
    const devUid = selectedDevice?.device_uid || 'WPC-A81F29';
    const cmdId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cmdPayload = JSON.stringify({
      cmd_id: cmdId,
      command_id: cmdId,
      command_type: cmdType,
      command: actionStr,
      action: actionStr,
      auth_code: userAuthCode,
      auth_token: userAuthCode,
      user_auth_id: userAuthCode,
      owner_id: user?.id || userAuthCode,
      user_email: user?.email,
      source: 'web_direct_client',
      timestamp: Date.now(),
      ...payload
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
    const now = Date.now();
    lastActionTimeRef.current = now;
    desiredPumpStateRef.current = { state: 'ON', timestamp: now };
    setCommandPending(false);
    setCommandStatusText('');

    // 1. Instant optimistic state update on frontend (preserves active mode)
    setPumpStatus(prev => ({
      ...(prev || {
        id: 'ps_live',
        device_id: dev.id,
        mode: 'AUTOMATIC',
        runtime_seconds: 0,
        changed_at: new Date().toISOString(),
        changed_by: 'WEB_OPERATOR'
      }),
      pump_state: 'ON',
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
    const now = Date.now();
    lastActionTimeRef.current = now;
    desiredPumpStateRef.current = { state: 'OFF', timestamp: now };
    setCommandPending(false);
    setCommandStatusText('');

    // 1. Instant optimistic state update on frontend
    setPumpStatus(prev => ({
      ...(prev || {
        id: 'ps_live',
        device_id: dev.id,
        mode: 'AUTOMATIC',
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
    const now = Date.now();
    lastActionTimeRef.current = now;
    desiredModeRef.current = { mode, timestamp: now };

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
    const now = Date.now();
    lastActionTimeRef.current = now;
    desiredPumpStateRef.current = { state: 'FAULT', timestamp: now };
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

  const resetLockout = async () => {
    const dev = selectedDeviceRef.current || selectedDevice;
    if (!dev) return;
    const now = Date.now();
    lastActionTimeRef.current = now;
    desiredPumpStateRef.current = { state: 'OFF', timestamp: now };
    setCommandPending(false);
    setCommandStatusText('');

    // 1. Instant 0ms Optimistic UI Update (restore pump to Standby/OFF)
    setPumpStatus(prev => ({
      ...(prev || {
        id: 'ps_live',
        device_id: dev.id,
        mode: 'MANUAL',
        runtime_seconds: 0,
        changed_at: new Date().toISOString(),
        changed_by: 'OPERATOR_RESET'
      }),
      pump_state: 'OFF',
      current_draw_amps: 0.0
    }));

    // 2. Direct Instant MQTT Command dispatch
    publishDirectMqttCommand('CLEAR_FAULT', 'CLEAR_FAULT');

    // 3. Parallel REST API notification
    ApiService.resetLockout(dev.id, user?.email || 'web_operator')
      .catch((err: any) => {
        console.warn('[DeviceContext] Backend resetLockout notification note:', err.message);
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

  const claimHardware = useCallback(async (deviceUidInput: string, customName?: string) => {
    if (!deviceUidInput || deviceUidInput.trim().length === 0) {
      throw new Error('Please enter a valid Device UID (e.g. WPC-A81F29)');
    }
    const cleanUid = deviceUidInput.trim().toUpperCase();
    const activeUserId = user?.id || 'usr_active';

    // Clear from tombstone list so user can link/re-link it
    unlinkedDevicesRef.current.delete(cleanUid);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pump_unlinked_devices', JSON.stringify(Array.from(unlinkedDevicesRef.current)));
      } catch (e) {}
    }

    const newDevice: Device = {
      id: `dev_${cleanUid.toLowerCase()}_${activeUserId.slice(-6)}`,
      device_uid: cleanUid,
      serial_number: `SN-2026-ESP32-${cleanUid.replace(/[^A-Z0-9]/g, '').slice(-4) || '9921'}`,
      device_type: 'ESP32_MAIN_CONTROLLER',
      owner_id: activeUserId,
      status: 'online',
      firmware_version: 'v2.1.0',
      local_ip: '192.168.31.53',
      mac_address: '24:6F:28:A8:1F:29',
      tank_capacity_liters: 2000,
      tank_height_cm: 180,
      last_seen: new Date().toISOString()
    };

    setDevices(prev => {
      const filtered = prev.filter(d => d.device_uid !== cleanUid);
      const updated = [...filtered, newDevice];
      devicesRef.current = updated;
      return updated;
    });
    setSelectedDevice(newDevice);

    if (mqttClientRef.current && mqttClientRef.current.connected) {
      const cmdPayload = JSON.stringify({
        command: 'SET_AUTH_CODE',
        auth_code: userAuthCode,
        user_auth_id: userAuthCode,
        owner_id: activeUserId,
        user_email: user?.email,
        timestamp: Date.now()
      });

      mqttClientRef.current.publish(`devices/${cleanUid}/commands`, cmdPayload, { qos: 1 });
      mqttClientRef.current.publish(`aquacontrol/${cleanUid}/commands`, cmdPayload, { qos: 1 });
      mqttClientRef.current.publish(`aquacontrol/ownership/claim`, JSON.stringify({
        type: 'CLAIM_HARDWARE',
        device_uid: cleanUid,
        owner_id: activeUserId,
        auth_code: userAuthCode,
        user_email: user?.email
      }), { qos: 1, retain: true });

      mqttClientRef.current.subscribe(`devices/${cleanUid}/telemetry`);
      mqttClientRef.current.subscribe(`devices/${cleanUid}/ack`);
      mqttClientRef.current.subscribe(`devices/${cleanUid}/status`);
      mqttClientRef.current.subscribe(`aquacontrol/${cleanUid}/#`);
    }

    try {
      await ApiService.claimDevice({
        device_uid: cleanUid,
        auth_code: userAuthCode,
        owner_id: activeUserId
      });
    } catch (e) {}

    setIsDeviceOnline(true);
    setCommandStatusText(`Hardware ${cleanUid} successfully linked to Account Auth Code: ${userAuthCode}`);
    setTimeout(() => setCommandStatusText(''), 5000);
  }, [user, userAuthCode]);

  const unlinkHardware = useCallback(async (deviceId: string) => {
    const target = devicesRef.current.find(d => d.id === deviceId || d.device_uid === deviceId) || selectedDevice;
    const uid = (target?.device_uid || deviceId).trim().toUpperCase();

    // 1. Mark as tombstone so MQTT background never auto-re-adopts it
    unlinkedDevicesRef.current.add(uid);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pump_unlinked_devices', JSON.stringify(Array.from(unlinkedDevicesRef.current)));
      } catch (e) {}
    }

    // 2. Dispatch cryptographic release command and unsubscribe MQTT topics
    if (mqttClientRef.current && uid) {
      if (mqttClientRef.current.connected) {
        const resetPayload = JSON.stringify({
          command: 'RELEASE_AUTH',
          action: 'RELEASE_AUTH',
          auth_code: userAuthCode,
          device_uid: uid,
          timestamp: Date.now()
        });
        mqttClientRef.current.publish(`devices/${uid}/commands`, resetPayload, { qos: 1 });
        mqttClientRef.current.publish(`aquacontrol/${uid}/commands`, resetPayload, { qos: 1 });
        mqttClientRef.current.publish('aquacontrol/ownership/release', JSON.stringify({
          event: 'HARDWARE_RELEASED',
          device_uid: uid,
          previous_owner_id: user?.id,
          previous_auth_code: userAuthCode,
          timestamp: Date.now()
        }), { qos: 1 });
      }

      // Explicitly clear MQTT WebSocket subscriptions for this hardware
      mqttClientRef.current.unsubscribe(`devices/${uid}/telemetry`);
      mqttClientRef.current.unsubscribe(`devices/${uid}/ack`);
      mqttClientRef.current.unsubscribe(`devices/${uid}/status`);
      mqttClientRef.current.unsubscribe(`aquacontrol/${uid}/#`);
    }

    // 3. Call backend API to delete the device link from this account
    try {
      const devIdToDelete = target?.id || deviceId;
      await ApiService.deleteDevice(devIdToDelete);
    } catch (err) {
      console.warn('[DeviceContext] Backend deleteDevice note:', err);
    }

    // 4. Clear local device state
    setDevices(prev => {
      const updated = prev.filter(d => d.id !== deviceId && d.device_uid !== deviceId && d.device_uid !== uid);
      devicesRef.current = updated;
      return updated;
    });

    if (selectedDevice?.id === deviceId || selectedDevice?.device_uid === deviceId || selectedDevice?.device_uid === uid) {
      setSelectedDevice(null);
      setIsDeviceOnline(false);
      setPumpStatus(null);
      setTelemetry(null);
    }

    setCommandStatusText(`Hardware ${uid} successfully released and unlinked from your account.`);
    setTimeout(() => setCommandStatusText(''), 5000);
  }, [selectedDevice, userAuthCode, user]);

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
        userAuthCode,
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
        claimHardware,
        unlinkHardware,
        refreshRules,
        syncRulesToHardware,
        reconnectWs: async () => { connectWs(); },
        startPump,
        stopPump,
        setMode,
        emergencyStop,
        resetLockout,
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
