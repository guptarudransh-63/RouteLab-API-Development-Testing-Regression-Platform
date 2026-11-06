import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Calendar,
  Layers,
  ArrowRight,
  GitCompare,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';

export default function RegressionDashboard() {
  const { showToast } = useWorkspace();
  const [stats, setStats] = useState(null);
  const [testRuns, setTestRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsData, runsData] = await Promise.all([
        api.getRegressionStats(),
        api.getTestRuns('limit=10'),
      ]);
      setStats(statsData.stats);
      setTestRuns(runsData.testRuns || []);
      if (runsData.testRuns?.length > 0) {
        setSelectedRun(runsData.testRuns[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompare(runId) {
    try {
      const data = await api.compareTestRuns(runId, {});
      setComparison(data.comparison);
      showToast('Compared against previous run', 'info');
    } catch (err) {
      showToast('Comparison failed: ' + err.message, 'error');
    }
  }

  function handleExportCsv() {
    if (!testRuns.length) return;
    const rows = [
      ['Run ID', 'Collection', 'Environment', 'Passed', 'Failed', 'Duration(ms)', 'Date'],
      ...testRuns.map((r) => [
        r._id,
        r.collectionId?.name || 'Collection',
        r.environmentName || 'None',
        r.passedRequests,
        r.failedRequests,
        r.durationMs,
        new Date(r.createdAt).toISOString(),
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `routelab_regression_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported regression CSV report', 'success');
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f172a] p-6 space-y-6">
      {/* Dashboard Top Header */}
      <div className="bg-[#182234] border border-slate-700/80 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <span>Regression Analysis & Test Health</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor test suite regressions, breaking contract changes, and latency shifts across runs
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5 text-indigo-400" />
          <span>Export Regression Report</span>
        </button>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#182234] border border-slate-700/80 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Test Runs</span>
          <div className="text-2xl font-bold text-white mt-1">{stats?.totalRuns || 0}</div>
          <span className="text-[10px] text-slate-500">Tracked in database</span>
        </div>

        <div className="bg-[#182234] border border-slate-700/80 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Suite Pass Rate</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{stats?.passRate || 0}%</div>
          <span className="text-[10px] text-slate-500">Successful executions</span>
        </div>

        <div className="bg-[#182234] border border-slate-700/80 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Recent Runs Evaluated</span>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{testRuns.length}</div>
          <span className="text-[10px] text-slate-500">Latest test runs</span>
        </div>

        <div className="bg-[#182234] border border-slate-700/80 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Regression Defense</span>
          <div className="text-2xl font-bold text-indigo-400 mt-1">Active</div>
          <span className="text-[10px] text-slate-500">Contract & assertion checks</span>
        </div>
      </div>

      {/* Recharts Analytics Charts */}
      {stats?.trend && stats.trend.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Passed vs Failed Tests Chart */}
          <div className="bg-[#182234] border border-slate-700/80 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <span>Test Pass / Fail History</span>
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.trend}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="passed" name="Passed Requests" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Failed Requests" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Latency & Breaking Changes Trend Chart */}
          <div className="bg-[#182234] border border-slate-700/80 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span>Execution Duration (ms) Trend</span>
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.trend}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="durationMs"
                    name="Duration (ms)"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="breakingChanges"
                    name="Breaking Changes"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Run-to-Run Comparison / Triage View */}
      <div className="bg-[#182234] border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-indigo-400" />
              <span>Run-to-Run Regression Triage</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Compare candidate test run against prior baseline to flag newly introduced regressions
            </p>
          </div>

          {selectedRun && (
            <button
              onClick={() => handleCompare(selectedRun._id)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare Selected Run With Previous</span>
            </button>
          )}
        </div>

        {/* Comparison Details if available */}
        {comparison && (
          <div className="p-4 rounded-xl bg-[#0f172a] border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Comparison Findings</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  comparison.isRegressed
                    ? 'bg-red-950 text-red-300 border border-red-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {comparison.isRegressed ? 'REGRESSION DETECTED' : 'CLEAN RUN (NO REGRESSIONS)'}
              </span>
            </div>

            {/* Regressed Tests */}
            {comparison.regressions?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-red-400 uppercase">
                  Newly Failed Tests:
                </span>
                {comparison.regressions.map((r, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded bg-red-950/30 border border-red-800/50 text-xs text-red-200 flex items-center justify-between"
                  >
                    <span>{r.requestName}</span>
                    <span className="text-[11px] font-mono text-red-400">{r.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Fixed Tests */}
            {comparison.improvements?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase">
                  Fixed / Passing Tests:
                </span>
                {comparison.improvements.map((im, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded bg-emerald-950/30 border border-emerald-800/50 text-xs text-emerald-200"
                  >
                    {im.message}
                  </div>
                ))}
              </div>
            )}

            {/* Latency Increases */}
            {comparison.latencyChanges?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-amber-400 uppercase">
                  Latency Degradations:
                </span>
                {comparison.latencyChanges.map((lc, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200 flex items-center justify-between"
                  >
                    <span>{lc.requestName}</span>
                    <span className="font-mono">{lc.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent Runs Table */}
        <div className="border border-slate-700/80 rounded-xl overflow-hidden bg-[#0f172a]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#182234] border-b border-slate-700 text-slate-400">
                <th className="p-3 font-semibold">Date & Time</th>
                <th className="p-3 font-semibold">Collection</th>
                <th className="p-3 font-semibold">Environment</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Passed / Total</th>
                <th className="p-3 font-semibold">Duration</th>
                <th className="p-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {testRuns.map((r) => {
                const isSelected = selectedRun?._id === r._id;
                return (
                  <tr
                    key={r._id}
                    onClick={() => setSelectedRun(r)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-950/40 text-white' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="p-3 font-mono text-[11px] text-slate-400">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 font-semibold">{r.collectionId?.name || 'Collection'}</td>
                    <td className="p-3 text-slate-400">{r.environmentName || 'None'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.status === 'completed'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono">
                      {r.passedRequests} / {r.totalRequests}
                    </td>
                    <td className="p-3 font-mono">{r.durationMs}ms</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRun(r);
                          handleCompare(r._id);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-indigo-300 font-medium"
                      >
                        Compare
                      </button>
                    </td>
                  </tr>
                );
              })}
              {testRuns.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                    No test runs recorded yet. Execute collections from the Collection Runner tab to start building history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
