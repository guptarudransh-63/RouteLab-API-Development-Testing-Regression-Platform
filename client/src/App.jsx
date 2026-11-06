import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { useWorkspace } from './context/WorkspaceContext.jsx';
import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import RequestEditor from './components/request/RequestEditor.jsx';
import ResponseViewer from './components/response/ResponseViewer.jsx';
import CollectionRunner from './components/runner/CollectionRunner.jsx';
import WorkflowBuilder from './components/workflows/WorkflowBuilder.jsx';
import ContractExplorer from './components/contracts/ContractExplorer.jsx';
import RegressionDashboard from './components/regression/RegressionDashboard.jsx';
import AuthModal from './components/auth/AuthModal.jsx';
import EnvironmentModal from './components/environments/EnvironmentModal.jsx';
import OpenApiModal from './components/openapi/OpenApiModal.jsx';
import NewCollectionModal from './components/collections/NewCollectionModal.jsx';
import NewRequestModal from './components/collections/NewRequestModal.jsx';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const { activeView, toast } = useWorkspace();

  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [openApiModalOpen, setOpenApiModalOpen] = useState(false);
  const [newColModalOpen, setNewColModalOpen] = useState(false);
  const [newReqColId, setNewReqColId] = useState(null);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0f172a] flex flex-col items-center justify-center text-slate-400">
        <span className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent mb-4" />
        <span className="text-xs font-mono">Initializing RouteLab Engine...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f172a] overflow-hidden">
      {/* Top Header */}
      <Header
        onOpenEnvModal={() => setEnvModalOpen(true)}
        onOpenOpenApiModal={() => setOpenApiModalOpen(true)}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {activeView === 'editor' && (
          <>
            <Sidebar
              onNewCollection={() => setNewColModalOpen(true)}
              onNewRequest={(colId) => setNewReqColId(colId)}
            />
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
              <RequestEditor />
              <ResponseViewer />
            </div>
          </>
        )}

        {activeView === 'runner' && <CollectionRunner />}
        {activeView === 'workflows' && <WorkflowBuilder />}
        {activeView === 'contracts' && <ContractExplorer />}
        {activeView === 'regression' && <RegressionDashboard />}
      </div>

      {/* Modals */}
      {envModalOpen && <EnvironmentModal onClose={() => setEnvModalOpen(false)} />}
      {openApiModalOpen && <OpenApiModal onClose={() => setOpenApiModalOpen(false)} />}
      {newColModalOpen && <NewCollectionModal onClose={() => setNewColModalOpen(false)} />}
      {newReqColId && (
        <NewRequestModal
          collectionId={newReqColId}
          onClose={() => setNewReqColId(null)}
        />
      )}

      {/* Floating Notification Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-medium animate-bounce bg-[#182234] border-slate-700 text-white">
          {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
          {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-indigo-400" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default AppContent;
