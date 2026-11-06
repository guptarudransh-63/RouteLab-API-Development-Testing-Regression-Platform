import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import {
  Send,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Layers,
  Code,
  Key,
  Sliders,
  FileJson,
  CheckSquare,
} from 'lucide-react';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function RequestEditor() {
  const {
    activeRequest,
    setActiveRequest,
    activeEnvironment,
    setResponseState,
    isExecuting,
    setIsExecuting,
    showToast,
    refreshCollections,
  } = useWorkspace();
  const { user } = useAuth();

  // Local editor state
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [activeTab, setActiveTab] = useState('params'); // 'params' | 'headers' | 'auth' | 'body' | 'tests' | 'extract'

  // Tab states
  const [params, setParams] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [auth, setAuth] = useState({ type: 'none', bearer: { token: '' }, basic: { username: '', password: '' }, apikey: { key: '', value: '', addTo: 'header' } });
  const [body, setBody] = useState({ type: 'none', raw: '', urlencoded: [] });
  const [tests, setTests] = useState([]);
  const [extractedVariables, setExtractedVariables] = useState([]);

  // Sync state when activeRequest changes
  useEffect(() => {
    if (activeRequest) {
      setMethod(activeRequest.method || 'GET');
      setUrl(activeRequest.url || '');
      setName(activeRequest.name || '');
      setParams(activeRequest.params || []);
      setHeaders(activeRequest.headers || []);
      setAuth(activeRequest.auth || { type: 'none' });
      setBody(activeRequest.body || { type: 'none', raw: '' });
      setTests(activeRequest.tests || []);
      setExtractedVariables(activeRequest.extractedVariables || []);
    } else {
      // Default scratchpad request
      setMethod('GET');
      setUrl('{{baseUrl}}/orders');
      setName('New Request');
      setParams([]);
      setHeaders([{ key: 'Content-Type', value: 'application/json', enabled: true }]);
      setAuth({ type: 'none' });
      setBody({ type: 'none', raw: '' });
      setTests([
        { id: 't_status', name: 'Status is 200', target: 'statusCode', operator: 'equals', expectedValue: '200', enabled: true },
      ]);
      setExtractedVariables([]);
    }
  }, [activeRequest]);

  // Execute request
  async function handleSend() {
    setIsExecuting(true);
    setResponseState(null);

    const requestPayload = {
      name,
      method,
      url,
      params,
      headers,
      auth,
      body,
      tests,
      extractedVariables,
    };

    try {
      let data;
      if (activeRequest?._id) {
        data = await api.executeRequest(activeRequest._id, {
          environmentId: activeEnvironment?._id || null,
          allowLocalOverride: user?.preferences?.allowLocalRequests,
        });
      } else {
        data = await api.executeAdHoc({
          scratchpadRequest: requestPayload,
          environmentId: activeEnvironment?._id || null,
          allowLocalOverride: user?.preferences?.allowLocalRequests,
        });
      }

      setResponseState(data);
      if (data.contractReport?.hasBreakingChanges) {
        showToast('Breaking Contract Change Detected!', 'warning');
      } else if (data.response?.success) {
        showToast('Request completed successfully', 'success');
      } else {
        showToast(`Request failed: ${data.response?.error || 'Network error'}`, 'error');
      }
    } catch (err) {
      setResponseState({
        response: {
          success: false,
          statusCode: 0,
          statusText: 'Execution Error',
          durationMs: 0,
          headers: {},
          body: null,
          error: err.message || 'Execution failed',
        },
        assertions: { total: 0, passed: 0, failed: 0, results: [] },
      });
      showToast(err.message, 'error');
    } finally {
      setIsExecuting(false);
    }
  }

  // Save changes
  async function handleSave() {
    if (!activeRequest?._id) {
      showToast('Select or create a request in a collection to save', 'info');
      return;
    }

    try {
      const updated = await api.updateRequest(activeRequest._id, {
        name,
        method,
        url,
        params,
        headers,
        auth,
        body,
        tests,
        extractedVariables,
      });
      setActiveRequest(updated.request);
      showToast('Request saved successfully', 'success');
      refreshCollections();
    } catch (err) {
      showToast('Failed to save request: ' + err.message, 'error');
    }
  }

  // Pretty JSON formatter
  function formatJsonBody() {
    try {
      const parsed = JSON.parse(body.raw);
      setBody({ ...body, raw: JSON.stringify(parsed, null, 2) });
      showToast('JSON formatted', 'info');
    } catch {
      showToast('Invalid JSON in body', 'error');
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0f172a] select-text">
      {/* Top Bar: Method, URL, Send, Save */}
      <div className="p-3 border-b border-slate-700/80 bg-[#182234] flex flex-wrap items-center gap-2">
        {/* Method Select */}
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-indigo-400 focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          {HTTP_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* URL Input */}
        <div className="flex-1 min-w-[280px] relative">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSend();
            }}
            placeholder="Enter request URL or {{variable}}"
            className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isExecuting}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/30 disabled:opacity-50"
        >
          {isExecuting ? (
            <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>Send</span>
        </button>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors"
          title="Save Request (Ctrl+S)"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-1 border-b border-slate-700/80 px-4 bg-[#141d2e] text-xs">
        {[
          { id: 'params', label: `Params (${params.filter((p) => p.enabled !== false && p.key).length})` },
          { id: 'headers', label: `Headers (${headers.filter((h) => h.enabled !== false && h.key).length})` },
          { id: 'auth', label: `Auth (${auth.type !== 'none' ? auth.type : 'none'})` },
          { id: 'body', label: `Body (${body.type !== 'none' ? body.type : 'none'})` },
          { id: 'tests', label: `Tests (${tests.length})` },
          { id: 'extract', label: `Extract (${extractedVariables.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* PARAMS TAB */}
        {activeTab === 'params' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Query Parameters</span>
              <button
                onClick={() => setParams([...params, { key: '', value: '', enabled: true }])}
                className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Param
              </button>
            </div>
            <div className="space-y-2">
              {params.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.enabled !== false}
                    onChange={(e) => {
                      const updated = [...params];
                      updated[idx].enabled = e.target.checked;
                      setParams(updated);
                    }}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-[#0f172a]"
                  />
                  <input
                    type="text"
                    placeholder="Key"
                    value={p.key}
                    onChange={(e) => {
                      const updated = [...params];
                      updated[idx].key = e.target.value;
                      setParams(updated);
                    }}
                    className="flex-1 bg-[#182234] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Value (or {{var}})"
                    value={p.value}
                    onChange={(e) => {
                      const updated = [...params];
                      updated[idx].value = e.target.value;
                      setParams(updated);
                    }}
                    className="flex-1 bg-[#182234] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => setParams(params.filter((_, i) => i !== idx))}
                    className="p-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {params.length === 0 && (
                <p className="text-xs text-slate-500 italic">No query parameters added.</p>
              )}
            </div>
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === 'headers' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Headers</span>
              <button
                onClick={() => setHeaders([...headers, { key: '', value: '', enabled: true }])}
                className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Header
              </button>
            </div>
            <div className="space-y-2">
              {headers.map((h, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={h.enabled !== false}
                    onChange={(e) => {
                      const updated = [...headers];
                      updated[idx].enabled = e.target.checked;
                      setHeaders(updated);
                    }}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-[#0f172a]"
                  />
                  <input
                    type="text"
                    placeholder="Header Name"
                    value={h.key}
                    onChange={(e) => {
                      const updated = [...headers];
                      updated[idx].key = e.target.value;
                      setHeaders(updated);
                    }}
                    className="flex-1 bg-[#182234] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Value (or {{var}})"
                    value={h.value}
                    onChange={(e) => {
                      const updated = [...headers];
                      updated[idx].value = e.target.value;
                      setHeaders(updated);
                    }}
                    className="flex-1 bg-[#182234] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => setHeaders(headers.filter((_, i) => i !== idx))}
                    className="p-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AUTH TAB */}
        {activeTab === 'auth' && (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">Auth Type</label>
              <select
                value={auth.type}
                onChange={(e) => setAuth({ ...auth, type: e.target.value })}
                className="w-full bg-[#182234] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="none">No Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="apikey">API Key</option>
              </select>
            </div>

            {auth.type === 'bearer' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Token (or {{token}})</label>
                <input
                  type="text"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={auth.bearer?.token || ''}
                  onChange={(e) =>
                    setAuth({ ...auth, bearer: { ...auth.bearer, token: e.target.value } })
                  }
                  className="w-full bg-[#182234] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {auth.type === 'basic' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={auth.basic?.username || ''}
                    onChange={(e) =>
                      setAuth({ ...auth, basic: { ...auth.basic, username: e.target.value } })
                    }
                    className="w-full bg-[#182234] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={auth.basic?.password || ''}
                    onChange={(e) =>
                      setAuth({ ...auth, basic: { ...auth.basic, password: e.target.value } })
                    }
                    className="w-full bg-[#182234] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {auth.type === 'apikey' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Key Name</label>
                    <input
                      type="text"
                      placeholder="X-API-Key"
                      value={auth.apikey?.key || ''}
                      onChange={(e) =>
                        setAuth({ ...auth, apikey: { ...auth.apikey, key: e.target.value } })
                      }
                      className="w-full bg-[#182234] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Add To</label>
                    <select
                      value={auth.apikey?.addTo || 'header'}
                      onChange={(e) =>
                        setAuth({ ...auth, apikey: { ...auth.apikey, addTo: e.target.value } })
                      }
                      className="w-full bg-[#182234] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="header">Header</option>
                      <option value="query">Query Params</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Value</label>
                  <input
                    type="text"
                    value={auth.apikey?.value || ''}
                    onChange={(e) =>
                      setAuth({ ...auth, apikey: { ...auth.apikey, value: e.target.value } })
                    }
                    className="w-full bg-[#182234] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* BODY TAB */}
        {activeTab === 'body' && (
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs">
                {['none', 'json', 'raw'].map((t) => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="bodyType"
                      value={t}
                      checked={body.type === t}
                      onChange={() => setBody({ ...body, type: t })}
                      className="text-indigo-600 bg-[#0f172a] border-slate-700 focus:ring-0"
                    />
                    <span className="capitalize">{t}</span>
                  </label>
                ))}
              </div>

              {body.type === 'json' && (
                <button
                  onClick={formatJsonBody}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-indigo-300 font-medium flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Format JSON
                </button>
              )}
            </div>

            {body.type !== 'none' ? (
              <textarea
                value={body.raw || ''}
                onChange={(e) => setBody({ ...body, raw: e.target.value })}
                placeholder={body.type === 'json' ? '{\n  "key": "value"\n}' : 'Raw payload...'}
                rows={10}
                className="w-full flex-1 bg-[#182234] border border-slate-700 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 resize-y"
              />
            ) : (
              <p className="text-xs text-slate-500 italic py-4">This request does not have a body.</p>
            )}
          </div>
        )}

        {/* TESTS TAB (Declarative Assertions) */}
        {activeTab === 'tests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase">Declarative Test Assertions</h4>
                <p className="text-[11px] text-slate-400">
                  Automated test checks evaluated against every response
                </p>
              </div>
              <button
                onClick={() =>
                  setTests([
                    ...tests,
                    {
                      id: `t_${Date.now().toString(36)}`,
                      name: 'Assertion',
                      target: 'statusCode',
                      property: '',
                      operator: 'equals',
                      expectedValue: '200',
                      enabled: true,
                    },
                  ])
                }
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add Assertion
              </button>
            </div>

            <div className="space-y-2">
              {tests.map((t, idx) => (
                <div
                  key={t.id || idx}
                  className="bg-[#182234] border border-slate-700 rounded-lg p-3 flex flex-wrap items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={t.enabled !== false}
                    onChange={(e) => {
                      const updated = [...tests];
                      updated[idx].enabled = e.target.checked;
                      setTests(updated);
                    }}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-[#0f172a]"
                  />

                  {/* Assertion Name */}
                  <input
                    type="text"
                    placeholder="Assertion description"
                    value={t.name}
                    onChange={(e) => {
                      const updated = [...tests];
                      updated[idx].name = e.target.value;
                      setTests(updated);
                    }}
                    className="flex-1 min-w-[150px] bg-[#0f172a] border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                  />

                  {/* Target */}
                  <select
                    value={t.target}
                    onChange={(e) => {
                      const updated = [...tests];
                      updated[idx].target = e.target.value;
                      setTests(updated);
                    }}
                    className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-indigo-300 font-mono"
                  >
                    <option value="statusCode">Status Code</option>
                    <option value="responseTime">Response Time (ms)</option>
                    <option value="jsonPath">JSON Path</option>
                    <option value="header">Header</option>
                    <option value="bodyText">Body Text</option>
                  </select>

                  {/* Property if jsonPath or header */}
                  {['jsonPath', 'header'].includes(t.target) && (
                    <input
                      type="text"
                      placeholder={t.target === 'jsonPath' ? 'e.g. data.id or token' : 'e.g. Content-Type'}
                      value={t.property || ''}
                      onChange={(e) => {
                        const updated = [...tests];
                        updated[idx].property = e.target.value;
                        setTests(updated);
                      }}
                      className="w-36 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white"
                    />
                  )}

                  {/* Operator */}
                  <select
                    value={t.operator}
                    onChange={(e) => {
                      const updated = [...tests];
                      updated[idx].operator = e.target.value;
                      setTests(updated);
                    }}
                    className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
                  >
                    <option value="equals">equals</option>
                    <option value="notEquals">not equals</option>
                    <option value="lessThan">less than</option>
                    <option value="greaterThan">greater than</option>
                    <option value="exists">exists</option>
                    <option value="notExists">does not exist</option>
                    <option value="contains">contains</option>
                    <option value="matchesRegex">matches regex</option>
                    <option value="isType">is type</option>
                  </select>

                  {/* Expected Value */}
                  {!['exists', 'notExists'].includes(t.operator) && (
                    <input
                      type="text"
                      placeholder="Expected value"
                      value={t.expectedValue || ''}
                      onChange={(e) => {
                        const updated = [...tests];
                        updated[idx].expectedValue = e.target.value;
                        setTests(updated);
                      }}
                      className="w-28 bg-[#0f172a] border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-white"
                    />
                  )}

                  <button
                    onClick={() => setTests(tests.filter((_, i) => i !== idx))}
                    className="p-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {tests.length === 0 && (
                <p className="text-xs text-slate-500 italic py-2">No assertions defined for this request.</p>
              )}
            </div>
          </div>
        )}

        {/* EXTRACTION TAB */}
        {activeTab === 'extract' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase">Response Variable Extraction</h4>
                <p className="text-[11px] text-slate-400">
                  Extract values from response into temporary workflow variables to pass into subsequent requests
                </p>
              </div>
              <button
                onClick={() =>
                  setExtractedVariables([
                    ...extractedVariables,
                    { varName: 'authToken', source: 'body', path: 'token', enabled: true },
                  ])
                }
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add Variable Extraction
              </button>
            </div>

            <div className="space-y-2">
              {extractedVariables.map((ev, idx) => (
                <div
                  key={idx}
                  className="bg-[#182234] border border-slate-700 rounded-lg p-3 flex flex-wrap items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={ev.enabled !== false}
                    onChange={(e) => {
                      const updated = [...extractedVariables];
                      updated[idx].enabled = e.target.checked;
                      setExtractedVariables(updated);
                    }}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-[#0f172a]"
                  />
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <span>Variable:</span>
                    <input
                      type="text"
                      placeholder="varName (e.g. authToken)"
                      value={ev.varName}
                      onChange={(e) => {
                        const updated = [...extractedVariables];
                        updated[idx].varName = e.target.value;
                        setExtractedVariables(updated);
                      }}
                      className="bg-[#0f172a] border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-indigo-300 font-semibold"
                    />
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <span>From:</span>
                    <select
                      value={ev.source}
                      onChange={(e) => {
                        const updated = [...extractedVariables];
                        updated[idx].source = e.target.value;
                        setExtractedVariables(updated);
                      }}
                      className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
                    >
                      <option value="body">Response Body (JSON Path)</option>
                      <option value="header">Header</option>
                      <option value="statusCode">Status Code</option>
                    </select>
                  </div>

                  {ev.source !== 'statusCode' && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 flex-1">
                      <span>Path:</span>
                      <input
                        type="text"
                        placeholder="e.g. token or user.id"
                        value={ev.path || ''}
                        onChange={(e) => {
                          const updated = [...extractedVariables];
                          updated[idx].path = e.target.value;
                          setExtractedVariables(updated);
                        }}
                        className="flex-1 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white"
                      />
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setExtractedVariables(extractedVariables.filter((_, i) => i !== idx))
                    }
                    className="p-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {extractedVariables.length === 0 && (
                <p className="text-xs text-slate-500 italic py-2">No variable extractions defined.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
