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
  Radio,
  ExternalLink
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

    // Reject administrator logins on standard operator portal
    if (!isRegister && email.trim().toLowerCase() === 'admin@waterpump.io') {
      setErrorMsg('ADMINISTRATOR ACCESS: Please use the dedicated Admin Command Center at /admin.');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        await register(name.trim(), email.trim(), password, phone.trim(), role);
        setSuccessMsg('Operator account registered! Initializing station telemetry...');
      } else {
        await login(email.trim(), password);
        setSuccessMsg('Operator authentication confirmed! Accessing controller...');
      }

      setTimeout(() => {
        onClose();
      }, 600);
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto transition-all duration-300">
      <div 
        className="neu-card p-5 sm:p-7 max-w-md w-full my-auto max-h-[92vh] flex flex-col rounded-3xl relative border border-slate-700/30 animate-in fade-in zoom-in-95 duration-200"
        style={{ backgroundColor: 'var(--neu-surface)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 neu-circle-btn w-8 h-8 text-slate-400 hover:text-slate-200 cursor-pointer flex items-center justify-center transition-transform hover:scale-110"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable Form Content */}
        <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 -mr-1">
          {/* Animated Badge & Header */}
          <div className="text-center mb-4 pt-1">
            <div className="relative w-14 h-14 rounded-2xl neu-inset text-cyan-400 flex items-center justify-center mx-auto mb-2.5 shadow-inner">
              <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 animate-ping opacity-30" />
              <KeyRound className="w-7 h-7 text-cyan-400 relative z-10 transition-transform duration-300 hover:rotate-12" />
            </div>

            <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
              <Sparkles className="w-3 h-3 text-cyan-300 animate-pulse" />
              <span>OPERATOR AUTH GATEWAY</span>
            </div>

            <h3 className="text-lg sm:text-xl font-extrabold uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
              {isRegister ? 'Create Operator Account' : 'Operator Sign In'}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {isRegister 
                ? 'Register an operator profile to access live IoT pump controls.'
                : 'Sign in to access your station pump switches & live automation.'}
            </p>
          </div>

          {/* Neumorphic Segmented Tab Switcher */}
          <div className="neu-inset p-1.5 rounded-2xl flex mb-4">
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
            <div className="p-3 mb-3 rounded-2xl neu-inset text-rose-400 text-xs font-mono flex items-start space-x-2 border border-rose-500/20 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 mb-3 rounded-2xl neu-inset text-emerald-400 text-xs font-mono flex items-center space-x-2 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Registration Extra Fields */}
            {isRegister && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-mono">
                    Full Name / Operator Name
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full neu-input has-left-icon text-xs font-mono py-2.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-mono">
                    Phone Number (Optional - For Alerts)
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                    <input
                      type="tel"
                      placeholder="+1-555-0199"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full neu-input has-left-icon text-xs font-mono py-2.5"
                    />
                  </div>
                </div>

                {/* Role Selection Chips */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-mono">
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
                          className={`p-1.5 sm:p-2 rounded-xl text-[10px] font-bold font-mono transition-all flex flex-col items-center justify-center space-y-0.5 cursor-pointer ${
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
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-mono">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                <input
                  type="email"
                  required
                  placeholder="operator@waterpump.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full neu-input has-left-icon text-xs font-mono py-2.5"
                />
              </div>
            </div>

            {/* Password with Strength Meter & Visibility Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 font-mono">
                  Password
                </label>
                {isRegister && password.length > 0 && (
                  <span className="text-[9px] font-mono font-bold text-slate-400">
                    Strength: <span className="text-cyan-400">{passwordStrength.label}</span>
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full neu-input has-both-icons text-xs font-mono py-2.5"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-200 cursor-pointer z-10"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Live Password Strength Indicator Bar */}
              {isRegister && password.length > 0 && (
                <div className="mt-1.5 w-full h-1.5 rounded-full neu-inset overflow-hidden">
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
              className="w-full neu-btn neu-btn-primary py-3 text-xs font-extrabold flex items-center justify-center space-x-2 rounded-2xl mt-4 cursor-pointer shadow-lg active:scale-[0.98] transition-transform"
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
                  <span>{isRegister ? 'CREATE OPERATOR ACCOUNT' : 'SIGN IN AS OPERATOR'}</span>
                </>
              )}
            </button>
          </form>

          {/* Demo Operator Fill Preset (Sign In mode only) */}
          {!isRegister && (
            <div className="mt-4 pt-3 border-t border-slate-700/20 flex flex-col items-center space-y-2.5 text-xs font-mono">
              <button
                type="button"
                onClick={handleDemoUser}
                className="w-full neu-btn px-3 py-2 text-center text-[11px] rounded-xl text-cyan-400 hover:text-cyan-300 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Fill Demo Operator Credentials</span>
                <span className="text-[9px] text-slate-500 font-mono">(user@waterpump.io)</span>
              </button>

              <div className="pt-2 text-[10px] text-slate-500 flex items-center space-x-1">
                <span>Looking for Admin portal?</span>
                <a
                  href="/admin"
                  className="text-amber-400 hover:underline flex items-center space-x-0.5 font-bold"
                >
                  <span>Go to Admin Center</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
