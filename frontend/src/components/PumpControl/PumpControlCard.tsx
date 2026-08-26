import React from 'react';
import { useDevice } from '../../context/DeviceContext';
import { Power, ShieldAlert, Zap, Clock, Activity, Lock, AlertCircle } from 'lucide-react';

export const PumpControlCard: React.FC = () => {
  const {
    pumpStatus,
    telemetry,
    rules,
    startPump,
    stopPump,
    setMode,
    emergencyStop,
    commandPending,
    commandStatusText,
    selectedDevice,
    isDeviceOnline
  } = useDevice();

  const isRunning = isDeviceOnline && pumpStatus?.pump_state === 'ON';
  const isFault = isDeviceOnline && pumpStatus?.pump_state === 'FAULT';
  const currentMode = pumpStatus?.mode || 'AUTOMATIC';
  const runtimeSec = Number(pumpStatus?.runtime_seconds) || 0;
  const currentAmps = Number(pumpStatus?.current_draw_amps) || 0;
  const currentWaterLevel = Number(telemetry?.water_level_percentage ?? 0);

  // Maximum water level off threshold for automation
  const autoCutoffThreshold = 95.0;
  const isTankFullInAuto = currentMode === 'AUTOMATIC' && currentWaterLevel >= autoCutoffThreshold;
  const isStartDisabled = !isDeviceOnline || commandPending || isRunning || isTankFullInAuto;

  // Format runtime to HH:MM:SS
  const formatRuntime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="neu-card p-6 flex flex-col justify-between h-full">
      {/* Panel Bezel & Status Header */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-700/20">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl neu-inset flex items-center justify-center text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                MAIN PUMP CONTROLLER
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Node: {selectedDevice?.device_uid || 'WPC-A81F29'} | Opto-Isolated Interlock
              </p>
            </div>
          </div>

          {/* Annunciator State Indicator */}
          <div className="flex items-center space-x-2.5 neu-inset px-4 py-2 rounded-xl">
            <span
              className={`w-2.5 h-2.5 rounded-full neu-dot ${
                !isDeviceOnline ? 'neu-dot-rose' : isFault ? 'neu-dot-rose animate-pulse' : isRunning ? 'neu-dot-emerald animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span
              className={`text-xs font-bold tracking-widest font-mono uppercase ${
                !isDeviceOnline ? 'text-rose-400 font-black' : isFault ? 'text-rose-400' : isRunning ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {!isDeviceOnline ? 'HARDWARE UNPOWERED / OFFLINE' : isFault ? 'FAULT / LOCKOUT' : isRunning ? 'RUNNING' : 'STANDBY'}
            </span>
          </div>
        </div>

        {/* Dual Instrumentation Displays (Runtime Clock & Motor Current) */}
        <div className="grid grid-cols-2 gap-4 my-5">
          {/* Active Runtime VFD */}
          <div className="neu-screen p-4 flex flex-col justify-center rounded-2xl">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>ACTIVE RUNTIME</span>
            </div>
            <span className="text-3xl font-extrabold text-cyan-400 tracking-wider">
              {isDeviceOnline && isRunning ? formatRuntime(runtimeSec) : '00:00:00'}
            </span>
          </div>

          {/* Motor Current Amps VFD */}
          <div className="neu-screen p-4 flex flex-col justify-center rounded-2xl">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-1">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>MOTOR CURRENT</span>
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-3xl font-extrabold text-amber-400 tracking-wider">
                {isDeviceOnline ? (Number(currentAmps) || 0).toFixed(1) : '0.0'}
              </span>
              <span className="text-xs font-mono font-bold text-amber-400/80">AMPS</span>
            </div>
          </div>
        </div>

        {/* Mode Selector Pills */}
        <div className="mb-6">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            AUTOMATION MODE
          </label>
          <div className="neu-inset p-1.5 rounded-2xl grid grid-cols-3 gap-1.5">
            {(['AUTOMATIC', 'MANUAL', 'SCHEDULED'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`py-2 rounded-xl text-xs font-bold font-mono transition-all duration-200 cursor-pointer ${
                  currentMode === m
                    ? 'neu-btn neu-btn-primary font-black shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3D Pushbuttons & Emergency Cutoff */}
      <div className="space-y-4 pt-2">
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            disabled={isStartDisabled}
            onClick={startPump}
            title={
              isTankFullInAuto
                ? `Tank is full (${currentWaterLevel.toFixed(1)}% >= ${autoCutoffThreshold}%). START is disabled in AUTOMATIC mode. Switch to MANUAL to override.`
                : 'Start Pump'
            }
            className={`py-4 rounded-2xl font-bold flex items-center justify-center space-x-2 transition-all ${
              isRunning
                ? 'opacity-40 cursor-not-allowed neu-inset text-slate-500'
                : isTankFullInAuto
                ? 'opacity-60 cursor-not-allowed neu-inset text-amber-400 border border-amber-500/30'
                : 'neu-btn neu-btn-success cursor-pointer'
            }`}
          >
            {isTankFullInAuto ? <Lock className="w-5 h-5 text-amber-400" /> : <Power className="w-5 h-5" />}
            <span className="text-sm font-extrabold tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              {isTankFullInAuto ? 'AUTO CUTOFF' : 'START PUMP'}
            </span>
          </button>

          <button
            type="button"
            disabled={commandPending || !isRunning}
            onClick={stopPump}
            className={`py-4 rounded-2xl font-bold flex items-center justify-center space-x-2 transition-all ${
              !isRunning
                ? 'opacity-40 cursor-not-allowed neu-inset text-slate-500'
                : 'neu-btn neu-btn-danger cursor-pointer'
            }`}
          >
            <Power className="w-5 h-5 rotate-180" />
            <span className="text-sm font-extrabold tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              STOP PUMP
            </span>
          </button>
        </div>

        {/* Informative Auto-Cutoff Banner */}
        {isTankFullInAuto && (
          <div className="p-3 neu-inset rounded-xl border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              High-Level Auto Cutoff Active: Tank ({currentWaterLevel.toFixed(1)}%) &gt;= {autoCutoffThreshold}%. START disabled in AUTOMATIC mode. Switch to MANUAL to override.
            </span>
          </div>
        )}

        {/* Emergency Stop Cutoff */}
        <button
          type="button"
          onClick={() => emergencyStop('Manual Emergency Trip from Control Room Dashboard')}
          className="w-full neu-btn neu-btn-danger py-3.5 text-xs font-black uppercase flex items-center justify-center space-x-2 tracking-widest rounded-2xl cursor-pointer"
        >
          <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
          <span>EMERGENCY CUTOFF (HARDWARE LOCKOUT)</span>
        </button>

        {/* Command Status Annunciator */}
        {commandStatusText && (
          <div className="text-center text-xs font-mono text-cyan-400 neu-inset py-2 px-3 rounded-xl animate-pulse">
            {commandStatusText}
          </div>
        )}
      </div>
    </div>
  );
};

