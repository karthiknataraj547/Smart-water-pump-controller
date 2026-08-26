import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Device, PumpStatus, SensorReading, Alert, AutomationRule } from '../types';
import { ApiService } from '../services/api';
import { useAuth } from './AuthContext';

interface DeviceContextType {
  devices: Device[];
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device) => void;
  pumpStatus: PumpStatus | null;
  telemetry: SensorReading | null;
  alerts: Alert[];
  rules: AutomationRule[];
  wsConnected: boolean;
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
  const custom = localStorage.getItem('pump_custom_gateway');
  if (custom) {
    const clean = custom.replace(/^http/, 'ws');
    return `${clean}/ws?token=${token || ''}&clientType=web`;
  }

  const metaEnv = (import.meta as any)?.env;
  if (metaEnv?.VITE_API_URL) {
    const clean = metaEnv.VITE_API_URL.replace(/^http/, 'ws');
    return `${clean}/ws?token=${token || ''}&clientType=web`;
  }

  const host = window.location.hostname || 'localhost';
  if (host === 'localhost' || host === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${host}:5000/ws?token=${token || ''}&clientType=web`;
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
  const [commandPending, setCommandPending] = useState<boolean>(false);
  const [commandStatusText, setCommandStatusText] = useState<string>('');
  
  // Real-Time Heartbeat Tracker
  const [lastTelemetryTimestamp, setLastTelemetryTimestamp] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1-second interval tick to continuously check heartbeat freshness
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Strict Physical Device Online State Check:
  // Hardware is ONLY online if WebSocket is connected, device status is online,
  // AND real telemetry was received within the last 7 seconds.
  const isDeviceOnline = Boolean(
    wsConnected &&
    selectedDevice?.status === 'online' &&
    lastTelemetryTimestamp > 0 &&
    (nowTick - lastTelemetryTimestamp < 7000)
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
      const [pStatus, tReading, aList, rList] = await Promise.allSettled([
        ApiService.getPumpStatus(deviceId),
        ApiService.getLatestSensorReading(deviceId),
        ApiService.getAlerts(deviceId),
        ApiService.getAutomationRules(deviceId)
      ]);

      if (pStatus.status === 'fulfilled') setPumpStatus(pStatus.value);
      if (tReading.status === 'fulfilled') {
        setTelemetry(tReading.value);
      }
      if (aList.status === 'fulfilled') setAlerts(aList.value);
      if (rList.status === 'fulfilled') setRules(rList.value);
    } catch (err) {
      console.warn('[DeviceContext] Error loading device details:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      loadDeviceData(selectedDevice.id);
    }
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

  // Connect WebSocket
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

    console.log('[WS] Connecting to real-time gateway at:', wsUrl);
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to Gateway Hub!');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleWebSocketMessage(msg);
        } catch (e) {
          console.warn('[WS] Non-JSON message received:', event.data);
        }
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
        setTelemetry(prev => ({
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
        }));
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

  // Pump Command Actions
  const startPump = async () => {
    if (!selectedDevice) return;
    const previousState = pumpStatus;
    setCommandPending(true);
    setCommandStatusText('Energizing Relay Contactor (Active LOW)...');

    // Optimistic UI update
    setPumpStatus(prev => prev ? { ...prev, pump_state: 'ON', current_draw_amps: 4.8 } : null);

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
    setCommandStatusText('De-energizing Contactor Interlock...');

    // Optimistic UI update
    setPumpStatus(prev => prev ? { ...prev, pump_state: 'OFF', current_draw_amps: 0.0 } : null);

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
