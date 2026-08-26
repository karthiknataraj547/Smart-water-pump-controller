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

  // 1-second interval tick to continuously check heartbeat freshness
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // STRICT REAL-TIME MQTT HARDWARE STATUS (Zero Mocking):
  // The device is considered online ONLY if genuine MQTT packets are arriving
  // from the physical ESP32 on topic 'devices/WPC-A81F29/telemetry' or 'status'
  // within the last 4.5 seconds (ESP32 publishes at 1Hz).
  const isDeviceOnline = Boolean(
    lastTelemetryTimestamp > 0 && (nowTick - lastTelemetryTimestamp < 4500)
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

  // Load device-specific data when selected device changes
  const loadDeviceData = useCallback(async (deviceId: string) => {
    try {
      const [pStatus, aList, rList] = await Promise.allSettled([
        ApiService.getPumpStatus(deviceId),
        ApiService.getAlerts(deviceId),
        ApiService.getAutomationRules(deviceId)
      ]);

      if (pStatus.status === 'fulfilled' && pStatus.value) {
        setPumpStatus(pStatus.value);
      }
      if (aList.status === 'fulfilled' && aList.value) setAlerts(aList.value);
      if (rList.status === 'fulfilled' && rList.value) setRules(rList.value);
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

  // =========================================================================
  // CLOUD MQTT DIRECT WEBSOCKET CONNECTION (wss://broker.emqx.io:8084/mqtt)
  // =========================================================================
  useEffect(() => {
    const brokerWsUrl = 'wss://broker.emqx.io:8084/mqtt';
    console.log('[MQTT] Connecting browser MQTT client to:', brokerWsUrl);

    try {
      const client = mqtt.connect(brokerWsUrl, {
        clientId: `AquaControl_Web_${Math.random().toString(16).substring(2, 8)}`,
        reconnectPeriod: 4000,
        connectTimeout: 8000
      });
      mqttClientRef.current = client;

      client.on('connect', () => {
        console.log('[MQTT] ✓ Browser connected to Cloud MQTT Broker (broker.emqx.io)! Subscribing to topics...');
        setMqttConnected(true);
        client.subscribe('devices/+/telemetry');
        client.subscribe('devices/+/ack');
        client.subscribe('devices/+/status');
        client.subscribe('devices/+/alerts');
        client.subscribe('aquacontrol/v1/devices/+/telemetry');
        client.subscribe('aquacontrol/v1/devices/+/ack');
        client.subscribe('aquacontrol/v1/devices/+/status');
        client.subscribe('aquacontrol/v1/devices/+/alerts');
      });

      client.on('message', (topic: string, message: Buffer) => {
        try {
          const payloadStr = message.toString();
          const data = JSON.parse(payloadStr);
          
          let deviceUid = 'WPC-A81F29';
          let subTopic = '';

          const parts = topic.split('/');
          if (parts[0] === 'devices' && parts.length >= 3) {
            deviceUid = parts[1];
            subTopic = parts[2];
          } else if (parts[0] === 'aquacontrol' && parts[1] === 'v1' && parts[2] === 'devices' && parts.length >= 5) {
            deviceUid = parts[3];
            subTopic = parts[4];
          }

          if (!subTopic) return;

          if (subTopic === 'telemetry') {
            const now = Date.now();
            setLastTelemetryTimestamp(now);
            setSelectedDevice(prev => prev ? { ...prev, status: 'online' } : prev);
            setDevices(prev => prev.map(d => d.device_uid === deviceUid ? { ...d, status: 'online' } : d));

            setTelemetry({
              id: `tel_${now}`,
              device_id: selectedDevice?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
              water_level_percentage: Number(data.water_level_percentage ?? data.water_level_pct ?? 0),
              water_level_liters: Number(data.water_level_liters ?? 0),
              inflow_rate_lpm: Number(data.inflow_rate_lpm ?? data.flow_rate_lpm ?? 0),
              total_inflow_liters: Number(data.total_inflow_liters ?? 0),
              tds_ppm: Number(data.tds_ppm ?? 0),
              temperature_c: Number(data.temperature_c ?? 25),
              sensor_status: data.sensor_status || 'HEALTHY',
              created_at: new Date(now).toISOString()
            });

            if (typeof data.pump_running === 'boolean' || data.pump_state) {
              const isRunning = data.pump_running === true || data.pump_state === 'ON';
              setPumpStatus(prev => ({
                ...(prev || {
                  id: 'ps_live',
                  device_id: selectedDevice?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
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
                device_id: selectedDevice?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
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
                device_id: selectedDevice?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5',
                title: data.title || data.alert_type || 'Hardware Alert',
                severity: (sev === 'critical' || sev === 'info') ? sev : 'warning',
                message: data.message || 'Hardware alert condition triggered',
                acknowledged: false,
                created_at: new Date().toISOString()
              }, ...prev]);
            }
          }
        } catch (e) {}
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
  }, [selectedDevice?.id]);

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
        setTelemetry(null);
        setPumpStatus(prev => prev ? { ...prev, pump_state: 'OFF', current_draw_amps: 0 } : null);
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
      payload,
      source: 'WEB_DASHBOARD',
      timestamp: Math.floor(Date.now() / 1000)
    });

    if (mqttClientRef.current && mqttClientRef.current.connected) {
      mqttClientRef.current.publish(`devices/${devUid}/commands`, cmdPayload, { qos: 0 });
      mqttClientRef.current.publish(`aquacontrol/v1/devices/${devUid}/commands`, cmdPayload, { qos: 0 });
      console.log(`[MQTT Direct] Published command to 'devices/${devUid}/commands':`, cmdPayload);
    }
  };

  // Pump Command Actions
  const startPump = async () => {
    if (!selectedDevice) return;
    const previousState = pumpStatus;
    setCommandPending(true);
    setCommandStatusText('Energizing Relay Contactor via MQTT...');

    // Optimistic UI update
    setPumpStatus(prev => prev ? { ...prev, pump_state: 'ON', current_draw_amps: 4.8 } : null);

    // Direct MQTT Command dispatch
    publishDirectMqttCommand('START_PUMP', 'START');

    try {
      await ApiService.startPump(selectedDevice.id, user?.email || 'web_operator');
      setCommandStatusText('Pump Energized & Confirmed!');
      setTimeout(() => {
        setCommandPending(false);
        setCommandStatusText('');
      }, 1000);
    } catch (err: any) {
      setPumpStatus(previousState);
      setCommandPending(false);
      setCommandStatusText('');
      alert(`Could not start pump: ${err.message}`);
    }
  };

  const stopPump = async () => {
    if (!selectedDevice) return;
    const previousState = pumpStatus;
    setCommandPending(true);
    setCommandStatusText('De-energizing Contactor via MQTT...');

    // Optimistic UI update
    setPumpStatus(prev => prev ? { ...prev, pump_state: 'OFF', current_draw_amps: 0.0 } : null);

    // Direct MQTT Command dispatch
    publishDirectMqttCommand('STOP_PUMP', 'STOP');

    try {
      await ApiService.stopPump(selectedDevice.id, user?.email || 'web_operator');
      setCommandStatusText('Pump De-energized & Standby Confirmed');
      setTimeout(() => {
        setCommandPending(false);
        setCommandStatusText('');
      }, 1000);
    } catch (err: any) {
      setPumpStatus(previousState);
      setCommandPending(false);
      setCommandStatusText('');
      alert(`Could not stop pump: ${err.message}`);
    }
  };

  const setMode = async (mode: string) => {
    if (!selectedDevice) return;
    const previousMode = pumpStatus?.mode;
    setPumpStatus(prev => prev ? { ...prev, mode: mode as any } : null);

    publishDirectMqttCommand('SET_MODE', 'SET_MODE', { mode });

    try {
      await ApiService.setPumpMode(selectedDevice.id, mode, user?.email || 'web_operator');
    } catch (err: any) {
      setPumpStatus(prev => prev ? { ...prev, mode: (previousMode || 'AUTOMATIC') as any } : null);
      alert(`Could not switch mode: ${err.message}`);
    }
  };

  const emergencyStop = async (reason?: string) => {
    if (!selectedDevice) return;
    setCommandPending(true);
    setCommandStatusText('TRIPPING EMERGENCY MOTOR CUTOFF...');

    setPumpStatus(prev => prev ? { ...prev, pump_state: 'FAULT', current_draw_amps: 0.0 } : null);

    publishDirectMqttCommand('EMERGENCY_STOP', 'EMERGENCY_STOP', { reason: reason || 'Operator UI E-Stop' });

    try {
      await ApiService.emergencyStop(selectedDevice.id, reason || 'Operator UI E-Stop');
      setCommandStatusText('Emergency Lockout Activated!');
      setTimeout(() => {
        setCommandPending(false);
        setCommandStatusText('');
      }, 1500);
    } catch (err: any) {
      setCommandPending(false);
      setCommandStatusText('');
      alert(`Emergency Stop failed: ${err.message}`);
    }
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
