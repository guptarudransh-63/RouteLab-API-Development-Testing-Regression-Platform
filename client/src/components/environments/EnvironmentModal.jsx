import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { api } from '../../api/client.js';
import {
  Globe,
  Plus,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

export default function EnvironmentModal({ onClose }) {
  const {
    environments,
    refreshEnvironments,
    activeEnvironment,
    setActiveEnvironment,
    showToast,
  } = useWorkspace();

  const [selectedEnv, setSelectedEnv] = useState(activeEnvironment || environments[0] || null);
  const [name, setName] = useState(selectedEnv?.name || '');
  const [variables, setVariables] = useState(selectedEnv?.variables || []);
  const [revealedSecrets, setRevealedSecrets] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');

  useEffect(() => {
    if (selectedEnv) {
      setName(selectedEnv.name);
      setVariables(selectedEnv.variables || []);
    }
  }, [selectedEnv]);

  async function handleSave() {
    if (!selectedEnv) return;
    try {
      await api.updateEnvironment(selectedEnv._id, { name, variables });
      showToast('Environment saved successfully', 'success');
      await refreshEnvironments();
    } catch (err) {
      showToast('Failed to save environment: ' + err.message, 'error');
    }
  }

  async function handleCreateNew(e) {
    e.preventDefault();
    if (!newEnvName.trim()) return;

    try {
      const data = await api.createEnvironment({
        name: newEnvName,
        variables: [
          { key: 'baseUrl', value: 'http://localhost:5001/api/v1/mock', isSecret: false, enabled: true },
        ],
      });
      showToast('Environment created', 'success');
      await refreshEnvironments();
      setSelectedEnv(data.environment);
      setIsCreating(false);
      setNewEnvName('');
    } catch (err) {
      showToast('Failed to create: ' + err.message, 'error');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this environment?')) return;
    try {
      await api.deleteEnvironment(id);
      showToast('Environment deleted', 'info');
      await refreshEnvironments();
      setSelectedEnv(environments.find((e) => e._id !== id) || null);
    } catch (err) {
      showToast('Failed to delete environment: ' + err.message, 'error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#182234] border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col h-[560px] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-700/80 flex items-center justify-between bg-[#141d2e]">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Environment & Variable Manager</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Environments Sidebar */}
          <div className="w-56 bg-[#141d2e] border-r border-slate-700/80 p-3 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-2 mb-2">
                Environments
              </span>
              {environments.map((env) => (
                <div
                  key={env._id}
                  onClick={() => setSelectedEnv(env)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer flex items-center justify-between transition-colors ${
                    selectedEnv?._id === env._id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{env.name}</span>
                  {selectedEnv?._id === env._id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(env._id);
                      }}
                      className="text-white/70 hover:text-white p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setIsCreating(true)}
              className="w-full py-2 px-3 border border-dashed border-slate-700 hover:border-indigo-500 rounded-lg text-xs font-semibold text-slate-400 hover:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Environment</span>
            </button>
          </div>

          {/* Variables Editor */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between bg-[#0f172a]">
            {selectedEnv ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-[#182234] border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
                  />

                  <button
                    onClick={() =>
                      setVariables([
                        ...variables,
                        { key: '', value: '', isSecret: false, enabled: true },
                      ])
                    }
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-indigo-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Variable
                  </button>
                </div>

                {/* Variables Table */}
                <div className="space-y-2">
                  {variables.map((v, idx) => {
                    const isMasked = v.isSecret && !revealedSecrets[idx];
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={v.enabled !== false}
                          onChange={(e) => {
                            const updated = [...variables];
                            updated[idx].enabled = e.target.checked;
                            setVariables(updated);
                          }}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-[#182234]"
                        />

                        {/* Key */}
                        <input
                          type="text"
                          placeholder="Variable name"
                          value={v.key}
                          onChange={(e) => {
                            const updated = [...variables];
                            updated[idx].key = e.target.value;
                            setVariables(updated);
                          }}
                          className="w-36 bg-[#182234] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-indigo-300 font-semibold focus:outline-none focus:border-indigo-500"
                        />

                        {/* Value */}
                        <div className="flex-1 relative">
                          <input
                            type={isMasked ? 'password' : 'text'}
                            placeholder="Value"
                            value={v.value}
                            onChange={(e) => {
                              const updated = [...variables];
                              updated[idx].value = e.target.value;
                              setVariables(updated);
                            }}
                            className="w-full bg-[#182234] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 pr-8"
                          />
                          {v.isSecret && (
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedSecrets((prev) => ({
                                  ...prev,
                                  [idx]: !prev[idx],
                                }))
                              }
                              className="absolute right-2 top-2 text-slate-400 hover:text-white"
                            >
                              {revealedSecrets[idx] ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Secret Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...variables];
                            updated[idx].isSecret = !updated[idx].isSecret;
                            setVariables(updated);
                          }}
                          className={`p-1.5 rounded border transition-colors ${
                            v.isSecret
                              ? 'bg-amber-950/60 border-amber-700 text-amber-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                          title={v.isSecret ? 'Marked as Secret' : 'Mark as Secret'}
                        >
                          <Lock className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setVariables(variables.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {variables.length === 0 && (
                    <p className="text-xs text-slate-500 italic py-4">No variables defined yet.</p>
                  )}
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs">
                Select an environment from the list or create a new one.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Environment Dialog */}
      {isCreating && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#182234] border border-slate-700 rounded-xl p-5 w-full max-w-sm">
            <h4 className="text-xs font-bold text-white uppercase mb-3">Create Environment</h4>
            <form onSubmit={handleCreateNew} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Environment name (e.g. Production)"
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded px-3 py-2 text-xs text-white"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
