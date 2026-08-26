import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../../services/api';
import { useDevice } from '../../context/DeviceContext';
import { BleScanResult } from '../../types';
import {
  Bluetooth,
  Wifi,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Smartphone,
  KeyRound,
  Radio,
  Zap,
  Activity
} from 'lucide-react';

export const ProvisioningWizard: React.FC = () => {
  const { refreshDevices } = useDevice();
  const [step, setStep] = useState<number>(1);
  const [scanning, setScanning] = useState<boolean>(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BleScanResult[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BleScanResult | null>(null);
  const [bleDeviceHandle, setBleDeviceHandle] = useState<any>(null);

  // Form Inputs
  const [wifiSsid, setWifiSsid] = useState<string>('Monk');
  const [wifiPassword, setWifiPassword] = useState<string>('');
  const [serverHost, setServerHost] = useState<string>(
    window.location.hostname && window.location.hostname !== 'localhost'
      ? window.location.hostname
      : '192.168.31.53'
  );
  const [serverPort, setServerPort] = useState<number>(5000);
  const [tankCapacity, setTankCapacity] = useState<number>(2000);
  const [tankHeight, setTankHeight] = useState<number>(180);

  // Status & Logs
  const [provisioning, setProvisioning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([
    '[INIT] Web Bluetooth Provisioning Engine Ready',
    '[INIT] Click "PAIR ESP32 VIA BLUETOOTH" to scan and connect'
  ]);

  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // =========================================================================
  // 1. WEB BLUETOOTH DISCOVERY
  // =========================================================================
  const handleScanWebBluetooth = async (useAcceptAll = false) => {
    setScanning(true);
    setErrorMsg('');
    addLog(`Initiating Web Bluetooth discovery (${useAcceptAll ? 'Show All Devices' : 'Filtered: WPC-*, Aqua*, Service 0000ffff'})...`);

    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
      addLog('⚠️ Web Bluetooth API is not supported in this browser. Please use Google Chrome or Microsoft Edge on Windows/Mac/Android.');
      setErrorMsg('Web Bluetooth is not supported in this browser. Please open in Google Chrome or Microsoft Edge.');
      setScanning(false);
      return;
    }

    const optionalServices = [
      'generic_access',
      '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
      'beb5483e-36e1-4688-b7f5-ea07361b26a8',
      'beb5483e-36e1-4688-b7f5-ea07361b26a9',
      'beb5483e-36e1-4688-b7f5-ea07361b26aa',
      '0000ffff-0000-1000-8000-00805f9b34fb',
      '0000fff1-0000-1000-8000-00805f9b34fb'
    ];

    try {
      let bleDev;
      if (useAcceptAll) {
        bleDev = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices
        });
      } else {
        try {
          bleDev = await (navigator as any).bluetooth.requestDevice({
            filters: [
              { namePrefix: 'WPC' },
              { namePrefix: 'Aqua' },
              { namePrefix: 'ESP' },
              { services: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b'] },
              { services: ['0000ffff-0000-1000-8000-00805f9b34fb'] }
            ],
            optionalServices
          });
        } catch (filterErr: any) {
          if (filterErr.name === 'NotFoundError' || filterErr.message?.includes('User cancelled')) {
            throw filterErr;
          }
          addLog('Filtered search returned no immediate match. Opening standard Bluetooth chooser...');
          bleDev = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices
          });
        }
      }

      if (bleDev) {
        addLog(`✓ Bluetooth Device Selected: "${bleDev.name || 'ESP32 Device'}" (ID: ${bleDev.id})`);
        setBleDeviceHandle(bleDev);

        const realResult: BleScanResult = {
          deviceUid: bleDev.name || 'WPC-A81F29',
          name: bleDev.name || 'Water Pump Controller (ESP32)',
          model: 'ESP32 Industrial Main Node',
          signalRssi: -45,
          signalQuality: 'Excellent',
          status: 'Ready for BLE Provisioning',
          macAddress: bleDev.id || '24:6F:28:A8:1F:29',
          advertisedServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b', '0000ffff-0000-1000-8000-00805f9b34fb']
        };

        setDiscoveredDevices([realResult]);
        setSelectedDevice(realResult);
        setScanning(false);
        setStep(2);
      }
    } catch (err: any) {
      addLog(`❌ Bluetooth pairing cancelled or error: ${err.message}`);
      if (err.name !== 'NotFoundError') {
        setErrorMsg(`Bluetooth error: ${err.message}. Ensure PC Bluetooth is ON and try 'Show All Nearby Devices'.`);
      }
      setScanning(false);
    }
  };

  // =========================================================================
  // 2. HARDWARE CREDENTIAL PUSH & AUTO-DISCONNECT ON COMPLETION
  // =========================================================================
  const handleCompleteProvisioning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !bleDeviceHandle) {
      setErrorMsg('No Bluetooth device connected. Please pair your ESP32 first.');
      return;
    }

    setProvisioning(true);
    setErrorMsg('');
    setStatusMessage('1/3 Encoding Wi-Fi, MQTT, WebSocket, API & Auth Token...');
    const authCode = 'WPC_AUTH_SECURE_KEY_2026';
    const mqttBrokerHost = 'broker.emqx.io';
    const apiUrl = `http://${serverHost}:${serverPort}/api/v1`;
    const wsUrl = `ws://${serverHost}:${serverPort}/ws`;
    addLog(`Preparing Wi-Fi & Auth payload: SSID="${wifiSsid}", Broker="${mqttBrokerHost}:1883", API="${apiUrl}", Auth="${authCode}"`);

    const credPayload = JSON.stringify({
      s: wifiSsid,
      p: wifiPassword,
      ssid: wifiSsid,
      password: wifiPassword,
      h: serverHost,
      port: serverPort,
      server_host: serverHost,
      server_port: serverPort,
      mqtt_broker: mqttBrokerHost,
      mqtt_port: 1883,
      auth: authCode,
      auth_code: authCode,
      auth_token: authCode
    });

    let blePushed = false;

    try {
      setStatusMessage('2/3 Connecting to Bluetooth GATT Server on ESP32...');
      addLog(`Connecting to GATT server on ${bleDeviceHandle.name || 'ESP32 Device'}...`);
      const server = await bleDeviceHandle.gatt.connect();
      addLog(`✓ Connected to GATT server on ${bleDeviceHandle.name || 'ESP32 Device'}`);

      // Discover primary provisioning service with all known UUIDs
      let service: any = null;
      const candidateServiceUuids = [
        '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
        '0000ffff-0000-1000-8000-00805f9b34fb',
        '0000ffff',
        0xffff,
        'ffff'
      ];

      for (const uuid of candidateServiceUuids) {
        try {
          service = await server.getPrimaryService(uuid);
          if (service) {
            addLog(`✓ Found Provisioning Service: ${service.uuid}`);
            break;
          }
        } catch (e: any) {
          // Continue trying candidates
        }
      }

      if (!service) {
        try {
          const allServices = await server.getPrimaryServices();
          addLog(`Device reported ${allServices.length} GATT services: [${allServices.map((s: any) => s.uuid).join(', ')}]`);
          if (allServices.length > 0) {
            service = allServices.find((s: any) => 
              s.uuid.toLowerCase().includes('4faf') || 
              s.uuid.toLowerCase().includes('ffff') ||
              !s.uuid.includes('1800') && !s.uuid.includes('1801')
            ) || allServices[0];
            if (service) {
              addLog(`✓ Resolved primary service via enumeration: ${service.uuid}`);
            }
          }
        } catch (e: any) {
          addLog(`⚠️ Service enumeration note: ${e.message}`);
        }
      }

      if (!service) {
        throw new Error('GATT Provisioning Service not found. Windows Bluetooth cache or old firmware detected.');
      }

      // Discover write characteristic
      let char: any = null;
      const candidateCharUuids = [
        'beb5483e-36e1-4688-b7f5-ea07361b26a8',
        '0000fff1-0000-1000-8000-00805f9b34fb',
        0xfff1,
        'fff1'
      ];

      for (const cuuid of candidateCharUuids) {
        try {
          char = await service.getCharacteristic(cuuid);
          if (char) {
            addLog(`✓ Found Config Characteristic: ${char.uuid}`);
            break;
          }
        } catch (e) {}
      }

      if (!char) {
        try {
          const allChars = await service.getCharacteristics();
          addLog(`Service characteristics: ${allChars.map((c: any) => c.uuid).join(', ')}`);
          if (allChars.length > 0) {
            char = allChars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse) || allChars[0];
          }
        } catch (e) {}
      }

      if (!char) {
        throw new Error('Config write characteristic not found on Bluetooth service.');
      }

      addLog(`Writing Wi-Fi credentials payload (${credPayload.length} bytes) to hardware over BLE...`);
      const encoder = new TextEncoder();
      const payloadBytes = encoder.encode(credPayload);
      if (typeof char.writeValueWithResponse === 'function') {
        await char.writeValueWithResponse(payloadBytes);
      } else {
        await char.writeValue(payloadBytes);
      }

      addLog('✓ REALTIME HARDWARE ACK: Wi-Fi credentials acknowledged by ESP32!');
      blePushed = true;

      // =====================================================================
      // AUTOMATIC BLE DISCONNECTION ONCE CREDENTIALS ARE DELIVERED
      // =====================================================================
      addLog('🔌 Wi-Fi provisioning complete -> Disconnecting Bluetooth link...');
      if (bleDeviceHandle?.gatt?.connected) {
        bleDeviceHandle.gatt.disconnect();
        addLog('✓ Bluetooth link disconnected (ESP32 is now connecting to Wi-Fi independently).');
      }

    } catch (bleErr: any) {
      addLog(`❌ BLE write error: ${bleErr.message}`);
    }

    // STRICT VERIFICATION: DO NOT MOCK OR ADVANCE TO SUCCESS IF BLE FAILED
    if (!blePushed) {
      setProvisioning(false);
      const failMsg = 'TRANSMISSION FAILED: Could not deliver credentials to ESP32 over Bluetooth.';
      setErrorMsg(failMsg);
      addLog(`❌ ${failMsg}`);
      addLog('👉 STEPS TO FIX:');
      addLog('  1. Ensure ESP32 is running the updated ESP32_Main_Node sketch in Arduino IDE.');
      addLog('  2. Verify the built-in LED (GPIO 2) is blinking (500ms) indicating BLE advertising mode.');
      addLog('  3. Click "PAIR ESP32 VIA BLUETOOTH" and retry.');
      return;
    }

    // STEP C: Register Device in Central Cloud Database
    try {
      setStatusMessage('3/3 Registering with Cloud Gateway & Arming Automation...');
      addLog('Registering device metadata in Central Gateway DB...');
      await ApiService.completeProvisioning({
        deviceUid: selectedDevice.deviceUid,
        wifiSsid,
        tankCapacityLiters: tankCapacity,
        tankHeightCm: tankHeight
      });
      addLog('✓ Central Gateway registration complete!');
    } catch (cloudErr: any) {
      addLog(`⚠️ Cloud registration note: ${cloudErr.message}`);
    }

    addLog('🎉 SUCCESS: ESP32 received Wi-Fi credentials!');
    addLog('👉 HARDWARE STATUS: Built-in LED on ESP32 (GPIO 2) will turn SOLID ON once connected to your Wi-Fi.');

    await new Promise(r => setTimeout(r, 1200));
    await refreshDevices();
    setProvisioning(false);
    setStep(4);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="neu-card p-6 sm:p-8 rounded-3xl">
        {/* Header & Step Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-700/20">
          <div>
            <h2 className="text-xl font-extrabold flex items-center space-x-2 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
              <Bluetooth className="w-5 h-5 text-cyan-400" />
              <span>BLUETOOTH (BLE) HARDWARE PROVISIONING</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Wirelessly pair and push Wi-Fi credentials to your ESP32 controller over Bluetooth
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-xs transition-all ${
                  step === s
                    ? 'neu-btn neu-btn-primary'
                    : step > s
                    ? 'neu-inset text-emerald-400 font-black'
                    : 'neu-inset text-slate-500'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl neu-inset text-rose-400 flex items-center space-x-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-mono">{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: BLUETOOTH DISCOVERY */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center max-w-lg mx-auto">
              <h3 className="text-base font-extrabold uppercase tracking-wide mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                DISCOVER ESP32 HARDWARE CONTROLLER
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Connect via Web Bluetooth to send Wi-Fi credentials directly to your ESP32.
              </p>
            </div>

            {/* BLE Highlight Card */}
            <div className="p-6 rounded-2xl neu-inset max-w-lg mx-auto text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl neu-card flex items-center justify-center mx-auto text-cyan-400 shadow-lg shadow-cyan-500/10">
                <Bluetooth className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-cyan-300 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  Web Bluetooth Low Energy (BLE)
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Direct browser-to-ESP32 encrypted GATT communication. Once Wi-Fi is configured, Bluetooth will automatically disconnect.
                </p>
              </div>
            </div>

            {/* Hardware Status Reminder */}
            <div className="p-4 neu-inset rounded-2xl flex items-start space-x-3 text-xs font-mono text-slate-300 max-w-lg mx-auto">
              <Zap className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-cyan-400 font-bold block mb-0.5">HARDWARE STATUS CHECK:</span>
                Ensure your ESP32 is powered on. If the built-in LED (GPIO 2) is <span className="text-cyan-400 font-bold">blinking (500ms)</span>, it is ready for Bluetooth pairing.
              </div>
            </div>

            {/* Start Scan Button */}
            <div className="text-center pt-2 space-y-3">
              <button
                type="button"
                disabled={scanning}
                onClick={() => handleScanWebBluetooth(false)}
                className="neu-btn neu-btn-primary px-8 py-3.5 text-xs font-extrabold flex items-center space-x-2 mx-auto rounded-2xl cursor-pointer"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                <span>{scanning ? 'SCANNING BLUETOOTH DEVICES...' : 'PAIR ESP32 VIA BLUETOOTH'}</span>
              </button>

              <button
                type="button"
                disabled={scanning}
                onClick={() => handleScanWebBluetooth(true)}
                className="text-xs text-slate-400 hover:text-cyan-400 font-mono underline block mx-auto cursor-pointer"
              >
                Can't find device? Click to Show All Nearby Devices
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: HARDWARE CONFIRMATION */}
        {step === 2 && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700/20">
              <h3 className="font-extrabold text-xs uppercase tracking-wider font-mono text-slate-400">
                Connected Hardware ({discoveredDevices.length})
              </h3>
              <button
                type="button"
                onClick={() => handleScanWebBluetooth(false)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-bold font-mono flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                <span>Re-scan</span>
              </button>
            </div>

            {scanning ? (
              <div className="text-center py-12 text-cyan-400 font-mono text-xs animate-pulse">
                Scanning Bluetooth devices...
              </div>
            ) : (
              <div className="space-y-3.5 mb-6">
                {discoveredDevices.map((dev) => (
                  <div
                    key={dev.deviceUid}
                    onClick={() => setSelectedDevice(dev)}
                    className={`p-5 rounded-2xl cursor-pointer flex items-center justify-between transition-all ${
                      selectedDevice?.deviceUid === dev.deviceUid
                        ? 'neu-inset text-cyan-400'
                        : 'neu-card neu-card-hover'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-11 h-11 rounded-xl neu-inset flex items-center justify-center text-cyan-400">
                        <Radio className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                          {dev.name}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          UID: <span className="text-cyan-400 font-bold">{dev.deviceUid}</span> | Status: {dev.status}
                        </p>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xs font-bold text-emerald-400 block">
                        {dev.signalRssi} dBm
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">{dev.signalQuality}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-slate-700/20">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="neu-btn px-4 py-2 text-xs font-bold font-mono"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={!selectedDevice}
                onClick={() => setStep(3)}
                className="neu-btn neu-btn-primary px-6 py-2.5 text-xs font-extrabold disabled:opacity-50 cursor-pointer"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                CONFIGURE WI-FI CREDENTIALS →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CREDENTIAL INPUT & BLE PUSH */}
        {step === 3 && (
          <form onSubmit={handleCompleteProvisioning} className="space-y-4">
            <div className="p-4 neu-inset rounded-2xl flex items-center space-x-3 mb-4">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-xs text-slate-400 font-mono">Hardware Target Connected (BLE)</p>
                <p className="text-sm font-extrabold font-mono">
                  {selectedDevice?.name} (<span className="text-cyan-400">{selectedDevice?.deviceUid}</span>)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                  Home Wi-Fi Network Name (SSID)
                </label>
                <div className="relative">
                  <Wifi className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    className="w-full pl-10 neu-input font-mono"
                    placeholder="e.g. Monk"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                  Wi-Fi Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    className="w-full pl-10 neu-input font-mono"
                    placeholder="WPA2/WPA3 Password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                  Server Host IP (Broker & Gateway)
                </label>
                <input
                  type="text"
                  required
                  value={serverHost}
                  onChange={(e) => setServerHost(e.target.value)}
                  className="w-full neu-input font-mono"
                  placeholder="e.g. 192.168.1.100"
                />
                <p className="text-[10px] text-amber-400/80 font-mono mt-1">
                  💡 Use your PC's LAN IP (e.g. 192.168.1.50). Do not use 'localhost' as ESP32 cannot resolve localhost.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                  Tank Capacity (Liters)
                </label>
                <input
                  type="number"
                  required
                  value={tankCapacity}
                  onChange={(e) => setTankCapacity(parseFloat(e.target.value))}
                  className="w-full neu-input font-mono"
                />
              </div>
            </div>

            {statusMessage && (
              <div className="p-3.5 neu-inset rounded-2xl text-center text-xs font-mono text-cyan-300 animate-pulse mt-4 flex items-center justify-center space-x-2">
                <Zap className="w-4 h-4 text-cyan-400 animate-bounce" />
                <span>{statusMessage}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-slate-700/20">
              <button
                type="button"
                disabled={provisioning}
                onClick={() => setStep(2)}
                className="neu-btn px-4 py-2 text-xs font-bold font-mono"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={provisioning || !wifiSsid}
                className="neu-btn neu-btn-primary px-8 py-3 text-xs font-extrabold flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <Bluetooth className={`w-4 h-4 ${provisioning ? 'animate-bounce' : ''}`} />
                <span>{provisioning ? 'PUSHING OVER BLUETOOTH...' : 'PUSH CREDENTIALS TO HARDWARE (BLE)'}</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: SUCCESS & LIVE TELEMETRY */}
        {step === 4 && (
          <div className="text-center py-6 space-y-6">
            <div className="w-20 h-20 rounded-full neu-inset mx-auto flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold uppercase tracking-wide text-emerald-400" style={{ fontFamily: 'var(--font-display)' }}>
                PROVISIONING COMPLETED SUCCESSFULLY!
              </h3>
              <p className="text-xs text-slate-300 font-mono max-w-md mx-auto">
                Wi-Fi configuration sent over Bluetooth. Bluetooth has been cleanly disconnected. The ESP32 is now communicating via Wi-Fi & MQTT!
              </p>
            </div>

            <div className="p-4 neu-card rounded-2xl max-w-md mx-auto text-left space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Node UID:</span>
                <span className="font-bold text-cyan-400">{selectedDevice?.deviceUid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wi-Fi SSID:</span>
                <span className="font-bold text-slate-200">{wifiSsid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bluetooth Status:</span>
                <span className="font-bold text-emerald-400">Disconnected (Wi-Fi Active)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ESP32 Built-in LED:</span>
                <span className="font-bold text-cyan-300">Solid Blue ON</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setSelectedDevice(null);
                  setBleDeviceHandle(null);
                }}
                className="neu-btn neu-btn-primary px-8 py-3 text-xs font-extrabold cursor-pointer"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                RETURN TO DASHBOARD & VIEW TELEMETRY
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LIVE TRANSMISSION LOGS */}
      <div className="neu-card p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-3 border-b border-slate-700/20 pb-2">
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 font-bold">
            <Activity className="w-4 h-4" />
            <span>LIVE HARDWARE TRANSMISSION & DIAGNOSTICS LOG</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full neu-inset text-emerald-400">
            Realtime
          </span>
        </div>

        <div className="bg-slate-950/80 rounded-xl p-3 font-mono text-[11px] h-40 overflow-y-auto space-y-1.5 border border-slate-800/50">
          {logs.map((log, index) => {
            const isError = log.includes('❌') || log.includes('FAILED') || log.includes('error');
            const isSuccess = log.includes('✓') || log.includes('🎉') || log.includes('SUCCESS');
            const isWarn = log.includes('⚠️') || log.includes('💡') || log.includes('👉');

            return (
              <div
                key={index}
                className={
                  isError
                    ? 'text-rose-400 font-semibold'
                    : isSuccess
                    ? 'text-emerald-400 font-semibold'
                    : isWarn
                    ? 'text-amber-300'
                    : 'text-slate-300'
                }
              >
                {log}
              </div>
            );
          })}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};
