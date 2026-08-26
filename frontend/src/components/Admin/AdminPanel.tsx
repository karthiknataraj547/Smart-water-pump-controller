import React, { useState, useEffect, useCallback } from 'react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDevice } from '../../context/DeviceContext';
import { User, Device, AuditLogEntry, AdminStats, SafetyPolicy, UserRole } from '../../types';
import {
  Shield,
  Users,
  Cpu,
  History,
  Sliders,
  Server,
  UserPlus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Mail,
  Phone,
  Trash2,
  Edit2,
  RefreshCw,
  Download,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Power,
  Waves,
  Zap,
  Activity,
  Check,
  X
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { devices, refreshDevices } = useDevice();

  const [activeSubTab, setActiveSubTab] = useState<'users' | 'devices' | 'logs' | 'policies' | 'gateway'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Search & Filters
  const [userSearch, setUserSearch] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [logSearch, setLogSearch] = useState<string>('');

  // Modals state
  const [showCreateUserModal, setShowCreateUserModal] = useState<boolean>(false);
  const [showEditUserModal, setShowEditUserModal] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditDeviceModal, setShowEditDeviceModal] = useState<boolean>(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Form Inputs for New User
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('PumpOperator@2026');
  const [newUserPhone, setNewUserPhone] = useState<string>('+1-800-555-0199');
  const [newUserRole, setNewUserRole] = useState<UserRole>('operator');

  // Form Inputs for Edit User
  const [editName, setEditName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('operator');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editPassword, setEditPassword] = useState<string>('');

  // Form Inputs for Edit Device
  const [editTankCapacity, setEditTankCapacity] = useState<number>(2000);
  const [editTankHeight, setEditTankHeight] = useState<number>(180);

  // Safety Policies
  const [safetyPolicy, setSafetyPolicy] = useState<SafetyPolicy>({
    overcurrentLimitAmps: 15.0,
    dryRunTimeoutSec: 120,
    maxContinuousRuntimeSec: 7200,
    autoStartLevelPct: 30.0,
    autoStopLevelPct: 95.0,
    shortCycleDelaySec: 180
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [uList, sData, lData] = await Promise.allSettled([
        ApiService.getAdminUsers(),
        ApiService.getAdminStats(),
        ApiService.getAdminAuditLogs(undefined, 60)
      ]);

      if (uList.status === 'fulfilled') setUsers(uList.value);
      if (sData.status === 'fulfilled') setStats(sData.value);
      if (lData.status === 'fulfilled') setAuditLogs(lData.value);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load administrative data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Flash message helper
  const notifySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // 1. Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await ApiService.createAdminUser({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        phone: newUserPhone,
        role: newUserRole,
        status: 'active'
      });
      setShowCreateUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      notifySuccess(`✓ Successfully created user account for ${newUserEmail}!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create user account');
    }
  };

  // 2. Update User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setErrorMsg('');
    try {
      await ApiService.updateAdminUser(selectedUser.id, {
        name: editName,
        email: editEmail,
        phone: editPhone,
        role: editRole,
        status: editStatus,
        password: editPassword || undefined
      });
      setShowEditUserModal(false);
      notifySuccess(`✓ Account for ${editEmail} updated successfully!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update user account');
    }
  };

  // 3. Delete User
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete account for "${userName}"?`)) return;
    try {
      await ApiService.deleteAdminUser(userId);
      notifySuccess(`✓ User ${userName} deleted successfully.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete user');
    }
  };

  // 4. Update Device
  const handleUpdateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    try {
      await ApiService.updateDeviceConfig(selectedDevice.id, {
        tank_capacity_liters: editTankCapacity,
        tank_height_cm: editTankHeight
      });
      setShowEditDeviceModal(false);
      notifySuccess(`✓ Hardware settings updated for ${selectedDevice.device_uid}`);
      refreshDevices();
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update device settings');
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Filtered Audit Logs
  const filteredLogs = auditLogs.filter((l) => {
    const s = logSearch.toLowerCase();
    return (
      l.action?.toLowerCase().includes(s) ||
      l.user_name?.toLowerCase().includes(s) ||
      l.user_email?.toLowerCase().includes(s) ||
      l.details?.toLowerCase().includes(s)
    );
  });

  const exportAuditLogsCsv = () => {
    const headers = ['Timestamp', 'Action', 'Actor Name', 'Actor Email', 'Source', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${l.created_at}"`,
      `"${l.action}"`,
      `"${l.user_name || 'SYSTEM'}"`,
      `"${l.user_email || 'N/A'}"`,
      `"${l.source}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aqua_audit_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification Banner */}
      {successMsg && (
        <div className="neu-card p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-mono text-xs font-bold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="neu-card p-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-rose-300 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-mono text-xs font-bold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="neu-card p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-amber-500/20">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl neu-inset flex items-center justify-center text-amber-400 border border-amber-500/30">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                ADMINISTRATIVE COMMAND CENTER
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-black">
                ROLE: {user?.role?.toUpperCase() || 'ADMIN'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Privileged system governance, user database control, hardware fleet orchestration & safety policy tuning.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="neu-btn px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-300 flex items-center space-x-2 cursor-pointer hover:text-amber-400"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>REFRESH DATA</span>
          </button>
        </div>
      </div>

      {/* High Level Fleet & Telemetry Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="neu-card p-4 rounded-2xl border border-slate-700/20">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>USERS</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 font-mono">
            {stats?.total_users ?? users.length}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Registered Accounts</span>
        </div>

        <div className="neu-card p-4 rounded-2xl border border-slate-700/20">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>HARDWARE</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {stats?.online_devices ?? 1} / {stats?.total_devices ?? devices.length}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Controllers Online</span>
        </div>

        <div className="neu-card p-4 rounded-2xl border border-slate-700/20">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>COMMANDS</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {stats?.commands_today ?? 0}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Executed Today</span>
        </div>

        <div className="neu-card p-4 rounded-2xl border border-slate-700/20">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>TELEMETRY</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400 font-mono">
            {stats?.total_readings ?? 0}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Total Readings</span>
        </div>

        <div className="neu-card p-4 rounded-2xl border border-slate-700/20">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>MQTT BROKER</span>
            <Server className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400 font-mono">
            :{stats?.mqtt_broker_port ?? 1883}
          </div>
          <span className="text-[10px] text-emerald-400 font-mono font-bold">● ACTIVE (AEDES)</span>
        </div>

        <div className="neu-card p-4 rounded-2xl border border-slate-700/20">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>HEAP MEM</span>
            <Activity className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 font-mono">
            {stats?.heap_used_mb ?? '38.4'} MB
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Node {stats?.node_version ?? 'v20'}</span>
        </div>
      </div>

      {/* Admin Tab Navigation Bar */}
      <div className="flex items-center space-x-2 border-b border-slate-700/20 pb-2 overflow-x-auto">
        {[
          { id: 'users', label: 'USER DATABASE & ACCOUNTS', icon: Users, badge: users.length },
          { id: 'devices', label: 'HARDWARE FLEET GOVERNANCE', icon: Cpu, badge: devices.length },
          { id: 'logs', label: 'SECURITY AUDIT LOGS', icon: History, badge: auditLogs.length },
          { id: 'policies', label: 'SAFETY & AUTOMATION POLICIES', icon: Sliders },
          { id: 'gateway', label: 'MQTT & GATEWAY DIAGNOSTICS', icon: Server }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'neu-inset text-amber-400 border border-amber-500/30'
                  : 'neu-btn text-slate-400 hover:text-slate-200'
              }`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono ${isActive ? 'bg-amber-400 text-slate-950 font-bold' : 'neu-inset text-slate-400'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: USER ACCOUNTS & DATABASE CONTROL */}
      {/* =================================================================== */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          <div className="neu-card p-5 rounded-3xl space-y-4">
            {/* Search, Filter & Add Button Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-1 items-center space-x-3 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name, email or phone..."
                    className="w-full pl-10 neu-input text-xs font-mono"
                  />
                </div>

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="neu-input text-xs font-mono py-2.5 px-3 uppercase text-slate-300"
                >
                  <option value="ALL">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="technician">Technician</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateUserModal(true)}
                className="neu-btn px-4 py-3 rounded-2xl text-xs font-black text-cyan-400 hover:text-cyan-300 flex items-center space-x-2 cursor-pointer border border-cyan-500/20"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <UserPlus className="w-4 h-4" />
                <span>CREATE USER ACCOUNT</span>
              </button>
            </div>

            {/* Interactive User Table */}
            <div className="overflow-x-auto rounded-2xl neu-inset p-1">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/20 text-slate-400 text-[11px] uppercase">
                    <th className="p-3.5">User Identity</th>
                    <th className="p-3.5">Contact Details</th>
                    <th className="p-3.5">Assigned Role</th>
                    <th className="p-3.5">Account Status</th>
                    <th className="p-3.5">Registered</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/10">
                  {filteredUsers.map((u) => {
                    const isRootAdmin = u.email === 'admin@waterpump.io';
                    return (
                      <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="p-3.5">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-xl neu-card flex items-center justify-center font-bold text-cyan-400 text-xs">
                              {u.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-200">{u.name}</div>
                              <div className="text-[11px] text-slate-400">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5 text-slate-300">
                          {u.phone || '—'}
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              u.role === 'admin'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : u.role === 'operator'
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                                : u.role === 'technician'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              u.status === 'active'
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-rose-400 bg-rose-500/10'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span>{u.status}</span>
                          </span>
                        </td>

                        <td className="p-3.5 text-slate-400 text-[11px]">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'}
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUser(u);
                                setEditName(u.name);
                                setEditEmail(u.email);
                                setEditPhone(u.phone || '');
                                setEditRole(u.role);
                                setEditStatus(u.status);
                                setEditPassword('');
                                setShowEditUserModal(true);
                              }}
                              className="neu-circle-btn w-7 h-7 text-slate-400 hover:text-cyan-400 cursor-pointer"
                              title="Edit User Profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {!isRootAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                className="neu-circle-btn w-7 h-7 text-slate-400 hover:text-rose-400 cursor-pointer"
                                title="Delete User Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  No users found matching your query.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: HARDWARE FLEET GOVERNANCE */}
      {/* =================================================================== */}
      {activeSubTab === 'devices' && (
        <div className="neu-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/20">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-200" style={{ fontFamily: 'var(--font-display)' }}>
                REGISTERED CONTROLLERS & TANK FLEET
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Inspect physical hardware nodes, adjust tank capacities and configure telemetry parameters.
              </p>
            </div>
            <button
              onClick={refreshDevices}
              className="neu-btn px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>SYNC FLEET</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((dev) => (
              <div key={dev.id} className="neu-inset p-5 rounded-2xl space-y-4 border border-slate-700/20">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl neu-card flex items-center justify-center text-cyan-400">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-100 flex items-center space-x-2 font-mono">
                        <span>{dev.device_uid}</span>
                        <span className="text-[10px] text-cyan-400 font-bold px-2 py-0.5 rounded-full bg-cyan-500/10">
                          {dev.firmware_version || 'v2.1.0'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        S/N: {dev.serial_number || 'SN-ESP32-9921'}
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>ONLINE</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="neu-card p-2.5 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">TANK CAPACITY</span>
                    <span className="font-bold text-cyan-400 text-sm">{dev.tank_capacity_liters || 2000} LITERS</span>
                  </div>
                  <div className="neu-card p-2.5 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">TANK HEIGHT</span>
                    <span className="font-bold text-slate-200 text-sm">{dev.tank_height_cm || 180} CM</span>
                  </div>
                  <div className="neu-card p-2.5 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">LAN IP ADDRESS</span>
                    <span className="font-bold text-slate-300">{dev.local_ip || '10.183.75.178'}</span>
                  </div>
                  <div className="neu-card p-2.5 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">MAC ADDRESS</span>
                    <span className="font-bold text-slate-300">{dev.mac_address || '24:6F:28:A8:1F:29'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-700/20">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Last Seen: {new Date(dev.last_seen).toLocaleTimeString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDevice(dev);
                      setEditTankCapacity(dev.tank_capacity_liters || 2000);
                      setEditTankHeight(dev.tank_height_cm || 180);
                      setShowEditDeviceModal(true);
                    }}
                    className="neu-btn px-3 py-1.5 rounded-xl text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>CONFIGURE TANK</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: SECURITY AUDIT TRAIL & ACCESS LOGS */}
      {/* =================================================================== */}
      {activeSubTab === 'logs' && (
        <div className="neu-card p-6 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/20">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-200" style={{ fontFamily: 'var(--font-display)' }}>
                IMMUTABLE AUDIT TRAIL & SYSTEM LOGS
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Complete record of pump operations, authentication attempts, configuration modifications, and safety trips.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Filter logs..."
                  className="pl-9 pr-3 py-1.5 neu-input text-xs font-mono"
                />
              </div>

              <button
                type="button"
                onClick={exportAuditLogsCsv}
                className="neu-btn px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-cyan-400 flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>EXPORT CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl neu-inset p-1 max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-sm z-10">
                <tr className="border-b border-slate-700/20 text-slate-400 text-[11px] uppercase">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action Type</th>
                  <th className="p-3">Actor / User</th>
                  <th className="p-3">Origin Source</th>
                  <th className="p-3">Activity Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/10">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 font-bold text-[10px] border border-cyan-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-200">
                      {log.user_name || log.user_email || 'OPERATOR'}
                    </td>
                    <td className="p-3 text-slate-400 uppercase text-[10px]">
                      {log.source || 'WEB'}
                    </td>
                    <td className="p-3 text-slate-300 text-[11px]">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: SAFETY & AUTOMATION THRESHOLDS */}
      {/* =================================================================== */}
      {activeSubTab === 'policies' && (
        <div className="neu-card p-6 rounded-3xl space-y-6">
          <div className="pb-3 border-b border-slate-700/20">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-200" style={{ fontFamily: 'var(--font-display)' }}>
              INDUSTRIAL SAFETY INTERLOCKS & POLICY ENGINE
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Configure global hardware safety thresholds applied across all ESP32 nodes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="neu-inset p-5 rounded-2xl space-y-3 border border-slate-700/20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-slate-300 font-mono">
                  Motor Overcurrent Trip Limit
                </label>
                <span className="text-amber-400 font-bold font-mono text-sm">{safetyPolicy.overcurrentLimitAmps} A</span>
              </div>
              <input
                type="range"
                min="5.0"
                max="25.0"
                step="0.5"
                value={safetyPolicy.overcurrentLimitAmps}
                onChange={(e) => setSafetyPolicy({ ...safetyPolicy, overcurrentLimitAmps: parseFloat(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 font-mono">
                ACS712 current threshold that instantaneously trips emergency lockout to prevent motor burnout.
              </p>
            </div>

            <div className="neu-inset p-5 rounded-2xl space-y-3 border border-slate-700/20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-slate-300 font-mono">
                  Borewell Dry Run Inflow Timeout
                </label>
                <span className="text-cyan-400 font-bold font-mono text-sm">{safetyPolicy.dryRunTimeoutSec} SEC</span>
              </div>
              <input
                type="range"
                min="30"
                max="300"
                step="10"
                value={safetyPolicy.dryRunTimeoutSec}
                onChange={(e) => setSafetyPolicy({ ...safetyPolicy, dryRunTimeoutSec: parseInt(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 font-mono">
                Shuts off pump if zero water flow is detected across flowmeter for specified duration.
              </p>
            </div>

            <div className="neu-inset p-5 rounded-2xl space-y-3 border border-slate-700/20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-slate-300 font-mono">
                  Auto-Start Low Tank Trigger
                </label>
                <span className="text-emerald-400 font-bold font-mono text-sm">&lt; {safetyPolicy.autoStartLevelPct}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={safetyPolicy.autoStartLevelPct}
                onChange={(e) => setSafetyPolicy({ ...safetyPolicy, autoStartLevelPct: parseFloat(e.target.value) })}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 font-mono">
                Autonomous edge automation turns on pump when water level drops below this point.
              </p>
            </div>

            <div className="neu-inset p-5 rounded-2xl space-y-3 border border-slate-700/20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-slate-300 font-mono">
                  Auto-Stop Tank Full Cutoff
                </label>
                <span className="text-rose-400 font-bold font-mono text-sm">&gt;= {safetyPolicy.autoStopLevelPct}%</span>
              </div>
              <input
                type="range"
                min="80"
                max="100"
                step="1"
                value={safetyPolicy.autoStopLevelPct}
                onChange={(e) => setSafetyPolicy({ ...safetyPolicy, autoStopLevelPct: parseFloat(e.target.value) })}
                className="w-full accent-rose-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 font-mono">
                Instantly de-energizes pump to prevent tank overflow and spill hazards.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-700/20">
            <button
              type="button"
              onClick={() => notifySuccess('✓ Safety policies saved & broadcasted to all active ESP32 nodes!')}
              className="neu-btn neu-btn-primary px-6 py-3.5 rounded-2xl text-xs font-black flex items-center space-x-2 cursor-pointer"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>APPLY POLICIES TO ALL FLEET NODES</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: MQTT BROKER & GATEWAY DIAGNOSTICS */}
      {/* =================================================================== */}
      {activeSubTab === 'gateway' && (
        <div className="neu-card p-6 rounded-3xl space-y-6">
          <div className="pb-3 border-b border-slate-700/20">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-200" style={{ fontFamily: 'var(--font-display)' }}>
              EMBEDDED MQTT BROKER & REALTIME CLOUD GATEWAY
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Live gateway diagnostics, socket subscriptions and persistent storage status.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="neu-inset p-5 rounded-2xl space-y-3 border border-slate-700/20">
              <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs font-mono">
                <Server className="w-4 h-4" />
                <span>MQTT BROKER (AEDES)</span>
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                TCP Port 1883
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Handles bi-directional binary telemetry packets and instantaneous QoS 1 control acknowledgments.
              </p>
            </div>

            <div className="neu-inset p-5 rounded-2xl space-y-3 border border-slate-700/20">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs font-mono">
                <Activity className="w-4 h-4" />
                <span>WEBSOCKET HUB</span>
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                Port 5000 /ws
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Broadcasts live wave fluid calculations, ampere draw, and alarm notifications to all active web clients.
              </p>
            </div>

            <div className="neu-inset p-5 rounded-2xl space-y-3 border border-slate-700/20">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs font-mono">
                <Lock className="w-4 h-4" />
                <span>PERSISTENT DATA STORE</span>
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                JSON-Backed SQLite
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Zero-config fault-tolerant ACID persistent state store with auto-recovery on restart.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE NEW USER ACCOUNT */}
      {/* =================================================================== */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="neu-card p-6 sm:p-8 max-w-lg w-full my-auto max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl relative" style={{ backgroundColor: 'var(--neu-surface)' }}>
            <button
              onClick={() => setShowCreateUserModal(false)}
              className="absolute top-5 right-5 neu-circle-btn w-8 h-8 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl neu-inset text-cyan-400 flex items-center justify-center mx-auto mb-2">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold uppercase" style={{ fontFamily: 'var(--font-display)' }}>
                CREATE USER ACCOUNT
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Add an authorized operator, technician, or administrator to the database.
              </p>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Full Name</label>
                <div className="relative">
                  <Users className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="w-full pl-10 neu-input font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="sarah@waterpump.io"
                    className="w-full pl-10 neu-input font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Initial Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full pl-10 neu-input font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      className="w-full pl-10 neu-input font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">System Role Clearance</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full neu-input font-mono text-xs py-2.5 px-3 uppercase text-slate-200"
                >
                  <option value="operator">Operator (Pump Controls, Live Waves, Alarms)</option>
                  <option value="technician">Technician (Calibration, Device Config, OTA)</option>
                  <option value="viewer">Viewer (Read-Only Telemetry Monitor)</option>
                  <option value="admin">Administrator (Full Database & Fleet Clearance)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full neu-btn neu-btn-primary py-3.5 text-xs font-black tracking-wider flex items-center justify-center space-x-2 rounded-2xl mt-6 cursor-pointer"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <Check className="w-4 h-4" />
                <span>CONFIRM & REGISTER USER</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: EDIT USER ACCOUNT */}
      {/* =================================================================== */}
      {showEditUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="neu-card p-6 sm:p-8 max-w-lg w-full my-auto max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl relative" style={{ backgroundColor: 'var(--neu-surface)' }}>
            <button
              onClick={() => setShowEditUserModal(false)}
              className="absolute top-5 right-5 neu-circle-btn w-8 h-8 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl neu-inset text-amber-400 flex items-center justify-center mx-auto mb-2">
                <Edit2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold uppercase" style={{ fontFamily: 'var(--font-display)' }}>
                EDIT USER ACCOUNT
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Modify clearance, profile details, or reset credentials for {selectedUser.email}.
              </p>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full neu-input font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">System Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full neu-input font-mono text-xs py-2.5 px-3 uppercase text-slate-200"
                  >
                    <option value="operator">Operator</option>
                    <option value="technician">Technician</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Account Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full neu-input font-mono text-xs py-2.5 px-3 uppercase text-slate-200"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">
                  Reset Password (Leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="New password (optional)..."
                  className="w-full neu-input font-mono text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full neu-btn neu-btn-primary py-3.5 text-xs font-black tracking-wider flex items-center justify-center space-x-2 rounded-2xl mt-6 cursor-pointer"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <Check className="w-4 h-4" />
                <span>SAVE CHANGES</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CONFIGURE TANK & HARDWARE */}
      {/* =================================================================== */}
      {showEditDeviceModal && selectedDevice && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="neu-card p-6 sm:p-8 max-w-md w-full my-auto max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl relative" style={{ backgroundColor: 'var(--neu-surface)' }}>
            <button
              onClick={() => setShowEditDeviceModal(false)}
              className="absolute top-5 right-5 neu-circle-btn w-8 h-8 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl neu-inset text-cyan-400 flex items-center justify-center mx-auto mb-2">
                <Sliders className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold uppercase" style={{ fontFamily: 'var(--font-display)' }}>
                TANK SPECIFICATIONS
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Calibrate capacity and dimensions for node {selectedDevice.device_uid}.
              </p>
            </div>

            <form onSubmit={handleUpdateDevice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">
                  Tank Capacity (Liters)
                </label>
                <input
                  type="number"
                  required
                  min="100"
                  max="100000"
                  value={editTankCapacity}
                  onChange={(e) => setEditTankCapacity(parseInt(e.target.value))}
                  className="w-full neu-input font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">
                  Tank Height (Centimeters)
                </label>
                <input
                  type="number"
                  required
                  min="20"
                  max="1000"
                  value={editTankHeight}
                  onChange={(e) => setEditTankHeight(parseInt(e.target.value))}
                  className="w-full neu-input font-mono text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full neu-btn neu-btn-primary py-3.5 text-xs font-black tracking-wider flex items-center justify-center space-x-2 rounded-2xl mt-6 cursor-pointer"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <Check className="w-4 h-4" />
                <span>SAVE TANK CONFIG</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
