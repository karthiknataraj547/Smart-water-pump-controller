import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, Cpu, User, LogOut, Bell, Shield, Lock, Network, Menu } from 'lucide-react';
import { GatewayModal } from '../Gateway/GatewayModal';

interface TopBarProps {
  onOpenAuth: () => void;
  onOpenAlerts: () => void;
  onToggleMobileMenu?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenAuth, onOpenAlerts, onToggleMobileMenu }) => {
  const { devices, selectedDevice, setSelectedDevice, wsConnected, isDeviceOnline, alerts } = useDevice();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showGatewayModal, setShowGatewayModal] = useState<boolean>(false);

  const unackAlerts = alerts.filter(a => !a.acknowledged).length;

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      <header 
        className="h-16 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 border-b border-slate-700/20"
        style={{ backgroundColor: 'var(--neu-surface)', boxShadow: '0 4px 15px var(--neu-shadow-dark)' }}
      >
        {/* Left Side: Mobile Menu Button & Device Selector */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="md:hidden neu-circle-btn w-9 h-9 text-slate-400 hover:text-cyan-400 flex items-center justify-center cursor-pointer"
              title="Open Navigation Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl neu-inset flex items-center justify-center text-cyan-400 shrink-0">
            <Cpu className="w-4 h-4" />
          </div>

          <div className="neu-inset px-2.5 sm:px-3 py-1.5 rounded-xl max-w-[170px] sm:max-w-xs">
            <select
              value={selectedDevice?.id || ''}
              onChange={(e) => {
                const target = devices.find(d => d.id === e.target.value);
                if (target) setSelectedDevice(target);
              }}
              className="bg-transparent text-xs font-bold font-mono outline-none cursor-pointer w-full truncate"
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
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Dedicated Physical Hardware Connection Badge */}
          <button
            type="button"
            onClick={() => setShowGatewayModal(true)}
            title="Click to view Multi-Channel MQTT & Gateway Diagnostics"
            className={`flex items-center space-x-1.5 sm:space-x-2 neu-inset px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl transition-all cursor-pointer hover:border-cyan-500/50 ${
              isDeviceOnline ? 'border border-emerald-500/30' : 'border border-rose-500/40 bg-rose-950/20'
            }`}
          >
            <span className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full neu-dot ${
              isDeviceOnline ? 'neu-dot-emerald animate-pulse' : 'neu-dot-rose'
            }`} />
            <span className={`text-[10px] sm:text-[11px] font-mono font-bold tracking-wider ${
              isDeviceOnline ? 'text-emerald-400' : 'text-rose-400 font-extrabold'
            }`}>
              {isDeviceOnline ? 'HARDWARE ONLINE' : 'HARDWARE OFFLINE'}
            </span>
          </button>

          {/* Gateway Extension Pointer Trigger */}
          <button
            type="button"
            onClick={() => setShowGatewayModal(true)}
            title="Configure Gateway Connection (IP / Cloud Server)"
            className={`hidden lg:flex items-center space-x-1.5 neu-inset px-3 py-2 rounded-xl cursor-pointer hover:border-cyan-500/40 ${
              wsConnected ? 'text-cyan-400' : 'text-slate-400'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono font-bold">
              {wsConnected ? 'GATEWAY LINKED' : 'MQTT ROUTER'}
            </span>
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title="Toggle Light / Dark Mode"
            className="neu-circle-btn w-9 h-9 sm:w-10 sm:h-10 text-slate-400 hover:text-cyan-400 cursor-pointer flex items-center justify-center shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
          </button>

          {/* Alarm Feed Button with Jewel Count Badge */}
          <button
            type="button"
            onClick={onOpenAlerts}
            className="neu-circle-btn w-9 h-9 sm:w-10 sm:h-10 relative text-slate-400 hover:text-cyan-400 cursor-pointer flex items-center justify-center shrink-0"
          >
            <Bell className="w-4 h-4" />
            {unackAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center animate-bounce">
                {unackAlerts}
              </span>
            )}
          </button>

          {/* Operator Profile / Authentication Controls */}
          {user ? (
            <div className="flex items-center space-x-2 sm:space-x-3 pl-1 sm:pl-2 border-l border-slate-700/30">
              <div className="text-right hidden sm:block">
                <span className="text-xs font-bold block max-w-[120px] truncate">{user.name}</span>
                <span className="text-[10px] font-mono font-bold uppercase text-cyan-400">
                  {user.role}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title={`Sign out (${user.email})`}
                className="neu-circle-btn w-9 h-9 sm:w-10 sm:h-10 text-slate-400 hover:text-rose-400 cursor-pointer flex items-center justify-center shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="neu-btn neu-btn-primary px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-extrabold flex items-center space-x-1.5 cursor-pointer shrink-0"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <User className="w-3.5 h-3.5 text-white" />
              <span>SIGN IN</span>
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
