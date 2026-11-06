import React, { useState } from 'react';
import { api } from '../../api/client.js';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { FileCode2, Link2, Sparkles, X, AlertCircle } from 'lucide-react';

export default function OpenApiModal({ onClose }) {
  const { refreshCollections, showToast, setActiveView } = useWorkspace();
  const [mode, setMode] = useState('raw'); // 'raw' | 'url'
  const [rawSpec, setRawSpec] = useState('');
  const [specUrl, setSpecUrl] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sample OpenAPI spec for instant trial
  const sampleSpec = `{
  "openapi": "3.0.0",
  "info": {
    "title": "Swagger Petstore Demo",
    "version": "1.0.0",
    "description": "Sample API spec for testing RouteLab OpenAPI Importer"
  },
  "servers": [
    { "url": "http://localhost:5001/api/v1/mock" }
  ],
  "paths": {
    "/orders": {
      "get": {
        "summary": "List all customer orders",
        "responses": {
          "200": { "description": "Successful operation" }
        }
      }
    },
    "/orders/101": {
      "get": {
        "summary": "Get order by ID",
        "responses": {
          "200": { "description": "Order details returned" }
        }
      }
    }
  }
}`;

  async function handleImport(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        collectionName: collectionName || undefined,
        specContent: mode === 'raw' ? rawSpec : undefined,
        specUrl: mode === 'url' ? specUrl : undefined,
      };

      const res = await api.importOpenApi(payload);
      showToast(res.message, 'success');
      await refreshCollections();
      setActiveView('editor');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to import OpenAPI spec');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#182234] border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-700/80 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <FileCode2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Import OpenAPI Specification</h3>
              <p className="text-[11px] text-slate-400">
                Supports OpenAPI 3.0 & Swagger in JSON or YAML format
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-lg text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Custom Collection Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Petstore Production API"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-700 pb-2 text-xs">
            <button
              type="button"
              onClick={() => setMode('raw')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                mode === 'raw' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Paste JSON / YAML
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                mode === 'url' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Import from URL
            </button>
          </div>

          {mode === 'raw' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Paste specification document</span>
                <button
                  type="button"
                  onClick={() => setRawSpec(sampleSpec)}
                  className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Load Sample Spec
                </button>
              </div>
              <textarea
                required
                rows={10}
                placeholder="Paste OpenAPI JSON or YAML spec here..."
                value={rawSpec}
                onChange={(e) => setRawSpec(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Specification URL (Protected by RouteLab SSRF Shield)
              </label>
              <input
                type="url"
                required
                placeholder="https://petstore.swagger.io/v2/swagger.json"
                value={specUrl}
                onChange={(e) => setSpecUrl(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/80">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Import & Generate Collection</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
