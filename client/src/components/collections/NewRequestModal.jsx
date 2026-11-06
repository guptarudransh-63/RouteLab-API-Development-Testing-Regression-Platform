import React, { useState } from 'react';
import { api } from '../../api/client.js';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { PlusCircle, X } from 'lucide-react';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function NewRequestModal({ collectionId, onClose }) {
  const { setActiveRequest, refreshCollections, showToast } = useWorkspace();
  const [name, setName] = useState('');
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('{{baseUrl}}/');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    try {
      const data = await api.createRequest(collectionId, {
        name,
        method,
        url,
        params: [],
        headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
        tests: [
          {
            id: `t_${Date.now().toString(36)}`,
            name: 'Status code is 200',
            target: 'statusCode',
            operator: 'equals',
            expectedValue: '200',
            enabled: true,
          },
        ],
      });

      showToast('Request created', 'success');
      await refreshCollections();
      setActiveRequest(data.request);
      onClose();
    } catch (err) {
      showToast('Failed to create request: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#182234] border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/80 mb-4">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Create New Request</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Request Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Get User Orders"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-indigo-400 focus:outline-none focus:border-indigo-500"
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                URL Template
              </label>
              <input
                type="text"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/80">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md disabled:opacity-50"
            >
              Add Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
