import React from 'react';
import { useDevice } from '../../context/DeviceContext';
import { Droplet, Waves, Radio, Sparkles } from 'lucide-react';

export const SensorGrid: React.FC = () => {
  const { telemetry, selectedDevice } = useDevice();

  const isDeviceOnline = selectedDevice?.status === 'online';
  const inflowRate = isDeviceOnline ? (telemetry?.inflow_rate_lpm || 0) : 0;
  const totalLiters = isDeviceOnline ? (telemetry?.total_inflow_liters || 0) : 0;
  const tdsPpm = isDeviceOnline ? (telemetry?.tds_ppm || 0) : 0;
  const rssi = isDeviceOnline ? ((telemetry as any)?.rssi || -55) : 0;

  const getTdsPurityText = (ppm: number) => {
    if (!isDeviceOnline) return { label: 'HARDWARE OFFLINE', badge: 'text-slate-400 bg-slate-900/40' };
    if (ppm < 150) return { label: 'EXCELLENT PURITY', badge: 'text-emerald-400 bg-emerald-950/40' };
    if (ppm < 300) return { label: 'GOOD / POTABLE', badge: 'text-cyan-400 bg-cyan-950/40' };
    if (ppm < 600) return { label: 'FAIR (HARD WATER)', badge: 'text-amber-400 bg-amber-950/40' };
    return { label: 'HIGH TDS / CONTAMINATED', badge: 'text-rose-400 bg-rose-950/40' };
  };

  const purity = getTdsPurityText(tdsPpm);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. INFLOW RATE SENSOR */}
      <div className="neu-card p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/20">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl neu-inset flex items-center justify-center text-cyan-400">
              <Droplet className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              INLET FLOW RATE
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">YF-S201</span>
        </div>

        <div className="neu-screen p-4 my-3.5 flex flex-col items-center justify-center rounded-2xl">
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-black text-cyan-400 tracking-wider">{inflowRate.toFixed(1)}</span>
            <span className="text-xs font-mono font-bold text-cyan-400/80">L/min</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5">Hall-Effect Pulse ISR</span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Target Rate:</span>
          <span className="font-mono font-bold">15.0 L/min</span>
        </div>
      </div>

      {/* 2. ACCUMULATED INFLOW TOTALIZER */}
      <div className="neu-card p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/20">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl neu-inset flex items-center justify-center text-emerald-400">
              <Waves className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              TOTAL INFLOW
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">24H CYCLE</span>
        </div>

        <div className="neu-screen p-4 my-3.5 flex flex-col items-center justify-center rounded-2xl">
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-black text-emerald-400 tracking-wider">{totalLiters.toLocaleString()}</span>
            <span className="text-xs font-mono font-bold text-emerald-400/80">L</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5">Volumetric Counter</span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Daily Cycle:</span>
          <span className="text-emerald-400 font-mono font-bold">NORMAL</span>
        </div>
      </div>

      {/* 3. TDS WATER PURITY SENSOR */}
      <div className="neu-card p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/20">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl neu-inset flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              WATER TDS
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">25°C COMP</span>
        </div>

        <div className="neu-screen p-4 my-3.5 flex flex-col items-center justify-center rounded-2xl">
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-black text-amber-400 tracking-wider">{tdsPpm.toFixed(0)}</span>
            <span className="text-xs font-mono font-bold text-amber-400/80">ppm</span>
          </div>
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 mt-1 rounded-md ${purity.badge}`}>
            {purity.label}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Standard:</span>
          <span className="font-mono font-bold">IS 10500</span>
        </div>
      </div>

      {/* 4. ESP-NOW TANK SUB-NODE TELEMETRY LINK */}
      <div className="neu-card p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/20">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl neu-inset flex items-center justify-center text-cyan-400">
              <Radio className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              TANK SUB-NODE
            </span>
          </div>
          <span className="w-2 h-2 rounded-full neu-dot neu-dot-emerald" />
        </div>

        <div className="neu-screen p-4 my-3.5 flex flex-col items-center justify-center rounded-2xl">
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-black text-cyan-400 tracking-wider">{rssi}</span>
            <span className="text-xs font-mono font-bold text-cyan-400/80">dBm</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono mt-0.5">ESP-NOW DIRECT (2.0s)</span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Node ID:</span>
          <span className="font-mono font-bold">TNK-SUB-8266-01</span>
        </div>
      </div>
    </div>
  );
};
