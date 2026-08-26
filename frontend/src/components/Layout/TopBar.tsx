import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, Cpu, User, LogOut, Bell, Shield, Lock, Network } from 'lucide-react';
import { GatewayModal } from '../Gateway/GatewayModal';

interface TopBarProps {
  onOpenAuth: () => void;
  onOpenAlerts: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenAuth, onOpenAlerts }) => {
  const { devices, selectedDevice, setSelectedDevice, wsConnected, isDeviceOnline, alerts } = useDevice();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showGatewayModal, setShowGatewayModal] = useState<boolean>(false);

  const unackAlerts = alerts.filter(a => !a.acknowledged).length;

  return (
    <>
      <header 
        className="h-16 px-6 flex items-center justify-between sticky top-0 z-40 border-b border-slate-700/20"
        style={{ backgroundColor: 'var(--neu-surface)', boxShadow: '0 4px 15px var(--neu-shadow-dark)' }}
      >
        {/* Device Selector Rack Display */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>

          <div className="neu-inset px-3 py-1.5 rounded-xl">
            <select
              value={selectedDevice?.id || ''}
              onChange={(e) => {
                const target = devices.find(d => d.id === e.target.value);
                if (target) setSelectedDevice(target);
              }}
              className="bg-transparent text-xs font-bold font-mono outline-none cursor-pointer"
              style={{ color: 'inherit' }}
            >
              {devices.map((dev) => (
                <option key={dev.id} value={dev.id} className="bg-slate-900 text-slate-100">
                  {dev.device_uid} — {dev.device_type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Instrumentation Badges & Controls */}
        <div className="flex items-center space-x-3">
          {/* Dedicated Physical Hardware Connection Badge */}
          <div className={`flex items-center space-x-2 neu-inset px-3.5 py-2 rounded-xl transition-all ${
            isDeviceOnline ? 'border border-emerald-500/30' : 'border border-rose-500/40 bg-rose-950/20'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full neu-dot ${
              isDeviceOnline ? 'neu-dot-emerald animate-pulse' : 'neu-dot-rose'
            }`} />
            <span className={`text-[11px] font-mono font-bold tracking-wider ${
              isDeviceOnline ? 'text-emerald-400' : 'text-rose-400 font-extrabold'
            }`}>
              {isDeviceOnline ? 'HARDWARE ONLINE' : 'HARDWARE OFFLINE'}
            </span>
          </div>

          {/* Gateway Extension Pointer Trigger */}
          <button
            type="button"
            onClick={() => setShowGatewayModal(true)}
            title="Configure Gateway Connection (IP / Cloud Server)"
            className={`hidden sm:flex items-center space-x-1.5 neu-inset px-3 py-2 rounded-xl cursor-pointer hover:border-cyan-500/40 ${
              wsConnected ? 'text-cyan-400' : 'text-slate-400'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono font-bold">
              {wsConnected ? 'GATEWAY LINKED' : 'SET GATEWAY'}
            </span>
          </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          title="Toggle Light / Dark Mode"
          className="neu-circle-btn w-10 h-10 text-slate-400 hover:text-cyan-400 cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
        </button>

        {/* Alarm Feed Button with Jewel Count Badge */}
        <button
          type="button"
          onClick={onOpenAlerts}
          className="neu-circle-btn w-10 h-10 relative text-slate-400 hover:text-cyan-400 cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          {unackAlerts > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center animate-bounce">
              {unackAlerts}
            </span>
          )}
        </button>

        {/* Operator Profile / Authentication Trigger */}
        {user ? (
          <div className="flex items-center space-x-3 pl-2 border-l border-slate-700/30">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold block">{user.name}</span>
              <span className="text-[10px] font-mono font-bold uppercase text-cyan-400">
                {user.role}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Logout"
              className="neu-circle-btn w-10 h-10 text-slate-400 hover:text-rose-400 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="neu-btn neu-btn-primary px-4 py-2 text-xs font-extrabold flex items-center space-x-1.5 cursor-pointer"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <User className="w-3.5 h-3.5 text-white" />
            <span>OPERATOR SIGN IN</span>
          </button>
        )}
      </div>
    </header>

    <GatewayModal
      isOpen={showGatewayModal}
      onClose={() => setShowGatewayModal(false)}
    />
  </>
  );
};

