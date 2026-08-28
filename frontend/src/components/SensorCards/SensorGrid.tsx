import React from 'react';
import { useDevice } from '../../context/DeviceContext';
import { Droplet, Waves, Radio, Sparkles, AlertTriangle } from 'lucide-react';

export const SensorGrid: React.FC = () => {
  const { telemetry, isDeviceOnline, isSubnodeOnline } = useDevice();

  const isSubnodeHealthy = isDeviceOnline && isSubnodeOnline;
  const inflowRate = isSubnodeHealthy ? Number(telemetry?.inflow_rate_lpm || 0) : 0;
  const totalLiters = isSubnodeHealthy ? Number(telemetry?.total_inflow_liters || 0) : 0;
  const tdsPpm = isSubnodeHealthy ? Number(telemetry?.tds_ppm || 0) : 0;
  const rssi = isSubnodeHealthy ? Number((telemetry as any)?.rssi || -55) : 0;

  const getTdsPurityText = (ppm: number) => {
    if (!isDeviceOnline) return { label: 'HARDWARE OFFLINE', badge: 'text-slate-400 bg-slate-900/40' };
    if (!isSubnodeOnline) return { label: 'ERROR: SENSOR DISCONNECTED', badge: 'text-rose-400 bg-rose-950/60 font-black border border-rose-500/30' };
    if (ppm < 150) return { label: 'EXCELLENT PURITY', badge: 'text-emerald-400 bg-emerald-950/40' };
    if (ppm < 300) return { label: 'GOOD / POTABLE', badge: 'text-cyan-400 bg-cyan-950/40' };
    if (ppm < 600) return { label: 'FAIR (HARD WATER)', badge: 'text-amber-400 bg-amber-950/40' };
    return { label: 'HIGH TDS / CONTAMINATED', badge: 'text-rose-400 bg-rose-950/40' };
  };

  const purity = getTdsPurityText(tdsPpm);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. INFLOW RATE SENSOR */}
      <div className={`neu-card p-5 flex flex-col justify-between ${!isSubnodeHealthy && isDeviceOnline ? 'border border-rose-500/40' : ''}`}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/20">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-xl neu-inset flex items-center justify-center ${isSubnodeHealthy ? 'text-cyan-400' : 'text-rose-400'}`}>
              <Droplet className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              INLET FLOW RATE
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">YF-S201</span>
        </div>

        <div className="neu-screen p-4 my-3.5 flex flex-col items-center justify-center rounded-2xl">
          {isSubnodeHealthy ? (
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-black text-cyan-400 tracking-wider">{inflowRate.toFixed(1)}</span>
              <span className="text-xs font-mono font-bold text-cyan-400/80">L/min</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-xl font-extrabold text-rose-400 tracking-wider">ERROR: OFFLINE</span>
              <span className="text-[10px] font-mono text-rose-300 font-bold mt-0.5">NO SUBNODE DATA</span>
            </div>
          )}
          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
            {isSubnodeHealthy ? 'Hall-Effect Pulse ISR (100ms)' : 'ESP-NOW LINK LOST'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Status:</span>
          <span className={`font-mono font-bold ${isSubnodeHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isSubnodeHealthy ? 'ACTIVE (15.0 L/m target)' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* 2. ACCUMULATED INFLOW TOTALIZER */}
      <div className={`neu-card p-5 flex flex-col justify-between ${!isSubnodeHealthy && isDeviceOnline ? 'border border-rose-500/40' : ''}`}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/20">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-xl neu-inset flex items-center justify-center ${isSubnodeHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
              <Waves className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              TOTAL INFLOW
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">24H CYCLE</span>
        </div>

        <div className="neu-screen p-4 my-3.5 flex flex-col items-center justify-center rounded-2xl">
          {isSubnodeHealthy ? (
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-black text-emerald-400 tracking-wider">{totalLiters.toLocaleString()}</span>
              <span className="text-xs font-mono font-bold text-emerald-400/80">L</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-xl font-extrabold text-rose-400 tracking-wider">ERROR: NO DATA</span>
              <span className="text-[10px] font-mono text-rose-300 font-bold mt-0.5">SUBNODE DISCONNECTED</span>
            </div>
          )}
          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
            {isSubnodeHealthy ? 'Volumetric Totalizer' : 'ESP-NOW LINK LOST'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Daily Cycle:</span>
          <span className={`font-mono font-bold ${isSubnodeHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isSubnodeHealthy ? 'NORMAL' : 'UNAVAILABLE'}
          </span>
        </div>
      </div>

      {/* 3. TDS WATER PURITY SENSOR */}
      <div className={`neu-card p-5 flex flex-col justify-between ${!isSubnodeHealthy && isDeviceOnline ? 'border border-rose-500/40' : ''}`}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/20">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-xl neu-inset flex items-center justify-center ${isSubnodeHealthy ? 'text-amber-400' : 'text-rose-400'}`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              WATER TDS
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">25°C COMP</span>
        </div>

        <div className="neu-screen p-4 my-3.5 flex flex-col items-center justify-center rounded-2xl">
          {isSubnodeHealthy ? (
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-black text-amber-400 tracking-wider">{tdsPpm.toFixed(0)}</span>
              <span className="text-xs font-mono font-bold text-amber-400/80">ppm</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-xl font-extrabold text-rose-400 tracking-wider">ERROR: OFFLINE</span>
              <span className="text-[10px] font-mono text-rose-300 font-bold mt-0.5">ANALOG PROBE UNREACHABLE</span>
            </div>
          )}
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 mt-1 rounded-md ${purity.badge}`}>
            {purity.label}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Standard:</span>
          <span className="font-mono font-bold">{isSubnodeHealthy ? 'IS 10500' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* 4. ESP-NOW TANK SUB-NODE TELEMETRY LINK */}
      <div className={`neu-card p-5 flex flex-col justify-between ${!isSubnodeHealthy && isDeviceOnline ? 'border border-rose-500/60 bg-rose-950/20 animate-pulse' : ''}`}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/20">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-xl neu-inset flex items-center justify-center ${isSubnodeHealthy ? 'text-cyan-400' : 'text-rose-400'}`}>
              <Radio className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              TANK SUB-NODE
            </span>
          </div>
          <span className={`w-2 h-2 rounded-full neu-dot ${isSubnodeHealthy ? 'neu-dot-emerald' : 'neu-dot-rose'}`} />
        </div>

        <div className="neu-screen p-4 my-3.5 flex flex-col items-center justify-center rounded-2xl">
          {isSubnodeHealthy ? (
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-black text-cyan-400 tracking-wider">{rssi}</span>
              <span className="text-xs font-mono font-bold text-cyan-400/80">dBm</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-base font-black text-rose-400 tracking-wider flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4 text-rose-400 mr-1" />
                <span>LINK LOST</span>
              </span>
              <span className="text-[10px] font-mono text-rose-300 font-bold mt-0.5">ESP-NOW NO SIGNAL</span>
            </div>
          )}
          <span className={`text-[10px] font-mono mt-0.5 ${isSubnodeHealthy ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
            {isSubnodeHealthy ? 'ESP-NOW DIRECT (100ms)' : 'SUB-NODE DISCONNECTED'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Node ID:</span>
          <span className="font-mono font-bold">TNK-SUB-8266-01</span>
        </div>
      </div>
    </div>
  );
};
