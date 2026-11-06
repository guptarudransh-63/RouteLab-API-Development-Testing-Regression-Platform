import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import {
  GitBranch,
  Play,
  Plus,
  Trash2,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Key,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function WorkflowBuilder() {
  const { collections, activeEnvironment, showToast } = useWorkspace();
  const { user } = useAuth();

  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [runResult, setRunResult] = useState(null);

  // New workflow modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');

  // All available requests across collections
  const [availableRequests, setAvailableRequests] = useState([]);

  useEffect(() => {
    loadWorkflows();
    loadAvailableRequests();
  }, []);

  async function loadWorkflows() {
    try {
      const data = await api.getWorkflows();
      setWorkflows(data.workflows || []);
      if (data.workflows?.length > 0 && !selectedWorkflow) {
        setSelectedWorkflow(data.workflows[0]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAvailableRequests() {
    try {
      const colData = await api.getCollections();
      const reqList = [];
      for (const col of colData.collections || []) {
        const details = await api.getCollection(col._id);
        for (const r of details.requests || []) {
          reqList.push({ ...r, collectionName: col.name });
        }
      }
      setAvailableRequests(reqList);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRunWorkflow() {
    if (!selectedWorkflow) return;
    setIsExecuting(true);
    setRunResult(null);

    try {
      const res = await api.runWorkflow(selectedWorkflow._id, {
        environmentId: activeEnvironment?._id || null,
        allowLocalOverride: user?.preferences?.allowLocalRequests,
      });

      setRunResult(res);
      showToast(
        res.success
          ? 'Workflow executed successfully with chained tokens!'
          : 'Workflow stopped due to step failure',
        res.success ? 'success' : 'warning'
      );
    } catch (err) {
      showToast('Workflow execution error: ' + err.message, 'error');
    } finally {
      setIsExecuting(false);
    }
  }

  async function handleCreateWorkflow(e) {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;

    try {
      const res = await api.createWorkflow({
        name: newWorkflowName,
        steps: [],
      });
      showToast('Workflow created', 'success');
      setWorkflows([...workflows, res.workflow]);
      setSelectedWorkflow(res.workflow);
      setShowCreateModal(false);
      setNewWorkflowName('');
    } catch (err) {
      showToast('Failed to create workflow: ' + err.message, 'error');
    }
  }

  async function handleAddStep(requestId) {
    if (!selectedWorkflow || !requestId) return;
    const updatedSteps = [
      ...(selectedWorkflow.steps || []),
      {
        requestId,
        order: (selectedWorkflow.steps || []).length,
        stopOnFailure: true,
        extract: [],
      },
    ];

    try {
      const res = await api.updateWorkflow(selectedWorkflow._id, { steps: updatedSteps });
      setSelectedWorkflow(res.workflow);
      showToast('Step added to workflow', 'info');
      loadWorkflows();
    } catch (err) {
      showToast('Failed to add step: ' + err.message, 'error');
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0f172a]">
      {/* Workflow Sidebar */}
      <div className="w-64 bg-[#141d2e] border-r border-slate-700/80 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Workflows</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded"
            title="Create Workflow"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1 flex-1 overflow-y-auto">
          {workflows.map((wf) => (
            <button
              key={wf._id}
              onClick={() => {
                setSelectedWorkflow(wf);
                setRunResult(null);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                selectedWorkflow?._id === wf._id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <GitBranch className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{wf.name}</span>
              </div>
              <span className="text-[10px] font-mono opacity-75">{wf.steps?.length || 0}</span>
            </button>
          ))}
          {workflows.length === 0 && (
            <p className="text-xs text-slate-500 italic py-4">No workflows created yet.</p>
          )}
        </div>
      </div>

      {/* Main Workflow View */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {selectedWorkflow ? (
          <>
            {/* Header */}
            <div className="bg-[#182234] border border-slate-700/80 rounded-2xl p-6 shadow-xl flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-indigo-400" />
                  <span>{selectedWorkflow.name}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chained multi-step execution. Extracted variables propagate dynamically across steps.
                </p>
              </div>

              <button
                onClick={handleRunWorkflow}
                disabled={isExecuting || !selectedWorkflow.steps?.length}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{isExecuting ? 'Executing Workflow...' : 'Run Workflow'}</span>
              </button>
            </div>

            {/* Steps Sequence */}
            <div className="space-y-4 max-w-2xl">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Execution Steps Sequence
              </h3>

              {(selectedWorkflow.steps || []).map((step, idx) => {
                const req = step.requestId;
                return (
                  <div key={idx} className="space-y-2">
                    <div className="bg-[#182234] border border-slate-700/80 rounded-xl p-4 flex items-center justify-between shadow-md">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-700 text-indigo-300 flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#0f172a] text-indigo-300 border border-slate-700">
                              {req?.method || 'REQ'}
                            </span>
                            <span className="text-xs font-semibold text-white">
                              {req?.name || 'Unknown Request'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-1">
                            {req?.url || '{{baseUrl}}'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-slate-400">
                          {step.stopOnFailure ? 'Stop on fail: Yes' : 'Stop on fail: No'}
                        </span>
                      </div>
                    </div>

                    {idx < selectedWorkflow.steps.length - 1 && (
                      <div className="flex justify-center">
                        <ArrowDown className="w-4 h-4 text-indigo-400" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Step Dropdown */}
              <div className="pt-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddStep(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="bg-[#182234] border border-slate-700 rounded-lg px-3 py-2 text-xs text-indigo-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="" disabled>
                    + Add step from saved requests...
                  </option>
                  {availableRequests.map((r) => (
                    <option key={r._id} value={r._id}>
                      [{r.collectionName}] {r.method} {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Run Results and Propagated Variables */}
            {runResult && (
              <div className="bg-[#182234] border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                  <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Workflow Run Output</span>
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      runResult.success
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-red-950 text-red-300 border border-red-800'
                    }`}
                  >
                    {runResult.success ? 'PASSED' : 'FAILED'}
                  </span>
                </div>

                {/* Extracted Variables Output */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Accumulated Chained Variables</span>
                  </h4>
                  <div className="bg-[#0f172a] p-3 rounded-lg border border-slate-700/80 font-mono text-xs text-slate-200">
                    {Object.keys(runResult.finalRuntimeVariables || {}).length > 0 ? (
                      <pre>{JSON.stringify(runResult.finalRuntimeVariables, null, 2)}</pre>
                    ) : (
                      <span className="text-slate-500 italic">No variables extracted</span>
                    )}
                  </div>
                </div>

                {/* Steps Details */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300">Steps Result</h4>
                  {(runResult.stepResults || []).map((step, idx) => (
                    <div
                      key={idx}
                      className="bg-[#0f172a] p-3 rounded-lg border border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {step.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="font-semibold text-white">{step.requestName}</span>
                      </div>
                      <span className="font-mono text-slate-400">
                        HTTP {step.statusCode} ({step.durationMs}ms)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <GitBranch className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-400">No Workflow Selected</h3>
            <p className="text-xs text-slate-500 mt-1">Select a workflow or create a new one.</p>
          </div>
        )}
      </div>

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#182234] border border-slate-700 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-bold text-white mb-3">Create New Workflow</h3>
            <form onSubmit={handleCreateWorkflow} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Workflow Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Auth & Checkout Flow"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
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
