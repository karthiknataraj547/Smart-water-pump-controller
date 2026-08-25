import {
  LayoutDashboard,
  Power,
  Waves,
  BarChart3,
  Sliders,
  BellRing,
  Bluetooth,
  Monitor,
  Settings,
  ShieldCheck,
  Shield
} from 'lucide-react';

export type NavTab = 
  | 'dashboard' 
  | 'pump_control' 
  | 'tank_monitor' 
  | 'analytics' 
  | 'automation' 
  | 'alerts' 
  | 'devices' 
  | 'provisioning' 
  | 'projector' 
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  unackAlertsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  unackAlertsCount
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: 'pump_control', label: 'Pump Controller', icon: Power },
    { id: 'tank_monitor', label: 'Water Tank View', icon: Waves },
    { id: 'analytics', label: 'Telemetry Analytics', icon: BarChart3 },
    { id: 'automation', label: 'Autonomous Rules', icon: Sliders },
    { id: 'alerts', label: 'Alarm Feed', icon: BellRing, badge: unackAlertsCount },
    { id: 'provisioning', label: 'Device Provisioning', icon: Bluetooth },
    { id: 'projector', label: 'Control Room View', icon: Monitor, highlight: true },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <aside 
      className="w-64 shrink-0 hidden md:flex flex-col justify-between p-5 min-h-screen border-r border-slate-700/20"
      style={{ backgroundColor: 'var(--neu-surface)', boxShadow: '5px 0 20px var(--neu-shadow-dark)' }}
    >
      <div>
        {/* Brand Header */}
        <div className="flex items-center space-x-3.5 px-3 py-4 mb-6 neu-inset">
          <div className="w-10 h-10 rounded-xl neu-card flex items-center justify-center text-cyan-400">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wider uppercase" style={{ fontFamily: 'var(--font-display)' }}>
              AQUACONTROL
            </h1>
            <span className="text-[10px] font-mono font-bold tracking-widest block text-cyan-400">
              INDUSTRIAL IOT v2.0
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as NavTab)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'neu-inset text-cyan-400 font-extrabold'
                    : 'neu-btn justify-start text-slate-400 hover:text-slate-100'
                }`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span className="tracking-wide">{item.label}</span>
                </div>

                {isActive && (
                  <span className="w-2 h-2 rounded-full neu-dot neu-dot-cyan" />
                )}

                {item.badge && item.badge > 0 && !isActive ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-sm shadow-rose-900/50 animate-pulse">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Safety Compliance & Admin Portal Footer */}
      <div className="space-y-3">
        <div className="p-3.5 neu-inset rounded-2xl">
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="w-2 h-2 rounded-full neu-dot neu-dot-emerald" />
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>FAIL-SAFE ACTIVE</span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Opto-isolated contactor interlock armed. Local edge safety active.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            window.location.href = '/admin';
          }}
          className="w-full text-center py-2 text-[11px] font-mono text-slate-500 hover:text-amber-400 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
        >
          <Shield className="w-3 h-3" />
          <span>Launch Admin Portal →</span>
        </button>
      </div>
    </aside>
  );
};
