import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import {
  Shield,
  Layers,
  PlaySquare,
  GitBranch,
  FileCode2,
  BarChart3,
  Globe,
  Settings,
  LogOut,
  ChevronDown,
  Lock,
  Radio,
  Check,
  AlertTriangle,
} from 'lucide-react';

export default function Header({ onOpenEnvModal, onOpenOpenApiModal }) {
  const { user, logout, updatePreferences } = useAuth();
  const {
    activeView,
    setActiveView,
    environments,
    activeEnvironment,
    setActiveEnvironment,
    showToast,
  } = useWorkspace();

  const [envDropdownOpen, setEnvDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const allowLocal = user?.preferences?.allowLocalRequests || false;

  async function toggleLocalRequests() {
    const nextVal = !allowLocal;
    try {
      await updatePreferences({ allowLocalRequests: nextVal });
      showToast(
        nextVal
          ? 'Local network requests enabled (Development Mode)'
          : 'Zero-trust SSRF strict defense restored',
        nextVal ? 'warning' : 'info'
      );
    } catch {
      showToast('Failed to update SSRF preferences', 'error');
    }
  }

  const views = [
    { id: 'editor', label: 'Request Editor', icon: PlaySquare },
    { id: 'runner', label: 'Collection Runner', icon: Layers },
    { id: 'workflows', label: 'Chained Workflows', icon: GitBranch },
    { id: 'contracts', label: 'Contract Baseline', icon: Shield },
    { id: 'regression', label: 'Regression Triage', icon: BarChart3 },
  ];

  return (
    <header className="h-14 bg-[#182234] border-b border-slate-700/80 px-4 flex items-center justify-between select-none z-30 relative">
      {/* Brand & Views */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-tight">RouteLab</span>
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-mono bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 rounded">
              v1.0
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav className="flex items-center gap-1 bg-[#0f172a] p-1 rounded-lg border border-slate-700/60">
          {views.map((v) => {
            const Icon = v.icon;
            const active = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{v.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right Controls: OpenAPI, Environment, SSRF mode, Profile */}
      <div className="flex items-center gap-3">
        {/* OpenAPI Import Button */}
        <button
          onClick={onOpenOpenApiModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-colors"
          title="Import OpenAPI 3.0 / Swagger specification"
        >
          <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">OpenAPI Import</span>
        </button>

        {/* Local Network SSRF Toggle */}
        <button
          onClick={toggleLocalRequests}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            allowLocal
              ? 'bg-amber-950/40 border-amber-600/60 text-amber-300 hover:bg-amber-900/40'
              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title={
            allowLocal
              ? 'Localhost / private network requests permitted (Dev mode)'
              : 'SSRF Zero-Trust strict defense active (blocking local & cloud metadata)'
          }
        >
          {allowLocal ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          ) : (
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span className="hidden md:inline">
            {allowLocal ? 'Localhost Allowed' : 'SSRF Shield Active'}
          </span>
        </button>

        {/* Environment Dropdown */}
        <div className="relative">
          <button
            onClick={() => setEnvDropdownOpen(!envDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#0f172a] hover:bg-slate-800/90 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span className="max-w-[120px] truncate">
              {activeEnvironment ? activeEnvironment.name : 'No Environment'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {envDropdownOpen && (
            <div className="absolute right-0 mt-1 w-56 bg-[#182234] border border-slate-700 rounded-xl shadow-xl py-1 z-50">
              <div className="px-3 py-2 border-b border-slate-700/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Environments
              </div>
              <button
                onClick={() => {
                  setActiveEnvironment(null);
                  setEnvDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between"
              >
                <span>No Environment</span>
                {!activeEnvironment && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </button>
              {environments.map((env) => (
                <button
                  key={env._id}
                  onClick={() => {
                    setActiveEnvironment(env);
                    setEnvDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between"
                >
                  <span className="truncate">{env.name}</span>
                  {activeEnvironment?._id === env._id && (
                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-2" />
                  )}
                </button>
              ))}
              <div className="border-t border-slate-700/60 mt-1 pt-1">
                <button
                  onClick={() => {
                    setEnvDropdownOpen(false);
                    onOpenEnvModal();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-indigo-400 hover:bg-slate-800 flex items-center gap-1.5 font-medium"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Manage Environments</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-700 flex items-center justify-center text-xs font-bold text-indigo-300 hover:border-indigo-500 transition-colors"
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-1 w-52 bg-[#182234] border border-slate-700 rounded-xl shadow-xl py-2 z-50">
              <div className="px-3 py-2 border-b border-slate-700/60">
                <div className="text-xs font-bold text-white truncate">{user?.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
              </div>
              <button
                onClick={() => {
                  setProfileDropdownOpen(false);
                  logout();
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 flex items-center gap-2 transition-colors mt-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
