import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Lock,
  Mail,
  User,
  Phone,
  X,
  ShieldCheck,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Wrench,
  Radio
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('user@waterpump.io');
  const [password, setPassword] = useState<string>('User@123456');
  const [name, setName] = useState<string>('Station Operator');
  const [phone, setPhone] = useState<string>('+1-800-555-USER');
  const [role, setRole] = useState<string>('operator');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Real-Time Password Strength Analysis
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: 'None', color: 'bg-slate-700' };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) return { score: 25, label: 'Basic', color: 'bg-rose-500' };
    if (score === 3) return { score: 50, label: 'Fair', color: 'bg-amber-500' };
    if (score === 4) return { score: 75, label: 'Strong', color: 'bg-cyan-500' };
    return { score: 100, label: 'Industrial Grade', color: 'bg-emerald-500' };
  }, [password]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        await register(name.trim(), email.trim(), password, phone.trim(), role);
        setSuccessMsg('Account created successfully! Initializing station session...');
      } else {
        await login(email.trim(), password);
        setSuccessMsg('Authentication confirmed! Accessing controller...');
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoUser = () => {
    setEmail('user@waterpump.io');
    setPassword('User@123456');
    setIsRegister(false);
    setErrorMsg('');
  };

  const handleDemoAdmin = () => {
    setEmail('admin@waterpump.io');
    setPassword('Admin@123456');
    setIsRegister(false);
    setErrorMsg('');
  };

  const switchMode = (reg: boolean) => {
    setIsRegister(reg);
    setErrorMsg('');
    setSuccessMsg('');
    if (reg) {
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
    } else {
      setEmail('user@waterpump.io');
      setPassword('User@123456');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300">
      <div 
        className="neu-card p-6 sm:p-8 max-w-md w-full rounded-3xl relative border border-slate-700/30 animate-in fade-in zoom-in-95 duration-200"
        style={{ backgroundColor: 'var(--neu-surface)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 neu-circle-btn w-8 h-8 text-slate-400 hover:text-slate-200 cursor-pointer flex items-center justify-center transition-transform hover:scale-110"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Animated Badge & Header */}
        <div className="text-center mb-6">
          <div className="relative w-16 h-16 rounded-2xl neu-inset text-cyan-400 flex items-center justify-center mx-auto mb-3.5 shadow-inner">
            <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 animate-ping opacity-30" />
            <KeyRound className="w-8 h-8 text-cyan-400 relative z-10 transition-transform duration-300 hover:rotate-12" />
          </div>

          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3 text-cyan-300 animate-pulse" />
            <span>INDUSTRIAL AUTH GATEWAY</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-extrabold uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
            {isRegister ? 'Create User Account' : 'Operator Sign In'}
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-1">
            {isRegister 
              ? 'Register a new operator profile with local controller permissions.'
              : 'Sign in to access live IoT telemetry, pump interlocks & automation.'}
          </p>
        </div>

        {/* Neumorphic Segmented Tab Switcher */}
        <div className="neu-inset p-1.5 rounded-2xl flex mb-5">
          <button
            type="button"
            onClick={() => switchMode(false)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold font-mono transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer ${
              !isRegister
                ? 'neu-card text-cyan-400 font-extrabold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>SIGN IN</span>
          </button>
          <button
            type="button"
            onClick={() => switchMode(true)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold font-mono transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer ${
              isRegister
                ? 'neu-card text-cyan-400 font-extrabold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>REGISTER</span>
          </button>
        </div>

        {/* Alert Feedback Messages */}
        {errorMsg && (
          <div className="p-3.5 mb-4 rounded-2xl neu-inset text-rose-400 text-xs font-mono flex items-start space-x-2.5 border border-rose-500/20 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 mb-4 rounded-2xl neu-inset text-emerald-400 text-xs font-mono flex items-center space-x-2.5 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Registration Extra Fields */}
          {isRegister && (
            <>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1 font-mono">
                  Full Name / Operator Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 neu-input text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1 font-mono">
                  Phone Number (Optional - For Alerts)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="+1-555-0199"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 neu-input text-xs font-mono"
                  />
                </div>
              </div>

              {/* Role Selection Chips */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5 font-mono">
                  Assigned Operational Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'operator', label: 'Operator', icon: Radio },
                    { id: 'technician', label: 'Technician', icon: Wrench },
                    { id: 'viewer', label: 'Viewer', icon: Shield }
                  ].map((r) => {
                    const Icon = r.icon;
                    const isSelected = role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className={`p-2 rounded-xl text-[10px] font-bold font-mono transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                          isSelected
                            ? 'neu-inset text-cyan-400 border border-cyan-500/40 bg-cyan-950/20'
                            : 'neu-btn text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Email Address */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1 font-mono">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="operator@waterpump.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 neu-input text-xs font-mono"
              />
            </div>
          </div>

          {/* Password with Strength Meter & Visibility Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase text-slate-400 font-mono">
                Password
              </label>
              {isRegister && password.length > 0 && (
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  Strength: <span className="text-cyan-400">{passwordStrength.label}</span>
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 neu-input text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Live Password Strength Indicator Bar */}
            {isRegister && password.length > 0 && (
              <div className="mt-2 w-full h-1.5 rounded-full neu-inset overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                  style={{ width: `${passwordStrength.score}%` }}
                />
              </div>
            )}
          </div>

          {/* Submit Action Button with Neumorphic Aura */}
          <button
            type="submit"
            disabled={loading}
            className="w-full neu-btn neu-btn-primary py-3.5 text-xs font-extrabold flex items-center justify-center space-x-2 rounded-2xl mt-6 cursor-pointer shadow-lg active:scale-[0.98] transition-transform"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                <span>PROCESSING...</span>
              </div>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{isRegister ? 'CREATE OPERATOR ACCOUNT' : 'SIGN IN TO GATEWAY'}</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Fill Presets (When in Sign In mode) */}
        {!isRegister && (
          <div className="mt-6 pt-4 border-t border-slate-700/20">
            <span className="block text-center text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">
              Quick One-Click Logins:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={handleDemoUser}
                className="neu-btn px-3 py-2 text-left text-[11px] rounded-xl text-cyan-400 hover:text-cyan-300 flex items-center justify-between cursor-pointer"
              >
                <span>Operator</span>
                <span className="text-[9px] text-slate-500">user@</span>
              </button>
              <button
                type="button"
                onClick={handleDemoAdmin}
                className="neu-btn px-3 py-2 text-left text-[11px] rounded-xl text-amber-400 hover:text-amber-300 flex items-center justify-between cursor-pointer"
              >
                <span>Admin</span>
                <span className="text-[9px] text-slate-500">admin@</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
