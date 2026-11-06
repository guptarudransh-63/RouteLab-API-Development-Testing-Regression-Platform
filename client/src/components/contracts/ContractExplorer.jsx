import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { api } from '../../api/client.js';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function ContractExplorer() {
  const { collections, showToast } = useWorkspace();
  const [findings, setFindings] = useState([]);
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [suppressModalFinding, setSuppressModalFinding] = useState(null);
  const [suppressReason, setSuppressReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFindings();
  }, [selectedSeverity]);

  async function loadFindings() {
    setLoading(true);
    try {
      const query = selectedSeverity ? `severity=${selectedSeverity}` : '';
      const data = await api.getContractFindings(query);
      setFindings(data.findings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSuppress(e) {
    e.preventDefault();
    if (!suppressModalFinding) return;

    try {
      await api.suppressFinding(suppressModalFinding._id, { reason: suppressReason });
      showToast('Contract finding suppressed', 'info');
      setSuppressModalFinding(null);
      setSuppressReason('');
      loadFindings();
    } catch (err) {
      showToast('Failed to suppress finding: ' + err.message, 'error');
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f172a] p-6 space-y-6">
      {/* Header */}
      <div className="bg-[#182234] border border-slate-700/80 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span>API Contract Change Explorer</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Contract snapshots, breaking schema classifications, and baseline management
          </p>
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Severities</option>
            <option value="breaking">Breaking Changes Only</option>
            <option value="potentially_breaking">Potentially Breaking</option>
            <option value="non_breaking">Non-Breaking Extensions</option>
            <option value="performance_regression">Performance Regressions</option>
          </select>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {findings.map((f) => {
          const isBreaking = f.severity === 'breaking';
          const isPotBreaking = f.severity === 'potentially_breaking';
          const isSuppressed = f.status === 'suppressed';

          return (
            <div
              key={f._id}
              className={`bg-[#182234] border rounded-xl p-4 shadow-md transition-all ${
                isSuppressed
                  ? 'border-slate-800 opacity-60'
                  : isBreaking
                  ? 'border-red-800/80'
                  : isPotBreaking
                  ? 'border-amber-800/80'
                  : 'border-slate-700/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isBreaking
                        ? 'bg-red-600 text-white'
                        : isPotBreaking
                        ? 'bg-amber-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {f.severity.replace('_', ' ')}
                  </span>
                  <span className="font-semibold text-xs text-white">
                    {f.requestId?.name || 'Request'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">({f.jsonPath})</span>
                </div>

                <div className="flex items-center gap-2">
                  {isSuppressed ? (
                    <span className="text-[11px] text-slate-500 italic">
                      Suppressed ({f.suppressionReason})
                    </span>
                  ) : (
                    <button
                      onClick={() => setSuppressModalFinding(f)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 font-medium"
                    >
                      Suppress Change
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-200 mt-1">{f.explanation}</div>

              {(f.previousValue !== undefined || f.newValue !== undefined) && (
                <div className="mt-2 text-[11px] font-mono text-slate-300 bg-[#0f172a] p-2 rounded border border-slate-800 flex items-center gap-3">
                  <span className="text-red-400 line-through">
                    Baseline: {String(f.previousValue ?? 'undefined')}
                  </span>
                  <span>→</span>
                  <span className="text-emerald-400">
                    Candidate: {String(f.newValue ?? 'undefined')}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {findings.length === 0 && (
          <div className="text-center py-12 bg-[#182234] border border-slate-700/80 rounded-2xl p-8">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">No Contract Violations Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              All tested API responses comply with their respective approved baseline schemas.
            </p>
          </div>
        )}
      </div>

      {/* Suppress Modal */}
      {suppressModalFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#182234] border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-sm font-bold text-white mb-2">Suppress Contract Finding</h3>
            <p className="text-xs text-slate-400 mb-4">
              Suppressing this change will mark it as expected and ignore it during future regression comparisons.
            </p>
            <form onSubmit={handleSuppress} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Reason for Suppression
                </label>
                <textarea
                  required
                  placeholder="e.g. Approved deprecation of field 'amount' in v2 release"
                  value={suppressReason}
                  onChange={(e) => setSuppressReason(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-xs text-white resize-none"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSuppressModalFinding(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                >
                  Confirm Suppression
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
