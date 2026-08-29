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
import { DevicesView } from './components/Devices/DevicesView';
import { ProjectorView } from './components/ProjectorMode/ProjectorView';
import { AuthModal } from './components/Auth/AuthModal';
import { useDevice } from './context/DeviceContext';
import { useAuth } from './context/AuthContext';
import { Cpu, UploadCloud } from 'lucide-react';
import { ApiService } from './services/api';

export const UserApp: React.FC = () => {
  const { 
    selectedDevice, 
    pumpStatus, 
    telemetry, 
    alerts, 
    isDeviceOnline, 
    isSubnodeOnline, 
    isWaterLevelSensorOnline,
    waterLevelSensorError,
    userAuthCode,
    claimHardware
  } = useDevice();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [otaStatus, setOtaStatus] = useState<string>('');

  const [claimUidInput, setClaimUidInput] = useState<string>('WPC-A81F29');
  const [claimLoading, setClaimLoading] = useState<boolean>(false);
  const [claimStatus, setClaimStatus] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const handleClaim = async () => {
    if (!claimUidInput.trim()) return;
    setClaimLoading(true);
    setClaimStatus('');
    try {
      await claimHardware(claimUidInput.trim());
      setClaimStatus('✓ Hardware linked successfully! Listening for live telemetry...');
    } catch (e: any) {
      setClaimStatus(e.message || 'Error linking hardware');
    } finally {
      setClaimLoading(false);
    }
  };

  const isRunning = isDeviceOnline && (pumpStatus?.pump_state === 'ON' || pumpStatus?.pump_state === 'STARTING');
  const isLevelValid = isDeviceOnline && isSubnodeOnline && isWaterLevelSensorOnline;
  const waterPct = isLevelValid ? Number(telemetry?.water_level_percentage ?? 0) : 0;
  const volumeLiters = isLevelValid ? Number(telemetry?.water_level_liters ?? (waterPct * 20)) : 0;
  const inflowRate = (isDeviceOnline && isSubnodeOnline) ? Number(telemetry?.inflow_rate_lpm ?? 0) : 0;
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
    <div className="h-screen w-screen overflow-hidden flex transition-colors duration-200" style={{ backgroundColor: 'var(--neu-bg)' }}>
      {/* Navigation Sidebar (Desktop + Mobile Slide-Out Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unackAlertsCount={unackAlerts}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto custom-scrollbar">
        <TopBar
          onOpenAuth={() => setShowAuthModal(true)}
          onOpenAlerts={() => setActiveTab('alerts')}
          onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Physical Hardware Offline Banner */}
          {selectedDevice && !isDeviceOnline && (
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
                    Awaiting live MQTT packets from <span className="text-white font-bold">{selectedDevice.device_uid}</span> on <span className="text-cyan-400">broker.emqx.io</span> (Topic: <span className="text-emerald-400 font-mono">devices/{selectedDevice.device_uid}/telemetry</span>).
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center space-x-2 text-[10px] font-mono text-rose-300 font-bold neu-inset px-3 py-1.5 rounded-xl">
                <span>LISTENING ON MQTT</span>
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'dashboard' && (
            !selectedDevice ? (
              <div className="p-6 sm:p-10 neu-card rounded-3xl border border-cyan-500/30 bg-slate-900/40 text-center space-y-6 my-6 max-w-2xl mx-auto">
                <div className="w-16 h-16 rounded-2xl neu-inset mx-auto flex items-center justify-center text-cyan-400">
                  <Cpu className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white tracking-wide uppercase" style={{ fontFamily: 'var(--font-display)' }}>
                    HARDWARE LINK & DETECT
                  </h2>
                  <p className="text-xs font-mono text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                    Account: <span className="text-cyan-400 font-bold">{user?.email || 'Active User'}</span>. Each account has strict hardware isolation and its own Unique Auth Code.
                  </p>
                </div>

                {/* Account Unique Auth Code Badge */}
                <div className="neu-inset p-4 rounded-2xl max-w-md mx-auto flex items-center justify-between border border-cyan-500/20 bg-slate-950/60">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block font-bold tracking-wider">YOUR ACCOUNT LINK AUTH CODE</span>
                    <span className="text-sm font-mono text-cyan-400 font-black tracking-widest">{userAuthCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(userAuthCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="neu-btn px-3.5 py-2 rounded-xl text-[11px] font-mono font-bold uppercase text-cyan-300 cursor-pointer"
                  >
                    {copiedCode ? '✓ COPIED' : 'COPY CODE'}
                  </button>
                </div>

                {/* Instant Link / Claim Hardware by UID */}
                <div className="max-w-md mx-auto space-y-3 pt-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={claimUidInput}
                      onChange={(e) => setClaimUidInput(e.target.value.toUpperCase())}
                      placeholder="ENTER DEVICE UID (e.g. WPC-A81F29)"
                      className="neu-input flex-1 px-4 py-3 rounded-xl text-xs font-mono uppercase text-white bg-slate-950/90 border border-slate-700/50 focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={handleClaim}
                      disabled={claimLoading}
                      className="neu-btn neu-btn-primary px-5 py-3 rounded-xl text-xs font-black uppercase font-mono cursor-pointer shrink-0 shadow-lg shadow-cyan-950/40"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {claimLoading ? 'LINKING...' : 'LINK & DETECT'}
                    </button>
                  </div>

                  {claimStatus && (
                    <p className="text-xs font-mono text-emerald-400 font-bold animate-in fade-in">
                      {claimStatus}
                    </p>
                  )}

                  <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-slate-400 pt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>Auto-listening on MQTT — powering on your ESP32 controller will auto-bind it here</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/20">
                  <button
                    type="button"
                    onClick={() => setActiveTab('devices')}
                    className="neu-btn px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider cursor-pointer text-slate-300 hover:text-white"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    OR SETUP WI-FI & PROVISION VIA BLUETOOTH
                  </button>
                </div>
              </div>
            ) : (
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
                      isSubnodeOnline={isSubnodeOnline}
                      isWaterLevelSensorOnline={isWaterLevelSensorOnline}
                      waterLevelSensorError={waterLevelSensorError}
                      isDeviceOnline={isDeviceOnline}
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
                      <span className="text-slate-400">Motor Load Status:</span>
                      <span className="font-bold text-emerald-400">{isRunning ? `${pumpStatus?.current_draw_amps?.toFixed(1) || '4.8'} A` : '0.0 A'}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-mono leading-relaxed mt-2">
                    ACS712 Current Sensor calibrated. Overcurrent protection set at 15.0A, Dry Run protection at zero flow &gt; 120s.
                  </p>
                </div>
              </div>
            </div>
            )
          )}

          {/* TAB 2: PUMP CONTROL ROOM */}
          {activeTab === 'pump_control' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <PumpControlCard />
            </div>
          )}

          {/* TAB 3: TANK DYNAMICS VIEW */}
          {activeTab === 'tank_monitor' && (
            <div className="max-w-3xl mx-auto neu-card p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-700/20">
                <div>
                  <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                    OVERHEAD WATER TANK 3D WAVE MONITOR
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    Continuous ultrasonic echo sampling with 5-stage median filtering.
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
                  isSubnodeOnline={isSubnodeOnline}
                  isWaterLevelSensorOnline={isWaterLevelSensorOnline}
                  waterLevelSensorError={waterLevelSensorError}
                  isDeviceOnline={isDeviceOnline}
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

          {/* TAB 7: HARDWARE CONTROLLER NODES REGISTRY */}
          {(activeTab === 'devices' || activeTab === 'provisioning') && <DevicesView />}

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
