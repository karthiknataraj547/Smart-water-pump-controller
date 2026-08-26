import React, { useState, useEffect } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { Network, Server, CheckCircle2, AlertCircle, RefreshCw, X, Radio, ArrowRight } from 'lucide-react';
import { setCustomGatewayUrl } from '../../services/api';

interface GatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GatewayModal: React.FC<GatewayModalProps> = ({ isOpen, onClose }) => {
  const { wsConnected, isDeviceOnline, refreshDevices, reconnectWs } = useDevice();
  const [gatewayInput, setGatewayInput] = useState<string>(() => localStorage.getItem('pump_custom_gateway') || '');
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setGatewayInput(localStorage.getItem('pump_custom_gateway') || '');
    setTestResult(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async (targetUrl: string) => {
    const cleanUrl = targetUrl.trim().replace(/\/$/, '');
    if (!cleanUrl) {
      setTestResult({ success: true, message: 'Default auto-detection will be used.' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const pingUrl = `${cleanUrl}/api/v1/devices`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(pingUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        setTestResult({
          success: true,
          message: `✓ Gateway REACHABLE! Found ${json.data?.length || 1} hardware device(s).`
        });
      } else {
        setTestResult({
          success: false,
          message: `Gateway responded with HTTP status ${res.status}.`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Cannot reach Gateway at ${cleanUrl}. Check IP & ensure backend is running.`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndApply = async () => {
    const cleanUrl = gatewayInput.trim().replace(/\/$/, '');
    setCustomGatewayUrl(cleanUrl || null);
    await reconnectWs();
    await refreshDevices();
    onClose();
  };

  const setPreset = (url: string) => {
    setGatewayInput(url);
    handleTestConnection(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="neu-card p-8 max-w-lg w-full rounded-3xl relative" style={{ backgroundColor: 'var(--neu-surface)' }}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 neu-circle-btn w-8 h-8 text-slate-400 hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl neu-inset text-cyan-400 flex items-center justify-center mx-auto mb-3">
            <Network className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
            <span>LIVE GATEWAY EXTENSION POINTER</span>
          </div>
          <h3 className="text-xl font-bold uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            Hardware Gateway Connection
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Point your cloud/Vercel dashboard directly to your local ESP32 hardware server.
          </p>
        </div>

        {/* Live Status Rack */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-xs font-mono">
          <div className="neu-screen p-3 rounded-2xl flex flex-col items-center">
            <span className="text-[10px] text-slate-400 uppercase">CLOUD HUB LINK</span>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full neu-dot ${wsConnected ? 'neu-dot-emerald animate-pulse' : 'neu-dot-rose'}`} />
              <span className={`font-bold ${wsConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                {wsConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </div>

          <div className="neu-screen p-3 rounded-2xl flex flex-col items-center">
            <span className="text-[10px] text-slate-400 uppercase">ESP32 HARDWARE</span>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full neu-dot ${isDeviceOnline ? 'neu-dot-emerald animate-pulse' : 'neu-dot-rose'}`} />
              <span className={`font-bold ${isDeviceOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isDeviceOnline ? 'ONLINE (LIVE)' : 'OFFLINE (0%)'}
              </span>
            </div>
          </div>
        </div>

        {/* Gateway URL Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">
              Gateway Target URL (IP:Port / Host)
            </label>
            <div className="relative">
              <Server className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="http://192.168.31.54:5000"
                value={gatewayInput}
                onChange={(e) => {
                  setGatewayInput(e.target.value);
                  setTestResult(null);
                }}
                className="w-full pl-10 pr-24 neu-input font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => handleTestConnection(gatewayInput)}
                disabled={testing}
                className="absolute right-2 top-2 px-3 py-1.5 text-[10px] font-bold font-mono neu-btn rounded-xl text-cyan-400 hover:text-cyan-300"
              >
                {testing ? 'PINGING...' : 'TEST'}
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <span className="block text-[10px] uppercase font-mono text-slate-400 mb-1.5 font-bold">
              Quick Connect Presets:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => setPreset('http://192.168.31.54:5000')}
                className="neu-btn px-3 py-2 text-left text-[11px] rounded-xl text-cyan-400 hover:text-cyan-300 flex items-center justify-between"
              >
                <span>Home Wi-Fi LAN</span>
                <span className="text-[9px] text-slate-400">192.168.31.54</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('http://localhost:5000')}
                className="neu-btn px-3 py-2 text-left text-[11px] rounded-xl text-amber-400 hover:text-amber-300 flex items-center justify-between"
              >
                <span>Localhost Host</span>
                <span className="text-[9px] text-slate-400">127.0.0.1:5000</span>
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`p-3 rounded-2xl neu-inset text-xs font-mono flex items-center space-x-2 ${
              testResult.success ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="pt-2 flex items-center space-x-3">
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="flex-1 neu-btn neu-btn-primary py-3 text-xs font-extrabold flex items-center justify-center space-x-2 rounded-2xl cursor-pointer"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Radio className="w-4 h-4" />
              <span>SAVE & CONNECT TO GATEWAY</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
