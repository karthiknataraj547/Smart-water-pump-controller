import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface TankCanvasProps {
  levelPercentage: number;
  volumeLiters: number;
  maxCapacityLiters?: number;
  inflowRateLpm?: number;
  isPumpRunning?: boolean;
  isSubnodeOnline?: boolean;
  isDeviceOnline?: boolean;
}

export const TankCanvas: React.FC<TankCanvasProps> = ({
  levelPercentage,
  volumeLiters,
  maxCapacityLiters = 2000,
  inflowRateLpm = 0,
  isPumpRunning = false,
  isSubnodeOnline = true,
  isDeviceOnline = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 320);
    let height = (canvas.height = 360);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = 360;
      }
    };
    window.addEventListener('resize', handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Tank outline & glass chamber
      const margin = 18;
      const tankWidth = width - margin * 2;
      const tankHeight = height - margin * 2;
      const radius = 24;

      // Draw Glass Chamber Background
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(margin, margin, tankWidth, tankHeight, radius);
      ctx.fillStyle = '#0a0e17';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.stroke();
      ctx.clip(); // Clip water within rounded tank

      // Calculate water surface position
      const clampedPct = Math.min(100, Math.max(0, levelPercentage));
      const targetWaterHeight = (clampedPct / 100) * tankHeight;
      const waterTopY = margin + tankHeight - targetWaterHeight;

      // Animated Water Waves
      phaseRef.current += isPumpRunning ? 0.05 : 0.02;
      const waveAmplitude = isPumpRunning ? 6 : 3;
      const waveFrequency = 0.025;

      // Draw Water Body
      ctx.beginPath();
      ctx.moveTo(margin, height - margin);
      ctx.lineTo(margin, waterTopY);

      for (let x = margin; x <= margin + tankWidth; x++) {
        const y = waterTopY + Math.sin(x * waveFrequency + phaseRef.current) * waveAmplitude
                           + Math.cos(x * 0.015 - phaseRef.current * 0.5) * (waveAmplitude * 0.5);
        ctx.lineTo(x, y);
      }

      ctx.lineTo(margin + tankWidth, height - margin);
      ctx.closePath();

      // Water Gradient
      const waterGrad = ctx.createLinearGradient(0, waterTopY, 0, height - margin);
      if (clampedPct > 85) {
        waterGrad.addColorStop(0, '#00e5ff');
        waterGrad.addColorStop(0.5, '#0077b6');
        waterGrad.addColorStop(1, '#023e8a');
      } else if (clampedPct < 25) {
        waterGrad.addColorStop(0, '#f59e0b');
        waterGrad.addColorStop(1, '#b45309');
      } else {
        waterGrad.addColorStop(0, '#00b4d8');
        waterGrad.addColorStop(0.5, '#0077b6');
        waterGrad.addColorStop(1, '#03045e');
      }
      ctx.fillStyle = waterGrad;
      ctx.fill();

      // Surface Foam line
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.stroke();

      // Draw Internal Rising Bubbles when pump is running
      if (isPumpRunning) {
        const now = Date.now() / 1000;
        for (let i = 0; i < 14; i++) {
          const bx = margin + ((i * 37) % tankWidth);
          const speed = 40 + (i % 5) * 15;
          const by = (height - margin) - ((now * speed + i * 40) % targetWaterHeight);
          const bradius = 2 + (i % 3);

          if (by > waterTopY) {
            ctx.beginPath();
            ctx.arc(bx, by, bradius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.fill();
          }
        }
      }

      // Acrylic Glass Glare / Gloss highlight
      const glossGrad = ctx.createLinearGradient(margin, margin, margin + tankWidth * 0.4, margin + tankHeight);
      glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
      glossGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
      glossGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glossGrad;
      ctx.fillRect(margin, margin, tankWidth * 0.4, tankHeight);

      ctx.restore();

      // Draw Calibrated Level Markers on Right Edge
      const markers = [100, 75, 50, 25, 0];
      ctx.save();
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'right';

      markers.forEach(m => {
        const markerY = margin + tankHeight - (m / 100) * tankHeight;
        ctx.beginPath();
        ctx.moveTo(margin + tankWidth - 12, markerY);
        ctx.lineTo(margin + tankWidth, markerY);
        ctx.strokeStyle = (m === 25 || m === 75) ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillText(`${m}%`, margin + tankWidth - 16, markerY + 3);
      });
      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [levelPercentage, isPumpRunning]);

  return (
    <div className="relative w-full flex flex-col items-center">
      <div className="relative w-full overflow-hidden neu-inset rounded-3xl p-2.5">
        <canvas ref={canvasRef} className="w-full block" />
        
        {/* Floating Digital Overlay Badge */}
        <div className="absolute top-6 left-6 neu-screen px-4 py-3 flex flex-col items-start rounded-2xl">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            CHAMBER WATER LEVEL
          </span>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-black text-cyan-400 tracking-wider">
              {isSubnodeOnline && isDeviceOnline ? levelPercentage.toFixed(1) : '---'}
            </span>
            <span className="text-sm font-bold text-cyan-300 font-mono">%</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono mt-0.5 font-bold">
            {isSubnodeOnline && isDeviceOnline ? `${volumeLiters.toFixed(0)} / ${maxCapacityLiters} Liters` : 'DATA UNAVAILABLE'}
          </span>
        </div>

        {/* Dynamic Status Pill at Top Right */}
        <div className="absolute top-6 right-6 flex items-center space-x-2 neu-inset px-4 py-2 rounded-2xl">
          <span className={`w-2.5 h-2.5 rounded-full neu-dot ${!isSubnodeOnline || !isDeviceOnline ? 'neu-dot-rose' : (isPumpRunning ? 'neu-dot-emerald animate-pulse' : 'neu-dot-cyan')}`} />
          <span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
            {!isDeviceOnline ? 'OFFLINE' : !isSubnodeOnline ? 'SENSOR ERROR' : (levelPercentage >= 95 ? 'TANK FULL' : (levelPercentage <= 25 ? 'LOW WATER' : 'OPTIMAL'))}
          </span>
          {isSubnodeOnline && isDeviceOnline && inflowRateLpm > 0 && (
            <span className="text-[11px] text-emerald-400 font-mono font-bold ml-1">
              +{inflowRateLpm.toFixed(1)} L/m
            </span>
          )}
        </div>

        {/* Sub-Node Offline Warning Overlay */}
        {isDeviceOnline && !isSubnodeOnline && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center z-10 rounded-3xl animate-pulse">
            <div className="w-12 h-12 rounded-2xl neu-inset flex items-center justify-center text-rose-400 mb-2 border border-rose-500/30">
              <AlertTriangle className="w-6 h-6 text-rose-400 animate-bounce" />
            </div>
            <span className="text-sm font-black text-rose-400 uppercase tracking-wider font-mono">
              TANK SENSOR OFFLINE (NO DATA)
            </span>
            <p className="text-xs text-rose-200/90 font-mono mt-1 max-w-xs">
              ESP-NOW link to Tank Sub-Node (ESP8266) is lost. Ultrasonic level & volume readings unavailable.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
