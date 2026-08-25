import React, { useState } from 'react';
import { Sidebar, NavTab } from './components/Layout/Sidebar';
import { TopBar } from './components/Layout/TopBar';
import { TankCanvas } from './components/TankVisualization/TankCanvas';
import { PumpControlCard } from './components/PumpControl/PumpControlCard';
import { SensorGrid } from './components/SensorCards/SensorGrid';
import { AutomationPanel } from './components/Automation/AutomationPanel';
import { AlertsView } from './components/Alerts/AlertsView';
import { AnalyticsView } from './components/Analytics/AnalyticsView';
import { ProvisioningWizard } from './components/Provisioning/ProvisioningWizard';
import { ProjectorView } from './components/ProjectorMode/ProjectorView';
import { AuthModal } from './components/Auth/AuthModal';
import { useDevice } from './context/DeviceContext';
import { useAuth } from './context/AuthContext';
import { Cpu, UploadCloud } from 'lucide-react';
import { ApiService } from './services/api';

export const UserApp: React.FC = () => {
  const { selectedDevice, pumpStatus, telemetry, alerts } = useDevice();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [otaStatus, setOtaStatus] = useState<string>('');

  const isDeviceOnline = selectedDevice?.status === 'online';
  const isRunning = isDeviceOnline && pumpStatus?.pump_state === 'ON';
  const waterPct = isDeviceOnline ? Number(telemetry?.water_level_percentage ?? 0) : 0;
  const volumeLiters = isDeviceOnline ? Number(telemetry?.water_level_liters ?? 0) : 0;
  const inflowRate = isDeviceOnline ? Number(telemetry?.inflow_rate_lpm ?? 0) : 0;
  const unackAlerts = alerts.filter(a => !a.acknowledged).length;

  const triggerOtaUpdate = async () => {
    if (!selectedDevice) return;
    setOtaStatus('Transmitting signed OTA package to ESP32...');
    try {
      await ApiService.triggerOta(selectedDevice.id, 'v2.1.0');
      setTimeout(() => setOtaStatus('Firmware downloaded & flashed successfully! ESP32 restarting.'), 2000);
    } catch (err: any) {
      setOtaStatus(`OTA Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex transition-colors duration-200" style={{ backgroundColor: 'var(--neu-bg)' }}>
      {/* Left Navigation Sidebar (User / Operator Only) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unackAlertsCount={unackAlerts}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <TopBar
          onOpenAuth={() => setShowAuthModal(true)}
          onOpenAlerts={() => setActiveTab('alerts')}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Physical Hardware Offline Banner */}
          {!isDeviceOnline && (
            <div className="p-4 neu-card border border-rose-500/40 bg-rose-950/20 rounded-2xl flex items-center justify-between animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center text-rose-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider font-mono">
                    PHYSICAL HARDWARE CONTROLLER OFFLINE
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Node <span className="text-white font-bold">{selectedDevice?.device_uid || 'WPC-A81F29'}</span> is disconnected or powered off. Tank sensors & motor telemetry are set to 0.
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center space-x-2 text-[10px] font-mono text-rose-300 font-bold neu-inset px-3 py-1.5 rounded-xl">
                <span>RECONNECTING...</span>
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Top Hero Grid: Giant Pump Controller + Liquid Wave Tank */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Pump Control Card (7 cols) */}
                <div className="lg:col-span-7">
                  <PumpControlCard />
                </div>

                {/* Right: Fluid Liquid Wave Tank (5 cols) */}
                <div className="lg:col-span-5 neu-card p-6 flex flex-col justify-between rounded-3xl">
                  <div className="flex items-center justify-between pb-3 px-1 border-b border-slate-700/20">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                      OVERHEAD TANK DYNAMICS
                    </span>
                    <span className="text-xs font-mono text-cyan-400 font-bold">
                      CAPACITY: {selectedDevice?.tank_capacity_liters || 2000}L
                    </span>
                  </div>

                  <div className="py-2">
                    <TankCanvas
                      levelPercentage={waterPct}
                      volumeLiters={volumeLiters}
                      maxCapacityLiters={selectedDevice?.tank_capacity_liters || 2000}
                      inflowRateLpm={inflowRate}
                      isPumpRunning={isRunning}
                    />
                  </div>
                </div>
              </div>

              {/* Middle: Live Sensor Telemetry Gauges */}
              <div>
                <SensorGrid />
              </div>

              {/* Bottom: Quick Status & Edge Automation Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="neu-card p-6 rounded-3xl">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700/20">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                      EDGE AUTOMATION STATUS
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs font-mono text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Low-Level Auto-Start Trigger:</span>
                      <span className="font-bold text-amber-400">&lt; 30% Tank</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">High-Level Auto-Stop Cutoff:</span>
                      <span className="font-bold text-emerald-400">&gt;= 95% Tank</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dry-Run Borewell Timeout:</span>
                      <span className="font-bold text-cyan-400">120 Seconds (0 LPM)</span>
                    </div>
                  </div>
                </div>

                <div className="neu-card p-6 rounded-3xl">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700/20">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                      HARDWARE COMMUNICATIONS
                    </span>
                    <span className="text-xs font-mono text-cyan-400 font-bold">
                      DUAL MESH LINK
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs font-mono text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Main Controller Link:</span>
                      <span className="font-bold text-emerald-400">MQTT TCP 1883 + REST Port 80</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tank Sub-Node Link:</span>
                      <span className="font-bold text-cyan-400">ESP-NOW 2.4GHz RF (CRC16)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Opto-Isolated Pilot Relay:</span>
                      <span className="font-bold text-emerald-400">Active LOW Interlock Armed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEDICATED PUMP CONTROLLER */}
          {activeTab === 'pump_control' && (
            <div className="max-w-4xl mx-auto">
              <PumpControlCard />
            </div>
          )}

          {/* TAB 3: WATER TANK VISUALIZATION */}
          {activeTab === 'tank_monitor' && (
            <div className="max-w-3xl mx-auto neu-card p-8 rounded-3xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-700/20">
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                    OVERHEAD RESERVOIR HYDRODYNAMIC MODEL
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Real-time sinus liquid waveform calculations & volumetric sensor interpolation
                  </p>
                </div>
                <span className="text-xs font-mono text-cyan-400 font-bold px-3 py-1 rounded-full neu-inset">
                  {selectedDevice?.tank_capacity_liters || 2000} LITERS MAX
                </span>
              </div>

              <div className="py-6">
                <TankCanvas
                  levelPercentage={waterPct}
                  volumeLiters={volumeLiters}
                  maxCapacityLiters={selectedDevice?.tank_capacity_liters || 2000}
                  inflowRateLpm={inflowRate}
                  isPumpRunning={isRunning}
                />
              </div>
            </div>
          )}

          {/* TAB 4: TELEMETRY ANALYTICS */}
          {activeTab === 'analytics' && <AnalyticsView />}

          {/* TAB 5: AUTONOMOUS RULES */}
          {activeTab === 'automation' && <AutomationPanel />}

          {/* TAB 6: ALARM FEED */}
          {activeTab === 'alerts' && <AlertsView />}

          {/* TAB 7: DEVICE PROVISIONING */}
          {activeTab === 'provisioning' && <ProvisioningWizard />}

          {/* TAB 8: CONTROL ROOM PROJECTOR VIEW */}
          {activeTab === 'projector' && <ProjectorView />}

          {/* TAB 9: SYSTEM SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="neu-card p-6 sm:p-8 rounded-3xl">
                <h2 className="text-xl font-bold mb-5 flex items-center space-x-2" style={{ fontFamily: 'var(--font-display)' }}>
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  <span>HARDWARE & FIRMWARE SETTINGS</span>
                </h2>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 neu-inset rounded-2xl">
                    <div>
                      <span className="text-sm font-bold block">ESP32 Firmware Version</span>
                      <p className="text-xs text-slate-400 font-mono">Current: v2.1.0 (Neumorphic Engine)</p>
                    </div>
                    <button
                      type="button"
                      onClick={triggerOtaUpdate}
                      className="neu-btn neu-btn-primary px-5 py-2.5 text-xs font-bold flex items-center space-x-1.5 rounded-2xl cursor-pointer"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>TRIGGER OTA UPDATE</span>
                    </button>
                  </div>

                  {otaStatus && (
                    <div className="p-3.5 neu-inset text-xs font-mono text-cyan-300 animate-pulse rounded-xl">
                      {otaStatus}
                    </div>
                  )}

                  <div className="p-5 neu-inset rounded-2xl space-y-2.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Device Serial Number:</span>
                      <span className="font-bold">{selectedDevice?.serial_number || 'SN-2026-ESP32-9921'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hardware Revision:</span>
                      <span className="font-bold">REV_2.1 (Industrial Grade)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Local Subnet IP:</span>
                      <span className="font-bold">{selectedDevice?.local_ip || '192.168.31.54'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">MAC Address:</span>
                      <span className="font-bold">{selectedDevice?.mac_address || '24:6F:28:A8:1F:29'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Operator Authentication Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};
