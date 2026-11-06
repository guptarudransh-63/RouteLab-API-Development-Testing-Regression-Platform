import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { api } from '../../api/client.js';
import {
  Copy,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  HardDrive,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export default function ResponseViewer() {
  const { responseState, activeRequest, showToast } = useWorkspace();
  const [activeTab, setActiveTab] = useState('body'); // 'body' | 'headers' | 'tests' | 'contract'
  const [bodyFormat, setBodyFormat] = useState('pretty'); // 'pretty' | 'raw'
  const [searchQuery, setSearchQuery] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  if (!responseState) {
    return (
      <div className="h-full bg-[#141d2e] flex flex-col items-center justify-center text-slate-500 p-8 select-none">
        <Clock className="w-10 h-10 mb-3 text-slate-600 stroke-[1.5]" />
        <h3 className="text-sm font-semibold text-slate-400">Ready to Send</h3>
        <p className="text-xs text-slate-500 max-w-xs text-center mt-1">
          Click 'Send' or press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">Cmd+Enter</kbd> to inspect API response, test assertions, and contract changes.
        </p>
      </div>
    );
  }

  const { response, assertions, contractReport } = responseState;
  const isSuccess = response.statusCode >= 200 && response.statusCode < 300;
  const isSSRF = response.isSSRF || response.statusText === 'SSRF Blocked';

  // Format response size
  function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function handleCopy() {
    const text =
      typeof response.body === 'object'
        ? JSON.stringify(response.body, null, 2)
        : String(response.rawBody || '');
    navigator.clipboard.writeText(text);
    showToast('Response body copied to clipboard', 'info');
  }

  function handleDownload() {
    const text =
      typeof response.body === 'object'
        ? JSON.stringify(response.body, null, 2)
        : String(response.rawBody || '');
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Promote response to baseline snapshot
  async function handlePromoteBaseline() {
    if (!activeRequest?._id) {
      showToast('Save request first to capture baseline snapshot', 'info');
      return;
    }
    setIsCapturing(true);
    try {
      await api.captureSnapshot(activeRequest._id, {
        response,
        makeBaseline: true,
        notes: 'User approved baseline from response viewer',
      });
      showToast('Response promoted as official contract baseline!', 'success');
    } catch (err) {
      showToast('Failed to promote baseline: ' + err.message, 'error');
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#141d2e] border-l border-slate-700/80 select-text">
      {/* Top Response Meta Bar */}
      <div className="p-3 border-b border-slate-700/80 bg-[#182234] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Status Pill */}
          <div
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm ${
              isSSRF
                ? 'bg-amber-950/80 text-amber-300 border border-amber-700'
                : isSuccess
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700'
                : response.statusCode === 0
                ? 'bg-red-950/80 text-red-300 border border-red-700'
                : 'bg-red-950/80 text-red-300 border border-red-700'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : isSSRF ? (
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            )}
            <span>
              {response.statusCode ? `${response.statusCode} ${response.statusText}` : response.statusText || 'Error'}
            </span>
          </div>

          {/* Timing */}
          <div className="flex items-center gap-1 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{response.durationMs} ms</span>
          </div>

          {/* Size */}
          <div className="flex items-center gap-1 text-xs font-mono text-slate-300">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatSize(response.responseSize)}</span>
          </div>
        </div>

        {/* Action buttons: copy, download */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-slate-700/80 text-slate-400 hover:text-white rounded transition-colors"
            title="Copy response body"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-slate-700/80 text-slate-400 hover:text-white rounded transition-colors"
            title="Download JSON response"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Response Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-700/80 px-4 bg-[#141d2e] text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('body')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'body'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Body
          </button>

          <button
            onClick={() => setActiveTab('headers')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'headers'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Headers ({Object.keys(response.headers || {}).length})
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'tests'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Test Results</span>
            {assertions?.total > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  assertions.failed === 0
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-red-950 text-red-400 border border-red-800'
                }`}
              >
                {assertions.passed}/{assertions.total}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('contract')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'contract'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Contract Diff</span>
            {contractReport?.findings?.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  contractReport.hasBreakingChanges
                    ? 'bg-red-950 text-red-400 border border-red-800 animate-pulse'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {contractReport.findings.length}
              </span>
            )}
          </button>
        </div>

        {/* Format toggle when in Body tab */}
        {activeTab === 'body' && (
          <div className="flex items-center gap-1 bg-[#0f172a] p-0.5 rounded border border-slate-700">
            <button
              onClick={() => setBodyFormat('pretty')}
              className={`px-2 py-0.5 text-[10px] rounded font-medium ${
                bodyFormat === 'pretty' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pretty
            </button>
            <button
              onClick={() => setBodyFormat('raw')}
              className={`px-2 py-0.5 text-[10px] rounded font-medium ${
                bodyFormat === 'raw' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Raw
            </button>
          </div>
        )}
      </div>

      {/* Response Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        {/* BODY TAB */}
        {activeTab === 'body' && (
          <div>
            {response.error && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 font-sans text-xs">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>Execution Error</span>
                </div>
                <div>{response.error}</div>
              </div>
            )}

            {response.body !== null && response.body !== undefined ? (
              <pre className="text-slate-200 whitespace-pre-wrap break-all leading-relaxed bg-[#0f172a] p-4 rounded-lg border border-slate-700/60 font-mono">
                {bodyFormat === 'pretty' && typeof response.body === 'object'
                  ? JSON.stringify(response.body, null, 2)
                  : String(response.rawBody || '')}
              </pre>
            ) : (
              !response.error && (
                <div className="text-slate-500 italic py-6 text-center font-sans">
                  Empty response body (HTTP {response.statusCode})
                </div>
              )
            )}
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === 'headers' && (
          <div className="border border-slate-700 rounded-lg overflow-hidden bg-[#0f172a]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#182234] border-b border-slate-700 text-slate-400">
                  <th className="p-2.5 font-semibold">Header</th>
                  <th className="p-2.5 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                {Object.entries(response.headers || {}).map(([key, val]) => (
                  <tr key={key} className="hover:bg-slate-800/40">
                    <td className="p-2.5 text-indigo-300 font-semibold">{key}</td>
                    <td className="p-2.5 text-slate-200 break-all">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TEST RESULTS TAB */}
        {activeTab === 'tests' && (
          <div className="space-y-3 font-sans">
            <div className="flex items-center justify-between bg-[#182234] p-3 rounded-lg border border-slate-700">
              <span className="text-xs font-semibold text-slate-300">Test Execution Summary</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-400 font-medium">Passed: {assertions?.passed || 0}</span>
                <span className="text-red-400 font-medium">Failed: {assertions?.failed || 0}</span>
              </div>
            </div>

            <div className="space-y-2">
              {(assertions?.results || []).map((res, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
                    res.passed
                      ? 'bg-emerald-950/20 border-emerald-800/50 text-slate-200'
                      : 'bg-red-950/20 border-red-800/50 text-slate-200'
                  }`}
                >
                  {res.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-white">{res.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{res.message}</div>
                    {!res.passed && (
                      <div className="mt-1 text-[11px] font-mono text-red-300 bg-red-950/40 p-1.5 rounded border border-red-800/40">
                        Expected: {String(res.expected)} | Actual: {String(res.actual)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(!assertions?.results || assertions.results.length === 0) && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No automated test assertions were executed for this request.
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTRACT DIFF TAB */}
        {activeTab === 'contract' && (
          <div className="space-y-4 font-sans">
            <div className="bg-[#182234] p-3 rounded-lg border border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>API Contract Change Detection</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Comparison of response schema and status against the approved baseline
                </p>
              </div>

              <button
                onClick={handlePromoteBaseline}
                disabled={isCapturing}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Promote as New Baseline</span>
              </button>
            </div>

            {/* Findings List */}
            {contractReport?.findings?.length > 0 ? (
              <div className="space-y-2">
                {contractReport.findings.map((f, idx) => {
                  const isBreaking = f.severity === 'breaking';
                  const isPotBreaking = f.severity === 'potentially_breaking';
                  const isNonBreaking = f.severity === 'non_breaking';

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                        isBreaking
                          ? 'bg-red-950/25 border-red-800/60'
                          : isPotBreaking
                          ? 'bg-amber-950/25 border-amber-800/60'
                          : 'bg-emerald-950/25 border-emerald-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
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
                        <span className="font-mono text-[11px] text-slate-400">{f.jsonPath}</span>
                      </div>

                      <div className="text-slate-200 font-medium">{f.explanation}</div>

                      {(f.previousValue !== undefined || f.newValue !== undefined) && (
                        <div className="font-mono text-[11px] text-slate-300 flex items-center gap-2 pt-1">
                          <span className="text-red-400 line-through">
                            Prev: {String(f.previousValue ?? 'none')}
                          </span>
                          <span>→</span>
                          <span className="text-emerald-400">
                            New: {String(f.newValue ?? 'none')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 border border-slate-700/60 rounded-xl bg-[#0f172a] p-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-slate-200">Contract Matches Baseline</h4>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  No breaking or structural changes detected against the approved baseline contract snapshot.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
