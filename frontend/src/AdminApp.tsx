import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { AdminPanel } from './components/Admin/AdminPanel';
import {
  Shield,
  Lock,
  KeyRound,
  Mail,
  Cpu,
  ArrowLeft,
  Sun,
  Moon,
  LogOut,
  CheckCircle2,
  ShieldAlert,
  Server
} from 'lucide-react';

export const AdminApp: React.FC = () => {
  const { user, isAdmin, loginAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Login form state
  const [email, setEmail] = useState('admin@waterpump.io');
  const [password, setPassword] = useState('Admin@123456');
  const [securityPin, setSecurityPin] = useState('9921');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      if (securityPin !== '9921' && securityPin.length < 4) {
        throw new Error('SECURITY OVERRIDE: Invalid 4-Digit Administrator Security PIN.');
      }
      await loginAdmin(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Administrator authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('admin@waterpump.io');
    setPassword('Admin@123456');
    setSecurityPin('9921');
  };

  // 1. If not logged in as Admin -> Dedicated Cybersecurity Login Screen
  if (!user || !isAdmin) {
    return (
      <div 
        className="min-h-screen flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200" 
        style={{ backgroundColor: 'var(--neu-bg)' }}
      >
        {/* Top return link */}
        <div className="max-w-md w-full mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            className="neu-btn px-4 py-2 rounded-2xl text-xs font-bold text-slate-400 hover:text-cyan-400 flex items-center space-x-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>RETURN TO USER APP</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="neu-circle-btn w-9 h-9 text-slate-400 hover:text-amber-400 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
          </button>
        </div>

        {/* Center Cyber Login Card */}
        <div className="max-w-md w-full mx-auto my-auto py-6">
          <div 
            className="neu-card p-8 rounded-3xl relative border border-amber-500/30"
            style={{ 
              backgroundColor: 'var(--neu-surface)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(245, 158, 11, 0.05)'
            }}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl neu-inset text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/30">
                <Shield className="w-8 h-8 text-amber-400 animate-pulse" />
              </div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-black uppercase tracking-widest mb-2">
                <Lock className="w-3 h-3" />
                <span>RESTRICTED ACCESS LEVEL 0</span>
              </div>
              <h2 className="text-2xl font-black tracking-wide text-slate-100 uppercase" style={{ fontFamily: 'var(--font-display)' }}>
                ADMINISTRATOR APPLICATION
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Privileged access gateway for user databases, fleet governance & hardware policies.
              </p>
            </div>

            {errorMsg && (
              <div className="p-4 mb-5 rounded-2xl neu-inset border border-rose-500/30 text-rose-400 text-xs flex items-start space-x-2.5">
                <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
                <span className="leading-relaxed font-mono">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1.5 font-mono">
                  Administrator Identity
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-amber-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@waterpump.io"
                    className="w-full pl-10 neu-input font-mono text-xs border-amber-500/20 focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1.5 font-mono">
                  Root Master Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-amber-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 neu-input font-mono text-xs border-amber-500/20 focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase text-slate-300 font-mono">
                    Hardware 4-Digit Security PIN
                  </label>
                  <span className="text-[10px] text-amber-400/80 font-mono">Default: 9921</span>
                </div>
                <div className="relative">
                  <Cpu className="absolute left-3.5 top-3 w-4 h-4 text-amber-400" />
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={securityPin}
                    onChange={(e) => setSecurityPin(e.target.value)}
                    placeholder="9921"
                    className="w-full pl-10 neu-input font-mono tracking-widest text-xs border-amber-500/20 focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 text-xs font-black tracking-wider flex items-center justify-center space-x-2 rounded-2xl mt-6 cursor-pointer transition-all bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/20"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950 font-bold" />
                <span>{loading ? 'AUTHENTICATING PRIVILEGED ACCESS...' : 'ENTER ADMIN CONTROL CENTER'}</span>
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-700/20 flex flex-col items-center space-y-2 text-xs">
              <button
                type="button"
                onClick={handleFillDemo}
                className="text-amber-400 font-mono font-bold hover:underline cursor-pointer"
              >
                Quick Fill Root Administrator Credentials
              </button>
              <span className="text-[10px] text-slate-400 font-mono text-center">
                All administrative modifications are logged to immutable system audit trails.
              </span>
            </div>
          </div>
        </div>

        {/* Bottom footer */}
        <div className="text-center text-[11px] font-mono text-slate-500">
          AquaControl Industrial IoT Ecosystem — Autonomous Security Architecture
        </div>
      </div>
    );
  }

  // 2. Authenticated Admin Dashboard Screen
  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200" style={{ backgroundColor: 'var(--neu-bg)' }}>
      {/* Dedicated Admin Header */}
      <header 
        className="h-16 px-6 flex items-center justify-between sticky top-0 z-40 border-b border-amber-500/20"
        style={{ backgroundColor: 'var(--neu-surface)', boxShadow: '0 4px 15px var(--neu-shadow-dark)' }}
      >
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl neu-card flex items-center justify-center text-amber-400 border border-amber-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wider uppercase flex items-center space-x-2" style={{ fontFamily: 'var(--font-display)' }}>
              <span>AQUACONTROL ADMIN APPLICATION</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold">
                ROOT PRIVILEGES
              </span>
            </h1>
            <span className="text-[10px] font-mono text-slate-400 block">
              User Database &bull; Hardware Governance &bull; Policy Engine
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            className="neu-btn px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-cyan-400 flex items-center space-x-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SWITCH TO USER APP</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="neu-circle-btn w-10 h-10 text-slate-400 hover:text-amber-400 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
          </button>

          <div className="flex items-center space-x-3 pl-2 border-l border-slate-700/30">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold block text-slate-200">{user.name}</span>
              <span className="text-[10px] text-amber-400 font-mono font-bold uppercase">SYSTEM ADMINISTRATOR</span>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Admin Logout"
              className="neu-circle-btn w-10 h-10 text-slate-400 hover:text-rose-400 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Panel Viewport */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        <AdminPanel />
      </main>
    </div>
  );
};
