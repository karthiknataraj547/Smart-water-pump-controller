import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { AlertCircle, AlertTriangle, Info, Check, BellRing, Volume2 } from 'lucide-react';

export const AlertsView: React.FC = () => {
  const { alerts, acknowledgeAlert } = useDevice();
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const filtered = alerts.filter(a => {
    if (filterSeverity === 'all') return true;
    return a.severity === filterSeverity;
  });

  const unackCount = alerts.filter(a => !a.acknowledged).length;

  const playTestChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn('AudioContext not supported');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-extrabold flex items-center space-x-2 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
              <BellRing className="w-5 h-5 text-cyan-400" />
              <span>ALARM & EVENT FEED</span>
            </h2>
            {unackCount > 0 && (
              <span className="text-[11px] font-black font-mono px-3 py-1 rounded-full bg-rose-500 text-white animate-pulse shadow-md shadow-rose-900/40">
                {unackCount} UNACKNOWLEDGED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time critical safety notifications, threshold alerts, and hardware fault logs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={playTestChime}
            className="neu-btn px-4 py-2 text-xs font-bold flex items-center space-x-1.5 rounded-2xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <span>TEST AUDIO</span>
          </button>

          <div className="neu-inset p-1 rounded-2xl flex space-x-1">
            {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setFilterSeverity(sev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono uppercase transition-all duration-200 cursor-pointer ${
                  filterSeverity === sev
                    ? 'neu-btn neu-btn-primary font-black shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3.5">
        {filtered.length === 0 ? (
          <div className="p-8 neu-card text-center text-slate-400 text-sm font-mono rounded-3xl">
            No active alarms found matching this filter.
          </div>
        ) : (
          filtered.map((alert) => {
            const isCrit = alert.severity === 'critical';
            const isWarn = alert.severity === 'warning';

            return (
              <div
                key={alert.id}
                className={`p-5 neu-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all rounded-3xl ${
                  !alert.acknowledged ? 'neu-card-hover' : 'opacity-65'
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div
                    className={`w-11 h-11 rounded-2xl neu-inset shrink-0 flex items-center justify-center ${
                      isCrit
                        ? 'text-rose-400'
                        : isWarn
                        ? 'text-amber-400'
                        : 'text-cyan-400'
                    }`}
                  >
                    {isCrit ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : isWarn ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <Info className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2.5">
                      <span className="font-extrabold text-sm tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                        {alert.title}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          isCrit
                            ? 'text-rose-400 neu-inset'
                            : isWarn
                            ? 'text-amber-400 neu-inset'
                            : 'text-cyan-400 neu-inset'
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{alert.message}</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-1.5 block">
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  {!alert.acknowledged ? (
                    <button
                      type="button"
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="neu-btn neu-btn-primary px-5 py-2.5 text-xs font-bold flex items-center space-x-1.5 rounded-2xl"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      <Check className="w-4 h-4" />
                      <span>ACKNOWLEDGE</span>
                    </button>
                  ) : (
                    <span className="text-xs font-mono text-emerald-400 flex items-center space-x-1 neu-inset px-3 py-1.5 rounded-xl">
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledged</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
