import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client.js';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [activeView, setActiveView] = useState('editor'); // 'editor' | 'runner' | 'workflows' | 'contracts' | 'regression' | 'openapi'
  const [collections, setCollections] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [activeEnvironment, setActiveEnvironment] = useState(null);
  const [activeRequest, setActiveRequest] = useState(null);
  const [activeCollection, setActiveCollection] = useState(null);
  const [responseState, setResponseState] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [colData, envData] = await Promise.all([api.getCollections(), api.getEnvironments()]);
      setCollections(colData.collections || []);
      setEnvironments(envData.environments || []);

      const defEnv = (envData.environments || []).find((e) => e.isDefault) || envData.environments?.[0];
      setActiveEnvironment(defEnv || null);

      // If collections exist, select the first request by default
      if (colData.collections?.length > 0) {
        const firstCol = colData.collections[0];
        setActiveCollection(firstCol);
        const colDetails = await api.getCollection(firstCol._id);
        if (colDetails.requests?.length > 0) {
          setActiveRequest(colDetails.requests[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    }
  }

  function showToast(message, type = 'info') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function refreshCollections() {
    const data = await api.getCollections();
    setCollections(data.collections || []);
  }

  async function refreshEnvironments() {
    const data = await api.getEnvironments();
    setEnvironments(data.environments || []);
    if (activeEnvironment) {
      const updated = data.environments.find((e) => e._id === activeEnvironment._id);
      setActiveEnvironment(updated || null);
    }
  }

  return (
    <WorkspaceContext.Provider
      value={{
        activeView,
        setActiveView,
        collections,
        setCollections,
        refreshCollections,
        environments,
        setEnvironments,
        refreshEnvironments,
        activeEnvironment,
        setActiveEnvironment,
        activeRequest,
        setActiveRequest,
        activeCollection,
        setActiveCollection,
        responseState,
        setResponseState,
        isExecuting,
        setIsExecuting,
        toast,
        showToast,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}
