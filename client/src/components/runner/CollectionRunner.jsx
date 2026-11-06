import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import {
  Play,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export default function CollectionRunner() {
  const { collections, environments, activeEnvironment, showToast } = useWorkspace();
  const { user } = useAuth();

  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]?._id || '');
  const [selectedEnvId, setSelectedEnvId] = useState(activeEnvironment?._id || '');
  const [stopOnFailure, setStopOnFailure] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [testRunResult, setTestRunResult] = useState(null);

  async function handleRun() {
    if (!selectedCollectionId) {
      showToast('Please select a collection to run', 'error');
      return;
    }

    setIsRunning(true);
    setTestRunResult(null);

    try {
      const data = await api.createTestRun({
        collectionId: selectedCollectionId,
        environmentId: selectedEnvId || null,
        stopOnFailure,
        allowLocalOverride: user?.preferences?.allowLocalRequests,
      });

      setTestRunResult(data.testRun);
      showToast(
        data.testRun.status === 'completed'
          ? 'Collection run passed completely!'
          : 'Collection run finished with failures',
        data.testRun.status === 'completed' ? 'success' : 'warning'
      );
    } catch (err) {
      showToast('Run execution failed: ' + err.message, 'error');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f172a] p-6 space-y-6">
      {/* Header & Config Panel */}
      <div className="bg-[#182234] border border-slate-700/80 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Collection Test Runner</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute test suites sequentially, validate assertions, and capture regression metrics
            </p>
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning || !selectedCollectionId}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>{isRunning ? 'Running Suite...' : 'Run Collection'}</span>
          </button>
        </div>

        {/* Configuration Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-700/60">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Select Collection
            </label>
            <select
              value={selectedCollectionId}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {collections.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.requestCount || 0} requests)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Active Environment
            </label>
            <select
              value={selectedEnvId}
              onChange={(e) => setSelectedEnvId(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">No Environment</option>
              {environments.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="stopOnFail"
              checked={stopOnFailure}
              onChange={(e) => setStopOnFailure(e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-[#0f172a]"
            />
            <label htmlFor="stopOnFail" className="text-xs text-slate-300 cursor-pointer select-none">
              Stop suite immediately upon first failure
            </label>
          </div>
        </div>
      </div>

      {/* Results View */}
      {testRunResult && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#182234] border border-slate-700/80 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Requests</span>
              <div className="text-xl font-bold text-white mt-1">
                {testRunResult.passedRequests} / {testRunResult.totalRequests}
              </div>
              <span className="text-[10px] text-slate-500">Total executed</span>
            </div>

            <div className="bg-[#182234] border border-slate-700/80 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Assertions</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {testRunResult.passedAssertions} / {testRunResult.totalAssertions}
              </div>
              <span className="text-[10px] text-slate-500">Rules passed</span>
            </div>

            <div className="bg-[#182234] border border-slate-700/80 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Duration</span>
              <div className="text-xl font-bold text-white mt-1">
                {testRunResult.durationMs} ms
              </div>
              <span className="text-[10px] text-slate-500">Total runtime</span>
            </div>

            <div className="bg-[#182234] border border-slate-700/80 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Contract Status</span>
              <div
                className={`text-xl font-bold mt-1 ${
                  testRunResult.contractFindingsSummary?.breaking > 0
                    ? 'text-red-400'
                    : 'text-emerald-400'
                }`}
              >
                {testRunResult.contractFindingsSummary?.breaking || 0} Breaking
              </div>
              <span className="text-[10px] text-slate-500">
                {testRunResult.contractFindingsSummary?.nonBreaking || 0} Non-breaking
              </span>
            </div>
          </div>

          {/* Detailed Request List */}
          <div className="bg-[#182234] border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-700/80 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Execution Breakdown
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {testRunResult.results?.length} Steps Completed
              </span>
            </div>

            <div className="divide-y divide-slate-800">
              {testRunResult.results?.map((res, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0f172a] text-slate-300 border border-slate-700">
                        {res.method}
                      </span>
                      <span className="font-semibold text-xs text-white">{res.requestName}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                      <span>{res.statusCode}</span>
                      <span>{res.durationMs}ms</span>
                    </div>
                  </div>

                  {/* Assertion pills */}
                  {res.assertions && res.assertions.length > 0 && (
                    <div className="ml-7 flex flex-wrap gap-2 mt-2">
                      {res.assertions.map((a, aIdx) => (
                        <div
                          key={aIdx}
                          className={`text-[11px] px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                            a.passed
                              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                              : 'bg-red-950/40 border-red-800/60 text-red-300'
                          }`}
                        >
                          <span>{a.name}</span>
                          {!a.passed && <span className="text-[10px] opacity-75">({a.message})</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error if present */}
                  {res.error && (
                    <div className="ml-7 mt-2 p-2 bg-red-950/50 border border-red-800 rounded text-xs text-red-300 font-mono">
                      {res.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
