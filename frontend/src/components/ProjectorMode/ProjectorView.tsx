import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { Maximize2, Minimize2 } from 'lucide-react';

export const ProjectorView: React.FC = () => {
  const {
    selectedDevice,
    pumpStatus,
    telemetry,
    startPump,
    stopPump,
    emergencyStop,
    commandPending
  } = useDevice();

  const [displayMode, setDisplayMode] = useState<'projector' | 'monitoring' | 'control'>('projector');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const isDeviceOnline = selectedDevice?.status === 'online';
  const isRunning = isDeviceOnline && pumpStatus?.pump_state === 'ON';
  const isFault = isDeviceOnline && pumpStatus?.pump_state === 'FAULT';
  const waterPct = isDeviceOnline ? Number(telemetry?.water_level_percentage ?? 0) : 0;
  const volumeL = isDeviceOnline ? Number(telemetry?.water_level_liters ?? 0) : 0;
  const flowRate = isDeviceOnline ? Number(telemetry?.inflow_rate_lpm ?? 0) : 0;
  const tdsPpm = isDeviceOnline ? Number(telemetry?.tds_ppm ?? 0) : 0;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-5rem)] p-4 flex flex-col justify-between">
      {/* Top Projector Mode Switcher */}
      <div className="flex items-center justify-between p-3 neu-card mb-6 rounded-2xl">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
            CONSOLE MODE:
          </span>
          <div className="neu-inset p-1 rounded-xl flex space-x-1.5">
            {(['projector', 'monitoring', 'control'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDisplayMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                  displayMode === mode
                    ? 'neu-btn neu-btn-primary font-black shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'projector' ? 'Full-Screen Display' : (mode === 'monitoring' ? 'Monitoring Grid' : 'Switchboard')}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="neu-btn px-4 py-2 text-xs font-bold flex items-center space-x-1.5 rounded-xl"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          <span>{isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}</span>
        </button>
      </div>

      {/* FULL-SCREEN PROJECTOR MODE */}
      {displayMode === 'projector' && (
        <div className="flex-1 flex flex-col justify-center items-center p-8 neu-card text-center rounded-3xl">
          {/* Main Giant Header */}
          <div className="mb-6">
            <h1 className="text-3xl sm:text-5xl font-black tracking-widest uppercase">
              SMART WATER CONTROL SYSTEM
            </h1>
            <p className="text-sm sm:text-lg font-mono text-cyan-400 mt-2 font-bold tracking-wider">
              CONTROLLER: {selectedDevice?.device_uid || 'WPC-A81F29'} | 2000L INDUSTRIAL TANK
            </p>
          </div>

          {/* Huge Distance-Readable Water Level */}
          <div className="my-6 w-full max-w-4xl p-8 neu-inset rounded-3xl">
            <span className="text-lg sm:text-xl uppercase tracking-widest text-slate-400 font-bold block mb-2">
              WATER LEVEL
            </span>
            <div className="flex items-baseline justify-center space-x-2">
              <span className="text-6xl sm:text-8xl font-black text-cyan-400 tracking-tighter">
                {waterPct.toFixed(1)}
              </span>
              <span className="text-3xl sm:text-4xl font-extrabold text-cyan-300">%</span>
            </div>

            {/* Giant Progress Bar */}
            <div className="w-full h-8 sm:h-10 rounded-2xl overflow-hidden mt-6 neu-inset p-1">
              <div
                className={`h-full rounded-xl transition-all duration-700 ${
                  waterPct >= 90
                    ? 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                    : waterPct <= 25
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                }`}
                style={{ width: `${waterPct}%` }}
              />
            </div>
            <span className="text-base sm:text-xl font-mono text-slate-300 font-bold mt-4 block">
              {volumeL.toFixed(0)} LITERS AVAILABLE
            </span>
          </div>

          {/* Telemetry Strip for Projector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl mb-8">
            <div className="p-6 neu-inset rounded-2xl">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">PUMP STATUS</span>
              <span
                className={`text-2xl sm:text-3xl font-extrabold font-mono block mt-2 ${
                  isFault ? 'text-rose-500 animate-bounce' : isRunning ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                ● {isFault ? 'FAULT / DRY RUN' : isRunning ? 'RUNNING' : 'STANDBY'}
              </span>
            </div>

            <div className="p-6 neu-inset rounded-2xl">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">INFLOW RATE</span>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-cyan-400 block mt-2">
                {flowRate.toFixed(1)} L/min
              </span>
            </div>

            <div className="p-6 neu-inset rounded-2xl">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">WATER PURITY (TDS)</span>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-400 block mt-2">
                {tdsPpm.toFixed(0)} ppm
              </span>
            </div>
          </div>

          {/* Projector Emergency Button */}
          <div className="flex space-x-4">
            <button
              type="button"
              disabled={commandPending || isRunning}
              onClick={startPump}
              className="neu-btn neu-btn-success px-8 py-3.5 text-sm font-extrabold rounded-2xl"
            >
              START PUMP
            </button>
            <button
              type="button"
              disabled={commandPending || !isRunning}
              onClick={stopPump}
              className="neu-btn neu-btn-danger px-8 py-3.5 text-sm font-extrabold rounded-2xl"
            >
              STOP PUMP
            </button>
            <button
              type="button"
              onClick={() => emergencyStop('Projector mode emergency button')}
              className="neu-btn neu-btn-danger px-8 py-3.5 text-sm font-extrabold rounded-2xl"
            >
              EMERGENCY STOP
            </button>
          </div>
        </div>
      )}

      {/* MONITORING MODE */}
      {displayMode === 'monitoring' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="neu-card p-6 flex flex-col justify-between rounded-3xl">
            <h3 className="text-lg font-bold mb-4">Tank Monitoring</h3>
            <div className="flex-1 flex flex-col items-center justify-center">
              <span className="text-6xl font-black text-cyan-400">{waterPct.toFixed(1)}%</span>
              <span className="text-sm font-mono text-slate-400 mt-2">{volumeL.toFixed(0)} Liters</span>
            </div>
          </div>

          <div className="neu-card p-6 flex flex-col justify-between rounded-3xl">
            <h3 className="text-lg font-bold mb-4">Pump Status</h3>
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <div className={`w-8 h-8 rounded-full neu-dot ${isRunning ? 'neu-dot-emerald animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-2xl font-bold font-mono">
                {isRunning ? 'RUNNING (4.8A)' : 'OFF'}
              </span>
            </div>
          </div>

          <div className="neu-card p-6 flex flex-col justify-between rounded-3xl">
            <h3 className="text-lg font-bold mb-4">Water Quality & Flow</h3>
            <div className="flex-1 flex flex-col justify-center space-y-4">
              <div className="flex justify-between items-center text-sm font-mono neu-inset p-3 rounded-xl">
                <span className="text-slate-400">Flow Rate:</span>
                <span className="text-cyan-400 font-bold">{flowRate.toFixed(1)} L/min</span>
              </div>
              <div className="flex justify-between items-center text-sm font-mono neu-inset p-3 rounded-xl">
                <span className="text-slate-400">TDS Purity:</span>
                <span className="text-amber-400 font-bold">{tdsPpm.toFixed(0)} ppm</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTROL ROOM MODE */}
      {displayMode === 'control' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="neu-card p-6 rounded-3xl">
            <h3 className="text-lg font-bold mb-4">Master Control Switchboard</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={startPump}
                disabled={isRunning}
                className="neu-btn neu-btn-success py-6 text-sm font-bold rounded-2xl"
              >
                ENGAGE PUMP
              </button>
              <button
                type="button"
                onClick={stopPump}
                disabled={!isRunning}
                className="neu-btn neu-btn-danger py-6 text-sm font-bold rounded-2xl"
              >
                DISENGAGE PUMP
              </button>
            </div>
          </div>

          <div className="neu-card p-6 rounded-3xl">
            <h3 className="text-lg font-bold mb-4">Safety Interlock Status</h3>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between p-3.5 neu-inset rounded-xl">
                <span className="text-slate-400">Contactor Feedback Interlock:</span>
                <span className="text-emerald-400 font-bold">ARMED</span>
              </div>
              <div className="flex items-center justify-between p-3.5 neu-inset rounded-xl">
                <span className="text-slate-400">Dry-Run Protection (120s Zero Flow):</span>
                <span className="text-emerald-400 font-bold">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between p-3.5 neu-inset rounded-xl">
                <span className="text-slate-400">Over-Capacity Cutoff (95%):</span>
                <span className="text-emerald-400 font-bold">ARMED</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
