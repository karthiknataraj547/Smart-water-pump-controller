import React, { useEffect, useRef } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { BarChart3, TrendingUp, Calendar, Zap, Droplet } from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { telemetry } = useDevice();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    const height = (canvas.height = 240);

    ctx.clearRect(0, 0, width, height);

    // Draw grid lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let y = 30; y < height - 30; y += 40) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }

    // Generate sample 24-hour time series points
    const points: { x: number; y: number }[] = [];
    const numPoints = 24;
    const stepX = (width - 60) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const x = 40 + i * stepX;
      const baseLevel = 50 + Math.sin(i * 0.8) * 30 + Math.cos(i * 0.3) * 15;
      const clamped = Math.min(95, Math.max(20, baseLevel));
      const y = (height - 40) - (clamped / 100) * (height - 70);
      points.push({ x, y });
    }

    // Fill area under curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, height - 30);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, height - 30);
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, 0, 0, height);
    areaGrad.addColorStop(0, 'rgba(0, 229, 255, 0.35)');
    areaGrad.addColorStop(1, 'rgba(0, 229, 255, 0.0)');
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Draw Smooth Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Draw Point Dots
    points.forEach((p, idx) => {
      if (idx % 4 === 0 || idx === points.length - 1) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#00e5ff';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Time labels on X Axis
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';
    for (let i = 0; i < numPoints; i += 4) {
      const hour = (i * 1).toString().padStart(2, '0') + ':00';
      ctx.fillText(hour, 40 + i * stepX, height - 10);
    }
  }, [telemetry]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold flex items-center space-x-2 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          <span>HISTORICAL ANALYTICS & DUTY METRICS</span>
        </h2>
        <p className="text-xs text-slate-400 font-mono mt-1">
          24-hour telemetric historical profiling, duty cycles, and water consumption trends.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="neu-card p-5 rounded-3xl">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            <Droplet className="w-4 h-4 text-cyan-400" />
            <span>24H WATER INFLOW</span>
          </div>
          <div className="neu-screen p-3.5 my-3 flex items-center justify-between rounded-2xl">
            <span className="text-3xl font-black text-cyan-400 tracking-wider">4,820 L</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center space-x-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>+12%</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Vs Previous 24h cycle</span>
        </div>

        <div className="neu-card p-5 rounded-3xl">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            <Zap className="w-4 h-4 text-amber-400" />
            <span>PUMP DUTY CYCLES</span>
          </div>
          <div className="neu-screen p-3.5 my-3 flex items-center justify-between rounded-2xl">
            <span className="text-3xl font-black text-amber-400 tracking-wider">6 CYCLES</span>
            <span className="text-[10px] font-mono text-slate-400 font-bold">144 MINS</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Avg cycle: 24 mins</span>
        </div>

        <div className="neu-card p-5 rounded-3xl">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>ESTIMATED DAILY USAGE</span>
          </div>
          <div className="neu-screen p-3.5 my-3 flex items-center justify-between rounded-2xl">
            <span className="text-3xl font-black text-emerald-400 tracking-wider">3,950 L</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">98.4%</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Storage efficiency: 98.4%</span>
        </div>
      </div>

      {/* 24-Hour Trend Chart Canvas */}
      <div className="neu-card p-6 rounded-3xl">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700/20">
          <h3 className="text-xs font-extrabold tracking-wider uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            WATER LEVEL (%) — 24-HOUR TIME-SERIES PROFILE
          </h3>
          <span className="text-xs font-mono font-bold text-cyan-400 neu-inset px-3 py-1 rounded-xl">
            CURRENT: {Number(telemetry?.water_level_percentage ?? 0).toFixed(1)}%
          </span>
        </div>
        <div className="relative w-full neu-inset rounded-2xl p-3">
          <canvas ref={canvasRef} className="w-full block" />
        </div>
      </div>
    </div>
  );
};
