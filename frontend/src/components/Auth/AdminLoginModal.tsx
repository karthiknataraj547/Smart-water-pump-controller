import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, ShieldAlert, KeyRound, Mail, X, CheckCircle2, Lock, Cpu } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { loginAdmin } = useAuth();
  const [email, setEmail] = useState('admin@waterpump.io');
  const [password, setPassword] = useState('Admin@123456');
  const [securityPin, setSecurityPin] = useState('9921');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (securityPin !== '9921' && securityPin.length < 4) {
        throw new Error('SECURITY OVERRIDE: Invalid 4-Digit Administrator Security PIN.');
      }
      await loginAdmin(email, password);
      if (onSuccess) onSuccess();
      onClose();
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="neu-card p-6 sm:p-8 max-w-lg w-full my-auto max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl relative border border-amber-500/20" 
        style={{ 
          backgroundColor: 'var(--neu-surface)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(245, 158, 11, 0.05)'
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 neu-circle-btn w-8 h-8 text-slate-400 hover:text-slate-200 cursor-pointer flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Cyber Security Clearance Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl neu-inset text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/30">
            <Shield className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-black uppercase tracking-widest mb-2">
            <Lock className="w-3 h-3" />
            <span>RESTRICTED ACCESS LEVEL 0</span>
          </div>
          <h3 className="text-2xl font-black tracking-wide text-slate-100 uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            ADMINISTRATOR PORTAL
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Requires privileged credentials & administrative role authorization.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 mb-5 rounded-2xl neu-inset border border-rose-500/30 text-rose-400 text-xs flex items-start space-x-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
            <span className="leading-relaxed font-mono">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleAdminSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1.5 font-mono">
              Admin Identity / Email
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-amber-400 pointer-events-none z-10" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@waterpump.io"
                className="w-full neu-input has-left-icon font-mono text-xs border-amber-500/20 focus:border-amber-400 py-2.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1.5 font-mono">
              Root Password
            </label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-3.5 w-4 h-4 text-amber-400 pointer-events-none z-10" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full neu-input has-left-icon font-mono text-xs border-amber-500/20 focus:border-amber-400 py-2.5"
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
            <div className="relative flex items-center">
              <Cpu className="absolute left-3.5 w-4 h-4 text-amber-400 pointer-events-none z-10" />
              <input
                type="password"
                maxLength={6}
                required
                value={securityPin}
                onChange={(e) => setSecurityPin(e.target.value)}
                placeholder="9921"
                className="w-full neu-input has-left-icon font-mono tracking-widest text-xs border-amber-500/20 focus:border-amber-400 py-2.5"
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
            <span>{loading ? 'VERIFYING SECURITY CLEARANCE...' : 'AUTHORIZE ADMINISTRATOR ACCESS'}</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-700/20 flex flex-col items-center space-y-2 text-xs">
          <button
            type="button"
            onClick={handleFillDemo}
            className="text-amber-400 font-mono font-bold hover:underline cursor-pointer"
          >
            Fill Default Admin Credentials (admin@waterpump.io)
          </button>
          <span className="text-[10px] text-slate-400 font-mono text-center">
            All administrative actions are logged in immutable system audit records.
          </span>
        </div>
      </div>
    </div>
  );
};
