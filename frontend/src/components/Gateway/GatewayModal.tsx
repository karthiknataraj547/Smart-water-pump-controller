import React, { useState, useEffect } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { Network, Server, CheckCircle2, AlertCircle, Radio, X, Cpu } from 'lucide-react';
import { setCustomGatewayUrl, getCustomGatewayUrl } from '../../services/api';

interface GatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GatewayModal: React.FC<GatewayModalProps> = ({ isOpen, onClose }) => {
  const { wsConnected, mqttConnected, isDeviceOnline, refreshDevices, reconnectWs } = useDevice();
  const [gatewayInput, setGatewayInput] = useState<string>(() => getCustomGatewayUrl());
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setGatewayInput(getCustomGatewayUrl());
    setTestResult(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async (targetUrl: string) => {
    const cleanUrl = targetUrl.trim().replace(/\/$/, '');
    if (!cleanUrl) {
      setTestResult({ success: true, message: 'Default cloud MQTT broker (broker.emqx.io) is active.' });
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
    localStorage.setItem('pump_custom_gateway', cleanUrl || '');
    await reconnectWs();
    await refreshDevices();
    onClose();
  };

  const setPreset = (url: string) => {
    setGatewayInput(url);
    handleTestConnection(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="neu-card p-6 sm:p-8 max-w-lg w-full my-auto max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl relative" style={{ backgroundColor: 'var(--neu-surface)' }}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 neu-circle-btn w-8 h-8 text-slate-400 hover:text-slate-200 cursor-pointer flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl neu-inset text-cyan-400 flex items-center justify-center mx-auto mb-3">
            <Network className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
            <span>MULTI-CHANNEL MQTT & GATEWAY ROUTER</span>
          </div>
          <h3 className="text-xl font-bold uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            Hardware & Cloud Connection
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Connects to your ESP32 hardware via universal Cloud MQTT (<span className="text-cyan-400 font-mono">broker.emqx.io:1883</span>) or Local LAN Gateway.
          </p>
        </div>

        {/* Live Status Rack */}
        <div className="grid grid-cols-3 gap-2 mb-5 text-xs font-mono">
          <div className="neu-screen p-2.5 rounded-2xl flex flex-col items-center text-center">
            <span className="text-[9px] text-slate-400 uppercase">CLOUD MQTT</span>
            <div className="flex items-center space-x-1 mt-1">
              <span className={`w-2 h-2 rounded-full neu-dot ${mqttConnected ? 'neu-dot-emerald animate-pulse' : 'neu-dot-rose'}`} />
              <span className={`font-bold text-[10px] ${mqttConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                {mqttConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </div>

          <div className="neu-screen p-2.5 rounded-2xl flex flex-col items-center text-center">
            <span className="text-[9px] text-slate-400 uppercase">GATEWAY WS</span>
            <div className="flex items-center space-x-1 mt-1">
              <span className={`w-2 h-2 rounded-full neu-dot ${wsConnected ? 'neu-dot-emerald animate-pulse' : 'neu-dot-slate'}`} />
              <span className={`font-bold text-[10px] ${wsConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
                {wsConnected ? 'LOCAL LINK' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="neu-screen p-2.5 rounded-2xl flex flex-col items-center text-center">
            <span className="text-[9px] text-slate-400 uppercase">ESP32 NODE</span>
            <div className="flex items-center space-x-1 mt-1">
              <span className={`w-2 h-2 rounded-full neu-dot ${isDeviceOnline ? 'neu-dot-emerald animate-pulse' : 'neu-dot-rose'}`} />
              <span className={`font-bold text-[10px] ${isDeviceOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isDeviceOnline ? 'LIVE ONLINE' : 'WAITING LINK'}
              </span>
            </div>
          </div>
        </div>

        {/* Gateway URL Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">
              Custom LAN Gateway URL (Optional)
            </label>
            <div className="relative">
              <Server className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="http://192.168.31.53:5000"
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
              Quick Presets:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => setPreset('http://192.168.31.53:5000')}
                className="neu-btn px-3 py-2 text-left text-[11px] rounded-xl text-cyan-400 hover:text-cyan-300 flex items-center justify-between"
              >
                <span>Local LAN IP</span>
                <span className="text-[9px] text-slate-400">192.168.31.53</span>
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

          {/* Hardware Connection Guide Alert */}
          <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-mono space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-cyan-400">
              <Cpu className="w-4 h-4" />
              <span>HOW TO CONNECT HARDWARE TO WI-FI:</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              1. On your phone/PC, connect to Wi-Fi hotspot <strong className="text-cyan-300">"AquaControl-Setup"</strong> (Password: <strong className="text-cyan-300">setup1234</strong>).<br/>
              2. Open <strong className="text-cyan-300">http://192.168.4.1</strong> in your browser.<br/>
              3. Select your home Wi-Fi and click <strong className="text-cyan-300">Save & Connect</strong>.<br/>
              4. The hardware connects to <strong className="text-cyan-300">broker.emqx.io</strong> and links live with this dashboard!
            </p>
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
              <span>SAVE & APPLY CONFIGURATION</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
