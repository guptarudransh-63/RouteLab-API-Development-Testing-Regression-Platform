const BASE_URL = '/api/v1';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
    credentials: 'include', // sends and receives HttpOnly auth cookies
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { text: await response.text() };
  }

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me'),
  updatePreferences: (body) => request('/auth/preferences', { method: 'PATCH', body }),

  // Collections
  getCollections: () => request('/collections'),
  getCollection: (id) => request(`/collections/${id}`),
  createCollection: (body) => request('/collections', { method: 'POST', body }),
  updateCollection: (id, body) => request(`/collections/${id}`, { method: 'PATCH', body }),
  deleteCollection: (id) => request(`/collections/${id}`, { method: 'DELETE' }),
  importCollection: (body) => request('/collections/import', { method: 'POST', body }),
  exportCollectionUrl: (id) => `${BASE_URL}/collections/${id}/export`,

  // Requests
  getRequest: (id) => request(`/requests/${id}`),
  createRequest: (collectionId, body) => request(`/requests/collections/${collectionId}/requests`, { method: 'POST', body }),
  updateRequest: (id, body) => request(`/requests/${id}`, { method: 'PATCH', body }),
  deleteRequest: (id) => request(`/requests/${id}`, { method: 'DELETE' }),
  duplicateRequest: (id) => request(`/requests/${id}/duplicate`, { method: 'POST' }),
  executeRequest: (id, body) => request(`/requests/${id}/execute`, { method: 'POST', body }),
  executeAdHoc: (body) => request('/requests/execute-ad-hoc', { method: 'POST', body }),

  // Environments
  getEnvironments: () => request('/environments'),
  createEnvironment: (body) => request('/environments', { method: 'POST', body }),
  updateEnvironment: (id, body) => request(`/environments/${id}`, { method: 'PATCH', body }),
  deleteEnvironment: (id) => request(`/environments/${id}`, { method: 'DELETE' }),

  // Test Runs & Regression
  createTestRun: (body) => request('/test-runs', { method: 'POST', body }),
  getTestRuns: (params = '') => request(`/test-runs${params ? `?${params}` : ''}`),
  getTestRun: (id) => request(`/test-runs/${id}`),
  compareTestRuns: (id, body) => request(`/test-runs/${id}/compare`, { method: 'POST', body }),
  getRegressionStats: () => request('/test-runs/regression-stats'),

  // Contracts
  getSnapshots: (requestId) => request(`/contracts/requests/${requestId}/snapshots`),
  captureSnapshot: (requestId, body) => request(`/contracts/requests/${requestId}/snapshots`, { method: 'POST', body }),
  promoteBaseline: (snapshotId) => request(`/contracts/snapshots/${snapshotId}/promote-baseline`, { method: 'POST' }),
  compareSnapshot: (snapshotId) => request(`/contracts/snapshots/${snapshotId}/compare`, { method: 'POST' }),
  getContractFindings: (query = '') => request(`/contracts/contract-findings${query ? `?${query}` : ''}`),
  suppressFinding: (id, body) => request(`/contracts/contract-findings/${id}/suppress`, { method: 'PATCH', body }),

  // Workflows
  getWorkflows: () => request('/workflows'),
  getWorkflow: (id) => request(`/workflows/${id}`),
  createWorkflow: (body) => request('/workflows', { method: 'POST', body }),
  updateWorkflow: (id, body) => request(`/workflows/${id}`, { method: 'PATCH', body }),
  deleteWorkflow: (id) => request(`/workflows/${id}`, { method: 'DELETE' }),
  runWorkflow: (id, body) => request(`/workflows/${id}/run`, { method: 'POST', body }),

  // OpenAPI
  importOpenApi: (body) => request('/openapi/import', { method: 'POST', body }),
  compareOpenApi: (body) => request('/openapi/compare', { method: 'POST', body }),
};
