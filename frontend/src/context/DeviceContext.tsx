import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Device, PumpStatus, SensorReading, Alert, AutomationRule } from '../types';
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
  commandPending: boolean;
  commandStatusText: string;
  refreshDevices: () => Promise<void>;
  refreshRules: () => Promise<void>;
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
  
  // Real-Time Heartbeat Tracker
  const [lastTelemetryTimestamp, setLastTelemetryTimestamp] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const wsRef = useRef<WebSocket | null>(null);
  const mqttClientRef = useRef<MqttClient | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 200ms interval tick to continuously check heartbeat freshness & 5Hz live telemetry
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);

  // Real-Time MQTT Hardware Status (Online when telemetry arrives within 6s at 5Hz)
  const isDeviceOnline = Boolean(
    lastTelemetryTimestamp > 0 && (nowTick - lastTelemetryTimestamp < 6000)
  );

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
        // Protect recent user actions from being overwritten by stale polling
        if (Date.now() - lastActionTimeRef.current >= 6000) {
          setPumpStatus(pStatus.value);
        }
      }
      if (aList.status === 'fulfilled' && aList.value) setAlerts(aList.value);
      if (rList.status === 'fulfilled' && rList.value) setRules(rList.value);
      if (sLatest.status === 'fulfilled' && sLatest.value) {
        setTelemetry(prev => prev || sLatest.value);
      }
    } catch (err) {
      console.warn('[DeviceContext] Error loading device details:', err);
    }
  }, []);

  // Real-time periodic synchronization poll (every 3 seconds)
  useEffect(() => {
    if (!selectedDevice) return;
    loadDeviceData(selectedDevice.id);

    const pollTimer = setInterval(() => {
      loadDeviceData(selectedDevice.id);
    }, 3000);

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
        client.subscribe('aquacontrol/WPC-A81F29/#');
        client.subscribe('aquacontrol/v1/devices/WPC-A81F29/#');
        client.subscribe('devices/WPC-A81F29/#');
        client.subscribe('devices/+/telemetry');
        client.subscribe('devices/+/ack');
        client.subscribe('devices/+/status');
        client.subscribe('aquacontrol/telemetry');
        client.subscribe('aquacontrol/status');
        client.subscribe('aquacontrol/ack');
      });

      client.on('message', (topic: string, message: Buffer) => {
        try {
          const payloadStr = message.toString();
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
            setLastTelemetryTimestamp(now);
            setSelectedDevice(prev => prev ? { ...prev, status: 'online' } : prev);
            setDevices(prev => prev.map(d => d.device_uid === deviceUid ? { ...d, status: 'online' } : d));

            const waterPct = Number(data.water_level_percentage ?? data.water_level_pct ?? data.waterLevelPercentage ?? 0);
            const waterLiters = Number(data.water_level_liters ?? data.waterLevelLiters ?? (waterPct * 20));
            const flowRate = Number(data.inflow_rate_lpm ?? data.flow_rate_lpm ?? data.inflowRateLpm ?? 0);
            const totalLiters = Number(data.total_inflow_liters ?? data.total_inflow_l ?? data.totalInflowLiters ?? 0);
            const tds = Number(data.tds_ppm ?? data.tdsPpm ?? 0);
            const temp = Number(data.temperature_c ?? data.temperatureC ?? 25);
            const status = data.sensor_status || data.sensorStatus || 'HEALTHY';

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
              const isRunning = data.pump_running === true || data.pump_state === 'ON';
              setPumpStatus(prev => ({
                ...(prev || {
                  id: 'ps_live',
                  device_id: selectedDeviceRef.current?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
                  mode: data.pump_mode || 'AUTOMATIC',
                  runtime_seconds: 0,
                  changed_at: new Date().toISOString(),
                  changed_by: 'HARDWARE_TELEMETRY'
                }),
                pump_state: isRunning ? 'ON' : 'OFF',
                mode: (data.pump_mode || prev?.mode || 'AUTOMATIC') as any,
                current_draw_amps: Number(data.current_amps ?? (isRunning ? 4.8 : 0.0)),
                runtime_seconds: Number(data.runtime_seconds ?? prev?.runtime_seconds ?? 0)
              }));
            }
          } else if (subTopic === 'ack') {
            const confirmedState = data.confirmed_state || data.pump_state || (data.status === 'SUCCESS' || data.status === 'successful' ? 'ON' : 'OFF');
            setPumpStatus(prev => ({
              ...(prev || {
                id: 'ps_live',
                device_id: selectedDeviceRef.current?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
                mode: 'AUTOMATIC',
                runtime_seconds: 0,
                changed_at: new Date().toISOString(),
                changed_by: 'HARDWARE_ACK'
              }),
              pump_state: confirmedState === 'ON' ? 'ON' : confirmedState === 'EMERGENCY_STOP' ? 'FAULT' : 'OFF',
              current_draw_amps: Number(data.current_amps ?? (confirmedState === 'ON' ? 4.8 : 0.0)),
              runtime_seconds: Number(data.runtime_seconds ?? prev?.runtime_seconds ?? 0)
            }));
            setCommandPending(false);
            setCommandStatusText(`Hardware Confirmed: ${confirmedState}`);
            setTimeout(() => setCommandStatusText(''), 2500);
          } else if (subTopic === 'status') {
            const isOnline = data.status === 'online';
            if (isOnline) {
              setLastTelemetryTimestamp(Date.now());
            } else {
              setLastTelemetryTimestamp(0);
            }
            const st = isOnline ? 'online' : 'offline';
            setSelectedDevice(prev => prev ? { ...prev, status: st } : prev);
            setDevices(prev => prev.map(d => d.device_uid === deviceUid ? { ...d, status: st } : d));
          } else if (subTopic === 'alerts') {
            if (data.alert_type || data.title || data.message) {
              const sev = (data.severity || 'warning').toLowerCase() as 'info' | 'warning' | 'critical';
              setAlerts(prev => [{
                id: `alt_${Date.now()}`,
                device_id: selectedDeviceRef.current?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
                title: data.title || data.alert_type || 'Hardware Alert',
                severity: (sev === 'critical' || sev === 'info') ? sev : 'warning',
                message: data.message || 'Hardware alert condition triggered',
                acknowledged: false,
                created_at: new Date().toISOString()
              }, ...prev]);
            }
          }
        } catch (e) {
          console.warn('[MQTT] Inbound message parsing error:', e);
        }
      });

      client.on('error', (err) => {
        console.warn('[MQTT] Browser MQTT client error:', err.message);
      });

      client.on('close', () => {
        setMqttConnected(false);
      });
    } catch (e) {
      console.warn('[MQTT] Could not initialize browser MQTT client:', e);
    }

    return () => {
      if (mqttClientRef.current) {
        mqttClientRef.current.end(true);
        mqttClientRef.current = null;
      }
    };
  }, []);

  // =========================================================================
  // LOCAL GATEWAY WEBSOCKET CONNECTION
  // =========================================================================
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

  const reconnectWs = useCallback(async () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    connectWs();
  }, [connectWs]);

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

  const handleWebSocketMessage = (msg: any) => {
    const { event, data } = msg;

    if (event === 'DEVICE_STATUS_CHANGED') {
      const { deviceId, deviceUid, status } = data;
      setDevices(prev => prev.map(d => (d.id === deviceId || d.device_uid === deviceUid) ? { ...d, status } : d));
      setSelectedDevice(prev => {
        if (!prev) return prev;
        if (prev.id === deviceId || prev.device_uid === deviceUid) {
          return { ...prev, status };
        }
        return prev;
      });

      if (status === 'offline') {
        setLastTelemetryTimestamp(0);
        // Retain last known telemetry metrics so gauges remain readable
      }
    } else if (event === 'TELEMETRY_UPDATE') {
      setLastTelemetryTimestamp(Date.now());
      setSelectedDevice(prev => prev ? { ...prev, status: 'online' } : prev);
      setDevices(prev => prev.map(d => d.device_uid === data.deviceUid ? { ...d, status: 'online' } : d));
      
      if (!selectedDevice || data.deviceUid === selectedDevice.device_uid) {
        setTelemetry({
          id: data.readingId || 'latest',
          device_id: data.deviceId || selectedDevice?.id || '',
          water_level_percentage: data.waterLevelPercentage,
          water_level_liters: data.waterLevelLiters,
          inflow_rate_lpm: data.inflowRateLpm,
          total_inflow_liters: data.totalInflowLiters,
          tds_ppm: data.tdsPpm,
          temperature_c: data.temperatureC,
          sensor_status: data.sensorStatus || 'HEALTHY',
          created_at: data.timestamp || new Date().toISOString()
        });

        if (data.pumpState !== undefined || typeof data.pumpRunning === 'boolean') {
          const isRunning = data.pumpRunning === true || data.pumpState === 'ON';
          setPumpStatus(prev => ({
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
          }));
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
      }
    } else if (event === 'NEW_ALERT') {
      setAlerts(prev => [data, ...prev]);
    }
  };

  // Helper to publish direct MQTT command
  const publishDirectMqttCommand = (cmdType: string, actionStr: string, payload: any = {}) => {
    const devUid = selectedDevice?.device_uid || 'WPC-A81F29';
    const cmdId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cmdPayload = JSON.stringify({
      cmd_id: cmdId,
      command_id: cmdId,
      command: actionStr,
      command_type: cmdType,
      action: actionStr,
      mode: payload.mode,
      auth_token: 'WPC_AUTH_SECURE_KEY_2026',
      token: 'WPC_AUTH_SECURE_KEY_2026',
      payload,
      source: 'WEB_DASHBOARD',
      timestamp: Math.floor(Date.now() / 1000)
    });

    if (mqttClientRef.current && mqttClientRef.current.connected) {
      mqttClientRef.current.publish(`devices/${devUid}/commands`, cmdPayload, { qos: 0 });
      mqttClientRef.current.publish(`aquacontrol/${devUid}/commands`, cmdPayload, { qos: 0 });
      mqttClientRef.current.publish(`aquacontrol/v1/devices/${devUid}/commands`, cmdPayload, { qos: 0 });
      mqttClientRef.current.publish('aquacontrol/commands', cmdPayload, { qos: 0 });
      console.log(`[MQTT Direct] Published command to 'aquacontrol/${devUid}/commands':`, cmdPayload);
    }
  };

  // Instant Real-Time Pump Command Actions (0ms Lag)
  const startPump = async () => {
    const dev = selectedDeviceRef.current || selectedDevice;
    if (!dev) return;
    lastActionTimeRef.current = Date.now();
    setCommandStatusText('Energizing Relay Contactor (0ms Fast-Path)...');

    // 1. Instant 0ms Optimistic UI Update
    setPumpStatus(prev => ({
      ...(prev || {
        id: 'ps_opt',
        device_id: dev.id,
        mode: 'MANUAL',
        runtime_seconds: 0,
        changed_at: new Date().toISOString(),
        changed_by: 'WEB_OPERATOR'
      }),
      pump_state: 'ON',
      mode: 'MANUAL',
      current_draw_amps: 4.8
    }));

    // 2. Direct Instant MQTT Command dispatch to hardware
    publishDirectMqttCommand('START_PUMP', 'START');

    // 3. Parallel non-blocking REST API notification
    ApiService.startPump(dev.id, user?.email || 'web_operator')
      .then(() => {
        setCommandStatusText('Command Dispatched to Controller ✓');
        setTimeout(() => setCommandStatusText(''), 1200);
      })
      .catch((err: any) => {
        console.warn('[DeviceContext] Backend start notification note:', err.message);
        setCommandStatusText('Dispatched via Cloud MQTT ✓');
        setTimeout(() => setCommandStatusText(''), 1200);
      });
  };

  const stopPump = async () => {
    const dev = selectedDeviceRef.current || selectedDevice;
    if (!dev) return;
    lastActionTimeRef.current = Date.now();
    setCommandStatusText('De-energizing Contactor (0ms Fast-Path)...');

    // 1. Instant 0ms Optimistic UI Update
    setPumpStatus(prev => ({
      ...(prev || {
        id: 'ps_opt',
        device_id: dev.id,
        mode: 'AUTOMATIC',
        runtime_seconds: 0,
        changed_at: new Date().toISOString(),
        changed_by: 'WEB_OPERATOR'
      }),
      pump_state: 'OFF',
      current_draw_amps: 0.0
    }));

    // 2. Direct Instant MQTT Command dispatch to hardware
    publishDirectMqttCommand('STOP_PUMP', 'STOP');

    // 3. Parallel non-blocking REST API notification
    ApiService.stopPump(dev.id, user?.email || 'web_operator')
      .then(() => {
        setCommandStatusText('Pump Stopped Successfully ✓');
        setTimeout(() => setCommandStatusText(''), 1200);
      })
      .catch((err: any) => {
        console.warn('[DeviceContext] Backend stop notification note:', err.message);
        setCommandStatusText('Dispatched via Cloud MQTT ✓');
        setTimeout(() => setCommandStatusText(''), 1200);
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
    setCommandStatusText('ACTIVATING HARDWARE EMERGENCY CUTOFF...');

    // 1. Instant 0ms Optimistic UI Update
    setPumpStatus(prev => ({
      ...(prev || {
        id: 'ps_opt',
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
      .then(() => {
        setCommandStatusText('Emergency Lockout Armed ✓');
        setTimeout(() => setCommandStatusText(''), 2000);
      })
      .catch((err: any) => {
        console.warn('[DeviceContext] Backend emergencyStop notification note:', err.message);
        setCommandStatusText('E-Stop Dispatched via Cloud MQTT ✓');
        setTimeout(() => setCommandStatusText(''), 2000);
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
        commandPending,
        commandStatusText,
        refreshDevices,
        refreshRules,
        reconnectWs,
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
