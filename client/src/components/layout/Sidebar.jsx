import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { api } from '../../api/client.js';
import {
  Folder,
  FolderOpen,
  FileCode,
  Plus,
  MoreVertical,
  Trash2,
  Copy,
  Download,
  Search,
  ChevronRight,
  ChevronDown,
  Edit2,
} from 'lucide-react';

const METHOD_COLORS = {
  GET: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80',
  POST: 'text-amber-400 bg-amber-950/60 border-amber-800/80',
  PUT: 'text-blue-400 bg-blue-950/60 border-blue-800/80',
  PATCH: 'text-purple-400 bg-purple-950/60 border-purple-800/80',
  DELETE: 'text-red-400 bg-red-950/60 border-red-800/80',
  HEAD: 'text-slate-400 bg-slate-900 border-slate-700',
  OPTIONS: 'text-teal-400 bg-teal-950 border-teal-800',
};

export default function Sidebar({ onNewCollection, onNewRequest }) {
  const {
    collections,
    refreshCollections,
    activeRequest,
    setActiveRequest,
    activeCollection,
    setActiveCollection,
    showToast,
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});
  const [collectionRequests, setCollectionRequests] = useState({});
  const [activeMenu, setActiveMenu] = useState(null); // { type: 'col' | 'req', id }

  function toggleFolder(id) {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleSelectCollection(col) {
    setActiveCollection(col);
    if (!collectionRequests[col._id]) {
      try {
        const details = await api.getCollection(col._id);
        setCollectionRequests((prev) => ({ ...prev, [col._id]: details.requests || [] }));
        if (details.requests?.length > 0 && !activeRequest) {
          setActiveRequest(details.requests[0]);
        }
      } catch (err) {
        showToast('Failed to load collection requests', 'error');
      }
    }
  }

  async function handleDeleteCollection(id, e) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this collection and all its requests?')) return;
    try {
      await api.deleteCollection(id);
      showToast('Collection deleted', 'info');
      await refreshCollections();
      if (activeCollection?._id === id) {
        setActiveCollection(null);
        setActiveRequest(null);
      }
    } catch {
      showToast('Failed to delete collection', 'error');
    }
  }

  async function handleDeleteRequest(reqId, colId, e) {
    e.stopPropagation();
    if (!confirm('Delete this request?')) return;
    try {
      await api.deleteRequest(reqId);
      showToast('Request deleted', 'info');
      const updated = (collectionRequests[colId] || []).filter((r) => r._id !== reqId);
      setCollectionRequests((prev) => ({ ...prev, [colId]: updated }));
      if (activeRequest?._id === reqId) {
        setActiveRequest(updated[0] || null);
      }
    } catch {
      showToast('Failed to delete request', 'error');
    }
  }

  async function handleDuplicateRequest(reqId, colId, e) {
    e.stopPropagation();
    try {
      const res = await api.duplicateRequest(reqId);
      showToast('Request duplicated', 'success');
      const updated = [...(collectionRequests[colId] || []), res.request];
      setCollectionRequests((prev) => ({ ...prev, [colId]: updated }));
      setActiveRequest(res.request);
    } catch {
      showToast('Failed to duplicate request', 'error');
    }
  }

  function handleExportCollection(id, e) {
    e.stopPropagation();
    window.open(api.exportCollectionUrl(id), '_blank');
  }

  return (
    <aside className="w-72 bg-[#141d2e] border-r border-slate-700/80 flex flex-col h-[calc(100vh-3.5rem)] select-none">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-slate-700/60 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Collections</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewCollection}
            className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors"
            title="Create New Collection"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-2 border-b border-slate-700/40">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Filter requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700/70 rounded-md pl-8 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {collections.length === 0 ? (
          <div className="text-center py-10 px-4">
            <Folder className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 mb-2">No collections yet</p>
            <button
              onClick={onNewCollection}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              + Create Collection
            </button>
          </div>
        ) : (
          collections.map((col) => {
            const isColActive = activeCollection?._id === col._id;
            const requests = collectionRequests[col._id] || [];
            const isExpanded = isColActive || expandedFolders[col._id];

            return (
              <div key={col._id} className="rounded-md overflow-hidden">
                {/* Collection item */}
                <div
                  onClick={() => {
                    handleSelectCollection(col);
                    toggleFolder(col._id);
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs group transition-colors ${
                    isColActive ? 'bg-indigo-950/40 text-indigo-200' : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="font-semibold truncate">{col.name}</span>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCollection(col);
                        onNewRequest(col._id);
                      }}
                      className="p-1 hover:text-white"
                      title="Add Request"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleExportCollection(col._id, e)}
                      className="p-1 hover:text-white"
                      title="Export Collection"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteCollection(col._id, e)}
                      className="p-1 hover:text-red-400"
                      title="Delete Collection"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Collection Requests */}
                {isExpanded && (
                  <div className="ml-4 pl-2 border-l border-slate-700/60 space-y-0.5 mt-0.5">
                    {requests.length === 0 ? (
                      <div className="text-[11px] text-slate-500 py-1 pl-2">
                        Empty collection. Click + to add request.
                      </div>
                    ) : (
                      requests
                        .filter((r) =>
                          searchQuery
                            ? r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              r.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              r.url.toLowerCase().includes(searchQuery.toLowerCase())
                            : true
                        )
                        .map((req) => {
                          const isReqActive = activeRequest?._id === req._id;
                          const methodClass =
                            METHOD_COLORS[req.method] || 'text-slate-400 bg-slate-800 border-slate-700';

                          return (
                            <div
                              key={req._id}
                              onClick={() => {
                                setActiveCollection(col);
                                setActiveRequest(req);
                              }}
                              className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs group transition-all ${
                                isReqActive
                                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                                  : 'text-slate-300 hover:bg-slate-800/70'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded border leading-none ${
                                    isReqActive
                                      ? 'bg-black/30 border-white/20 text-white'
                                      : methodClass
                                  }`}
                                >
                                  {req.method}
                                </span>
                                <span className="truncate">{req.name}</span>
                              </div>

                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                <button
                                  onClick={(e) => handleDuplicateRequest(req._id, col._id, e)}
                                  className="p-1 hover:text-white"
                                  title="Duplicate"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteRequest(req._id, col._id, e)}
                                  className="p-1 hover:text-red-300"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
