import React from 'react';
import {
  LayoutDashboard,
  Power,
  Waves,
  BarChart3,
  Sliders,
  BellRing,
  Cpu,
  Bluetooth,
  Monitor,
  Settings,
  ShieldCheck,
  Shield,
  X
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
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  unackAlertsCount,
  mobileOpen = false,
  onCloseMobile
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: 'devices', label: 'Hardware Devices', icon: Cpu },
    { id: 'pump_control', label: 'Pump Controller', icon: Power },
    { id: 'tank_monitor', label: 'Water Tank View', icon: Waves },
    { id: 'analytics', label: 'Telemetry Analytics', icon: BarChart3 },
    { id: 'automation', label: 'Autonomous Rules', icon: Sliders },
    { id: 'alerts', label: 'Alarm Feed', icon: BellRing, badge: unackAlertsCount },
    { id: 'projector', label: 'Control Room View', icon: Monitor, highlight: true },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  const handleNavClick = (tabId: NavTab) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full p-5 min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between px-3 py-4 mb-6 neu-inset">
          <div className="flex items-center space-x-3.5">
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
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden neu-circle-btn w-8 h-8 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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
                onClick={() => handleNavClick(item.id as NavTab)}
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
      <div className="space-y-3 pt-4">
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
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside 
        className="w-64 shrink-0 hidden md:block border-r border-slate-700/20"
        style={{ backgroundColor: 'var(--neu-surface)', boxShadow: '5px 0 20px var(--neu-shadow-dark)' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Out Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
            onClick={onCloseMobile}
          />
          <div 
            className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 overflow-y-auto"
            style={{ backgroundColor: 'var(--neu-surface)' }}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
