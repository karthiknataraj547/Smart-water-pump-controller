import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { useAuth } from '../../context/AuthContext';
import { Device } from '../../types';
import {
  Cpu,
  Plus,
  Radio,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Trash2,
  Sliders,
  Wifi,
  Waves,
  Zap,
  HardDrive,
  Bluetooth,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { ProvisioningWizard } from '../Provisioning/ProvisioningWizard';

export const DevicesView: React.FC = () => {
  const { 
    devices, 
    selectedDevice, 
    setSelectedDevice, 
    userAuthCode, 
    claimHardware, 
    unlinkHardware, 
    isDeviceOnline,
    telemetry,
    pumpStatus
  } = useDevice();
  const { user } = useAuth();

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showBleWizard, setShowBleWizard] = useState<boolean>(false);
  const [newDeviceUid, setNewDeviceUid] = useState<string>('WPC-A81F29');
  const [customDeviceName, setCustomDeviceName] = useState<string>('Overhead Storage Tank');
  const [tankCapacityLiters, setTankCapacityLiters] = useState<number>(2000);
  const [tankHeightCm, setTankHeightCm] = useState<number>(180);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [claimError, setClaimError] = useState<string>('');
  const [claimSuccess, setClaimSuccess] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceUid.trim()) {
      setClaimError('Please enter a valid Device UID');
      return;
    }

    setClaiming(true);
    setClaimError('');
    setClaimSuccess('');

    try {
      await claimHardware(newDeviceUid.trim(), customDeviceName.trim());
      setClaimSuccess(`Device ${newDeviceUid.toUpperCase()} successfully claimed and linked to your account!`);
      setTimeout(() => {
        setShowAddModal(false);
        setClaimSuccess('');
      }, 1200);
    } catch (err: any) {
      setClaimError(err.message || 'Error linking hardware');
    } finally {
      setClaiming(false);
    }
  };

  const sampleHardwarePresets = [
    { uid: 'WPC-A81F29', name: 'Main Overhead Tank Controller', capacity: 2000, height: 180 },
    { uid: 'WPC-B92C30', name: 'Ground Sump & Booster Node', capacity: 5000, height: 220 },
    { uid: 'WPC-C33D41', name: 'Borewell Secondary Pump', capacity: 1500, height: 160 }
  ];

  const handleQuickAddPreset = async (preset: typeof sampleHardwarePresets[0]) => {
    setClaiming(true);
    setClaimError('');
    try {
      await claimHardware(preset.uid, preset.name);
      setClaimSuccess(`Linked ${preset.name} (${preset.uid})!`);
      setTimeout(() => {
        setShowAddModal(false);
        setClaimSuccess('');
      }, 1000);
    } catch (err: any) {
      setClaimError(err.message || 'Failed to link preset hardware');
    } finally {
      setClaiming(false);
    }
  };

  if (showBleWizard) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={() => setShowBleWizard(false)}
            className="neu-btn px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase text-slate-300 hover:text-white cursor-pointer"
          >
            ← BACK TO DEVICES LIST
          </button>
        </div>
        <ProvisioningWizard />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner: Account Auth Code & Action Header */}
      <div className="neu-card p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-cyan-500/20">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            <span>AUTHENTICATED HARDWARE REGISTRY</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            LINKED HARDWARE DEVICES
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1 max-w-xl">
            Account: <span className="text-cyan-400 font-bold">{user?.email}</span>. Only hardware tagged with your unique Account Auth Code can stream telemetry to this account.
          </p>
        </div>

        {/* User Auth Code Pill */}
        <div className="neu-inset p-4 rounded-2xl flex items-center justify-between gap-4 border border-cyan-500/30 bg-slate-950/70 shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block font-bold tracking-wider">YOUR ACCOUNT AUTH CODE</span>
            <span className="text-sm font-mono text-cyan-400 font-black tracking-widest">{userAuthCode}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(userAuthCode);
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 2000);
            }}
            className="neu-btn px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase text-cyan-300 flex items-center space-x-1 cursor-pointer"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'COPIED' : 'COPY'}</span>
          </button>
        </div>
      </div>

      {/* Action Bar: Add Device & Setup */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>Active Controller Nodes: <strong className="text-white">{devices.length}</strong></span>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowBleWizard(true)}
            className="neu-btn px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white cursor-pointer flex-1 sm:flex-none flex items-center justify-center space-x-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <Bluetooth className="w-4 h-4 text-cyan-400" />
            <span>BLUETOOTH (BLE) SETUP</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="neu-btn neu-btn-primary px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-950/50 flex-1 sm:flex-none flex items-center justify-center space-x-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <Plus className="w-4 h-4" />
            <span>+ ADD / LINK HARDWARE</span>
          </button>
        </div>
      </div>

      {/* Device Cards Grid */}
      {devices.length === 0 ? (
        <div className="neu-card p-12 rounded-3xl text-center space-y-5 border border-cyan-500/20 my-4">
          <div className="w-16 h-16 rounded-2xl neu-inset mx-auto flex items-center justify-center text-cyan-400">
            <Cpu className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-extrabold text-white uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            NO HARDWARE CONTROLLERS LINKED
          </h3>
          <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
            Click the button below to link your ESP32 controller (UID: WPC-A81F29) or pair via Bluetooth.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="neu-btn neu-btn-primary px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              + LINK CONTROLLER TO THIS ACCOUNT
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((dev) => {
            const isSelected = selectedDevice?.id === dev.id || selectedDevice?.device_uid === dev.device_uid;
            const isOnline = isSelected ? isDeviceOnline : (dev.status === 'online');

            return (
              <div
                key={dev.id || dev.device_uid}
                onClick={() => setSelectedDevice(dev)}
                className={`neu-card p-6 rounded-3xl transition-all relative flex flex-col justify-between border cursor-pointer ${
                  isSelected
                    ? 'border-cyan-400 shadow-xl shadow-cyan-950/40 ring-2 ring-cyan-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top Bar: Icon + Status Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl neu-inset flex items-center justify-center ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`}>
                      <Cpu className="w-6 h-6" />
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 ${
                        isOnline
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-900 text-slate-500 border border-slate-700/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                        <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                      </span>

                      {isSelected && (
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Device Identifiers */}
                  <h3 className="text-base font-extrabold text-white tracking-wide uppercase" style={{ fontFamily: 'var(--font-display)' }}>
                    {dev.device_uid}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {dev.serial_number || 'ESP32 Main Node Controller'}
                  </p>

                  {/* Live Metrics Summary */}
                  {isSelected && (
                    <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-2xl neu-inset">
                      <div>
                        <span className="text-[9px] font-mono text-slate-500 uppercase block font-bold">WATER LEVEL</span>
                        <span className="text-sm font-mono font-black text-cyan-400">
                          {Number(telemetry?.water_level_percentage ?? 0).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-500 uppercase block font-bold">PUMP STATE</span>
                        <span className={`text-sm font-mono font-black ${pumpStatus?.pump_state === 'ON' ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {pumpStatus?.pump_state || 'OFF'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Device Specifications */}
                  <div className="mt-4 space-y-1.5 text-xs font-mono border-t border-slate-800/80 pt-3 text-slate-400">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tank Capacity:</span>
                      <span className="text-slate-200 font-bold">{dev.tank_capacity_liters || 2000} Liters</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tank Height:</span>
                      <span className="text-slate-200 font-bold">{dev.tank_height_cm || 180} cm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Firmware:</span>
                      <span className="text-cyan-400 font-bold">{dev.firmware_version || 'v2.1.0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Auth Token:</span>
                      <span className="text-slate-400 truncate max-w-[140px]">{userAuthCode}</span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDevice(dev);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all flex-1 ${
                      isSelected
                        ? 'neu-btn neu-btn-primary text-cyan-950 font-black'
                        : 'neu-btn text-slate-300 hover:text-white'
                    }`}
                  >
                    {isSelected ? '✓ ACTIVE NODE' : 'SELECT NODE'}
                  </button>

                  <button
                    type="button"
                    title="Unlink from this account"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Unlink controller ${dev.device_uid} from your account?`)) {
                        unlinkHardware(dev.id || dev.device_uid);
                      }
                    }}
                    className="p-2 rounded-xl neu-btn text-slate-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD / CLAIM NEW HARDWARE CONTROLLER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="neu-card p-6 sm:p-8 max-w-lg w-full rounded-3xl border border-cyan-500/30 animate-in fade-in zoom-in-95"
            style={{ backgroundColor: 'var(--neu-surface)' }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/30">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-extrabold text-white uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                  ADD / LINK HARDWARE CONTROLLER
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full neu-inset flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleClaimSubmit} className="space-y-4 mt-5">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1.5">
                  Hardware Device UID *
                </label>
                <input
                  type="text"
                  required
                  value={newDeviceUid}
                  onChange={(e) => setNewDeviceUid(e.target.value.toUpperCase())}
                  placeholder="e.g. WPC-A81F29"
                  className="neu-input w-full px-4 py-3 rounded-xl text-xs font-mono uppercase text-white bg-slate-950 border border-slate-700 focus:border-cyan-400"
                />
                <p className="text-[10px] font-mono text-slate-500 mt-1">
                  Unique Hardware ID printed on your ESP32 controller enclosure.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1.5">
                  Controller Label / Station Name
                </label>
                <input
                  type="text"
                  value={customDeviceName}
                  onChange={(e) => setCustomDeviceName(e.target.value)}
                  placeholder="e.g. Overhead Tank 1"
                  className="neu-input w-full px-4 py-3 rounded-xl text-xs font-mono text-white bg-slate-950 border border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-slate-400 mb-1">
                    Tank Capacity (Liters)
                  </label>
                  <input
                    type="number"
                    value={tankCapacityLiters}
                    onChange={(e) => setTankCapacityLiters(Number(e.target.value))}
                    className="neu-input w-full px-3 py-2.5 rounded-xl text-xs font-mono text-white bg-slate-950 border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-slate-400 mb-1">
                    Tank Height (cm)
                  </label>
                  <input
                    type="number"
                    value={tankHeightCm}
                    onChange={(e) => setTankHeightCm(Number(e.target.value))}
                    className="neu-input w-full px-3 py-2.5 rounded-xl text-xs font-mono text-white bg-slate-950 border border-slate-700"
                  />
                </div>
              </div>

              {/* Preset Hardware Shortcuts */}
              <div className="pt-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold mb-2">
                  OR QUICK-LINK TEST CONTROLLERS:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {sampleHardwarePresets.map((p) => (
                    <button
                      key={p.uid}
                      type="button"
                      onClick={() => handleQuickAddPreset(p)}
                      className="neu-btn p-2.5 rounded-xl text-left hover:border-cyan-400 cursor-pointer"
                    >
                      <span className="text-xs font-mono font-black text-cyan-300 block">{p.uid}</span>
                      <span className="text-[9px] font-mono text-slate-400 truncate block">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {claimError && (
                <div className="p-3 rounded-xl neu-inset text-rose-400 text-xs font-mono flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{claimError}</span>
                </div>
              )}

              {claimSuccess && (
                <div className="p-3 rounded-xl neu-inset text-emerald-400 text-xs font-mono flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{claimSuccess}</span>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-700/30">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="neu-btn px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase text-slate-400 hover:text-white cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={claiming}
                  className="neu-btn neu-btn-primary px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider font-mono cursor-pointer"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {claiming ? 'CLAIMING & LINKING...' : 'LINK TO ACCOUNT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
