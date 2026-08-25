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
  commandPending: boolean;
  commandStatusText: string;
  refreshDevices: () => Promise<void>;
  refreshRules: () => Promise<void>;
  startPump: () => Promise<void>;
  stopPump: () => Promise<void>;
  setMode: (mode: string) => Promise<void>;
  emergencyStop: (reason?: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

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

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (tReading.status === 'fulfilled') setTelemetry(tReading.value);
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

  // WebSocket Connection
  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let isDestroyed = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const wsUrl = `${protocol}//${host}:5000/ws?token=${token || ''}&clientType=web`;

    function connectWs() {
      if (isDestroyed) return;
      console.log('[WS] Connecting to live real-time hub at:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isDestroyed) {
          ws.close();
          return;
        }
        console.log('[WS] Connected to Smart Water Pump WebSocket!');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        if (isDestroyed) return;
        try {
          const msg = JSON.parse(event.data);
          handleWebSocketMessage(msg);
        } catch (e) {
          console.warn('[WS] Non-JSON message received:', event.data);
        }
      };

      ws.onclose = () => {
        if (isDestroyed) return;
        setWsConnected(false);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isDestroyed) connectWs();
        }, 3000);
      };

      ws.onerror = () => {
        if (isDestroyed) return;
        // Quietly close so onclose can manage reconnect
        try { ws.close(); } catch (e) {}
      };
    }

    const connectTimer = setTimeout(() => {
      if (!isDestroyed) {
        connectWs();
      }
    }, 50);

    return () => {
      isDestroyed = true;
      clearTimeout(connectTimer);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [token]);

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
    } else if (event === 'TELEMETRY_UPDATE') {
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
        setCommandPending(false);
        setCommandStatusText('');
      }
    } else if (event === 'ALERT_TRIGGERED') {
      setAlerts(prev => [data, ...prev.slice(0, 49)]);
    } else if (event === 'ALERT_ACKNOWLEDGED') {
      setAlerts(prev => prev.map(a => a.id === data.alertId ? { ...a, acknowledged: true } : a));
    } else if (event === 'COMMAND_STATUS_UPDATE') {
      if (data.status === 'sent') {
        setCommandStatusText('Command sent to hardware controller...');
      } else if (data.status === 'successful') {
        setCommandPending(false);
        setCommandStatusText('State confirmed by hardware.');
        setTimeout(() => setCommandStatusText(''), 3000);
      } else if (data.status === 'failed') {
        setCommandPending(false);
        setCommandStatusText('Hardware rejected command.');
      }
    }
  };

  // Commands (Optimized for lightning-fast responsiveness & optimistic state)
  const startPump = async () => {
    if (!selectedDevice) return;

    const currentLevel = Number(telemetry?.water_level_percentage ?? 0);
    if (pumpStatus?.mode === 'AUTOMATIC' && currentLevel >= 95) {
      setCommandStatusText('⚠️ Cannot start: Tank full (>=95%) in AUTOMATIC mode. Switch to MANUAL mode to override.');
      setTimeout(() => setCommandStatusText(''), 4000);
      return;
    }

    // Optimistic UI response (0ms perceived latency)
    setPumpStatus(prev => prev ? { ...prev, pump_state: 'ON', current_draw_amps: prev.current_draw_amps || 4.8 } : null);
    setCommandPending(true);
    setCommandStatusText('START signal active & transmitting...');

    try {
      await ApiService.startPump(selectedDevice.id, 'web');
      setCommandPending(false);
      setCommandStatusText('✓ Pump START confirmed');
      setTimeout(() => setCommandStatusText(''), 2000);
    } catch (err: any) {
      setCommandPending(false);
      setCommandStatusText(`Error: ${err.message}`);
    }
  };

  const stopPump = async () => {
    if (!selectedDevice) return;

    // Optimistic UI response (0ms perceived latency)
    setPumpStatus(prev => prev ? { ...prev, pump_state: 'OFF', current_draw_amps: 0.0 } : null);
    setCommandPending(true);
    setCommandStatusText('STOP signal active & transmitting...');

    try {
      await ApiService.stopPump(selectedDevice.id, 'web');
      setCommandPending(false);
      setCommandStatusText('✓ Pump STOP confirmed');
      setTimeout(() => setCommandStatusText(''), 2000);
    } catch (err: any) {
      setCommandPending(false);
      setCommandStatusText(`Error: ${err.message}`);
    }
  };

  const setMode = async (mode: string) => {
    if (!selectedDevice) return;

    // Optimistic Mode Switch (0ms perceived latency)
    setPumpStatus(prev => prev ? { ...prev, mode: mode as any } : null);

    try {
      await ApiService.setPumpMode(selectedDevice.id, mode, 'web');
    } catch (err: any) {
      console.warn(`Failed to change mode: ${err.message}`);
    }
  };

  const emergencyStop = async (reason?: string) => {
    if (!selectedDevice) return;

    // Optimistic Emergency Lockout
    setPumpStatus(prev => prev ? { ...prev, pump_state: 'FAULT', current_draw_amps: 0.0 } : null);
    setCommandPending(true);
    setCommandStatusText('EMERGENCY HARDWARE LOCKOUT ENGAGED');

    try {
      await ApiService.emergencyStop(selectedDevice.id, reason);
      setCommandPending(false);
    } catch (err: any) {
      setCommandPending(false);
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
        commandPending,
        commandStatusText,
        refreshDevices,
        refreshRules,
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
