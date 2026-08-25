import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, User, Phone, X, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('user@waterpump.io');
  const [password, setPassword] = useState('User@123456');
  const [name, setName] = useState('Station Operator');
  const [phone, setPhone] = useState('+1-800-555-USER');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(name, email, password, phone);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoUser = () => {
    setEmail('user@waterpump.io');
    setPassword('User@123456');
    setIsRegister(false);
  };

  const handleDemoAdmin = () => {
    setEmail('admin@waterpump.io');
    setPassword('Admin@123456');
    setIsRegister(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="neu-card p-8 max-w-md w-full rounded-3xl relative" style={{ backgroundColor: 'var(--neu-surface)' }}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 neu-circle-btn w-8 h-8 text-slate-400 hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl neu-inset text-cyan-400 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
            <span>OPERATOR & TECHNICIAN ACCESS</span>
          </div>
          <h3 className="text-xl font-bold uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            {isRegister ? 'New Operator Registration' : 'Operator Authentication'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Access live IoT telemetry, pump switches, wave simulations and alarm feeds.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 mb-4 rounded-2xl neu-inset text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 neu-input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 neu-input"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 neu-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 neu-input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full neu-btn neu-btn-primary py-3.5 text-xs font-extrabold flex items-center justify-center space-x-2 rounded-2xl mt-6 cursor-pointer"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{loading ? 'AUTHENTICATING...' : (isRegister ? 'REGISTER & ENTER' : 'SIGN IN TO GATEWAY')}</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-700/20 flex flex-col items-center space-y-2 text-xs">
          <div className="flex items-center space-x-3 text-xs font-mono">
            <button
              type="button"
              onClick={handleDemoUser}
              className="text-cyan-400 font-bold hover:underline cursor-pointer"
            >
              Fill Operator Login
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={handleDemoAdmin}
              className="text-amber-400 font-bold hover:underline cursor-pointer"
            >
              Fill Admin Login
            </button>
          </div>

          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setErrorMsg(''); }}
            className="text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            {isRegister ? 'Already have credentials? Sign In' : 'Need new operator access? Register'}
          </button>
        </div>
      </div>
    </div>
  );
};
