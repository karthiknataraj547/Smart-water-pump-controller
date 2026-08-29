import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { useAuth } from '../../context/AuthContext';
import {
  Cpu,
  Plus,
  Radio,
  Trash2,
  Wifi,
  Bluetooth,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { ProvisioningWizard } from '../Provisioning/ProvisioningWizard';

export const DevicesView: React.FC = () => {
  const { 
    devices, 
    selectedDevice, 
    setSelectedDevice, 
    claimHardware, 
    unlinkHardware, 
    isDeviceOnline,
    telemetry,
    pumpStatus
  } = useDevice();
  const { user } = useAuth();

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showBleWizard, setShowBleWizard] = useState<boolean>(false);
  const [deviceUidInput, setDeviceUidInput] = useState<string>('WPC-A81F29');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const handleAddDevice = async (uidToLink?: string) => {
    const targetUid = (uidToLink || deviceUidInput).trim();
    if (!targetUid) {
      setErrorMsg('Please enter a Device ID');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await claimHardware(targetUid);
      setSuccessMsg(`✓ Controller ${targetUid.toUpperCase()} connected successfully!`);
      setTimeout(() => {
        setShowAddModal(false);
        setSuccessMsg('');
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not link device');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string, uid: string) => {
    if (window.confirm(`Remove hardware "${uid}" from your account?\n\nIt will be freed immediately so another account can use it.`)) {
      await unlinkHardware(deviceId || uid);
    }
  };

  if (showBleWizard) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => setShowBleWizard(false)}
          className="neu-btn px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase text-slate-300 hover:text-white cursor-pointer"
        >
          ← BACK TO DEVICES
        </button>
        <ProvisioningWizard />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="neu-card p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-cyan-500/20">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
            MY HARDWARE CONTROLLERS
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Logged in as <strong className="text-cyan-400">{user?.email}</strong>. Connected hardware is locked to your account.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowBleWizard(true)}
            className="neu-btn px-4 py-2.5 rounded-xl text-xs font-bold uppercase text-slate-300 hover:text-white flex items-center space-x-2 cursor-pointer"
          >
            <Bluetooth className="w-4 h-4 text-cyan-400" />
            <span>SETUP NEW WI-FI</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="neu-btn neu-btn-primary px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center space-x-2 cursor-pointer"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <Plus className="w-4 h-4" />
            <span>+ ADD CONTROLLER</span>
          </button>
        </div>
      </div>

      {/* Empty State: Require Setup Wizard or Explicit Device ID */}
      {devices.length === 0 && (
        <div className="neu-card p-8 rounded-3xl text-center space-y-4 border border-cyan-500/30">
          <div className="w-14 h-14 rounded-2xl neu-inset mx-auto flex items-center justify-center text-cyan-400">
            <Cpu className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            NO HARDWARE LINKED TO THIS ACCOUNT
          </h2>
          <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
            Hardware is strictly locked per account. Run the Setup Wizard to pair and bind your hardware to this account.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowBleWizard(true)}
              className="neu-btn neu-btn-primary px-6 py-3 rounded-2xl text-xs font-black uppercase flex items-center space-x-2 cursor-pointer"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Bluetooth className="w-4 h-4" />
              <span>LAUNCH SETUP WIZARD (BLUETOOTH / WI-FI)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="neu-btn px-6 py-3 rounded-2xl text-xs font-bold uppercase text-slate-300 hover:text-white flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>ENTER DEVICE ID MANUALLY</span>
            </button>
          </div>
        </div>
      )}

      {/* Device Cards Grid */}
      {devices.length > 0 && (
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
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl neu-inset flex items-center justify-center ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`}>
                      <Cpu className="w-5 h-5" />
                    </div>

                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold uppercase flex items-center space-x-1.5 ${
                      isOnline
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-900 text-slate-500 border border-slate-700/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                      <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-white uppercase tracking-wide font-mono">
                    {dev.device_uid}
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    {dev.serial_number || 'ESP32 Main Node'}
                  </p>

                  {/* Live Status Preview */}
                  {isSelected && (
                    <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-xl neu-inset font-mono">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-bold">WATER LEVEL</span>
                        <span className="text-sm font-black text-cyan-400">
                          {Number(telemetry?.water_level_percentage ?? 0).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-bold">PUMP MOTOR</span>
                        <span className={`text-sm font-black ${pumpStatus?.pump_state === 'ON' ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {pumpStatus?.pump_state || 'OFF'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDevice(dev);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase flex-1 ${
                      isSelected
                        ? 'neu-btn neu-btn-primary text-cyan-950 font-black'
                        : 'neu-btn text-slate-300 hover:text-white'
                    }`}
                  >
                    {isSelected ? '✓ ACTIVE' : 'SELECT'}
                  </button>

                  <button
                    type="button"
                    title="Delete & Release Hardware"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDevice(dev.id, dev.device_uid);
                    }}
                    className="p-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-800/30 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SIMPLE MODAL: ADD / LINK CONTROLLER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="neu-card p-6 sm:p-8 max-w-md w-full rounded-3xl border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/30">
              <h3 className="text-base font-extrabold text-white uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                ADD HARDWARE CONTROLLER
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleAddDevice(); }} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1.5">
                  Controller Device ID
                </label>
                <input
                  type="text"
                  required
                  value={deviceUidInput}
                  onChange={(e) => setDeviceUidInput(e.target.value.toUpperCase())}
                  placeholder="e.g. WPC-A81F29"
                  className="w-full neu-input font-mono font-bold text-cyan-400 tracking-wider"
                />
                <p className="text-[11px] font-mono text-slate-500 mt-1">
                  Printed on the device sticker or displayed on Bluetooth scan.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-300 text-xs font-mono flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-xl text-emerald-300 text-xs font-mono flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full neu-btn neu-btn-primary py-3 rounded-2xl text-xs font-black uppercase cursor-pointer"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {loading ? 'CONNECTING...' : 'LINK TO MY ACCOUNT'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
