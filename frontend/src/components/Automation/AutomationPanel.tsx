import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { ApiService } from '../../services/api';
import { Settings, Plus, ToggleLeft, ToggleRight, Trash2, Sliders, Cpu, CheckCircle2 } from 'lucide-react';

export const AutomationPanel: React.FC = () => {
  const { rules, selectedDevice, refreshRules, syncRulesToHardware } = useDevice();
  const [localRules, setLocalRules] = useState(rules);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [levelCondition, setLevelCondition] = useState<'lt' | 'gt'>('lt');
  const [thresholdVal, setThresholdVal] = useState<number>(30);
  const [pumpAction, setPumpAction] = useState<'START' | 'STOP'>('START');

  React.useEffect(() => {
    setLocalRules(rules);
  }, [rules]);

  const handleToggle = async (ruleId: string, currentEnabled: boolean) => {
    const devId = selectedDevice?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5';
    const nextState = !currentEnabled;
    const updated = localRules.map(r => r.id === ruleId ? { ...r, enabled: nextState } : r);
    setLocalRules(updated);
    
    // Immediate Direct MQTT Hardware Sync
    syncRulesToHardware(updated);

    try {
      await ApiService.toggleAutomationRule(devId, ruleId, nextState);
      await refreshRules();
    } catch (err: any) {
      console.warn('[Automation] Error toggling rule in backend, hardware updated:', err.message);
    }
  };

  const handleDelete = async (ruleId: string) => {
    const devId = selectedDevice?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5';
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    const updated = localRules.filter(r => r.id !== ruleId);
    setLocalRules(updated);

    // Immediate Direct MQTT Hardware Sync
    syncRulesToHardware(updated);

    try {
      await ApiService.deleteAutomationRule(devId, ruleId);
      await refreshRules();
    } catch (err: any) {
      console.warn('[Automation] Error deleting rule in backend, hardware updated:', err.message);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !newRuleName) return;

    const condition: any = {};
    if (levelCondition === 'lt') condition.level_lt = Number(thresholdVal);
    else condition.level_gt = Number(thresholdVal);

    const action = {
      pump_action: pumpAction,
      generate_alert: true,
      alert_title: `Automation: ${newRuleName}`
    };

    const tempRule: any = {
      id: `rule_${Date.now()}`,
      device_id: selectedDevice.id,
      rule_name: newRuleName,
      condition_json: condition,
      action_json: action,
      enabled: true,
      priority: 2
    };

    const updated = [...localRules, tempRule];
    setLocalRules(updated);
    syncRulesToHardware(updated);

    try {
      await ApiService.createAutomationRule(selectedDevice.id, {
        rule_name: newRuleName,
        condition_json: condition,
        action_json: action,
        enabled: true,
        priority: 2
      });
      setShowAddModal(false);
      setNewRuleName('');
      await refreshRules();
    } catch (err: any) {
      alert(`Failed to create rule: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center space-x-2" style={{ fontFamily: 'var(--font-display)' }}>
            <Sliders className="w-5 h-5 text-cyan-400" />
            <span>AUTONOMOUS EDGE RULES & SAFETY POLICIES</span>
          </h2>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-slate-400 font-mono">
              Rules execute strictly on ESP32 FreeRTOS hardware task and Cloud Automation Engine.
            </span>
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
              <Cpu className="w-3 h-3" />
              <span>EDGE FIRMWARE SYNC ACTIVE</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="neu-btn neu-btn-primary px-5 py-2.5 text-xs font-bold flex items-center space-x-1.5 rounded-2xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Plus className="w-4 h-4" />
          <span>ADD NEW RULE</span>
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {localRules.map((rule) => {
          const condition = typeof rule.condition_json === 'string' ? JSON.parse(rule.condition_json) : rule.condition_json;
          const action = typeof rule.action_json === 'string' ? JSON.parse(rule.action_json) : rule.action_json;

          return (
            <div
              key={rule.id}
              className={`neu-card p-5 transition-all ${
                rule.enabled ? '' : 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-sm tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                      {rule.rule_name}
                    </span>
                    {rule.priority === 0 && (
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-950/80 text-rose-400 border border-rose-500/30">
                        CRITICAL SAFETY
                      </span>
                    )}
                  </div>

                  {/* Conditions & Actions Summary */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                    <span className="p-2.5 neu-inset text-cyan-400 font-bold rounded-xl">
                      IF:{' '}
                      {condition.level_lt !== undefined && `Water Level < ${condition.level_lt}%`}
                      {condition.level_gt !== undefined && `Water Level > ${condition.level_gt}%`}
                      {condition.no_flow_timeout_seconds !== undefined && `No Flow for ${condition.no_flow_timeout_seconds}s`}
                    </span>
                    <span className="text-slate-400 font-bold">➔</span>
                    <span
                      className={`p-2.5 neu-inset font-bold rounded-xl ${
                        action.pump_action === 'START'
                          ? 'text-emerald-400'
                          : action.pump_action === 'EMERGENCY_STOP'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      THEN: {action.pump_action} PUMP
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => handleToggle(rule.id, Boolean(rule.enabled))}
                    className="cursor-pointer text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-9 h-9 text-cyan-400" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-slate-500" />
                    )}
                  </button>

                  {rule.priority !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(rule.id)}
                      className="neu-circle-btn w-9 h-9 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="neu-card p-6 max-w-md w-full my-auto max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl" style={{ backgroundColor: 'var(--neu-surface)' }}>
            <h3 className="text-lg font-extrabold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              CREATE AUTOMATION RULE
            </h3>
            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Night Refill (Start < 40%)"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full neu-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Condition</label>
                  <select
                    value={levelCondition}
                    onChange={(e: any) => setLevelCondition(e.target.value)}
                    className="w-full neu-input"
                  >
                    <option value="lt">Water Level &lt;</option>
                    <option value="gt">Water Level &gt;</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Threshold (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={thresholdVal}
                    onChange={(e) => setThresholdVal(parseInt(e.target.value, 10))}
                    className="w-full neu-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 font-mono">Trigger Action</label>
                <select
                  value={pumpAction}
                  onChange={(e: any) => setPumpAction(e.target.value)}
                  className="w-full neu-input"
                >
                  <option value="START">START PUMP</option>
                  <option value="STOP">STOP PUMP</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700/20">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="neu-btn px-4 py-2 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="neu-btn neu-btn-primary px-5 py-2 text-xs font-bold"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  SAVE RULE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
