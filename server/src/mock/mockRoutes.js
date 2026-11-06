import express from 'express';

const router = express.Router();

/**
 * Mock Auth Login endpoint
 */
router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required',
    });
  }

  // Returns auth token to be chained in workflows
  res.status(200).json({
    success: true,
    message: 'Login successful',
    token: `routelab_mock_jwt_${Date.now()}_abc123xyz`,
    expiresIn: 3600,
    user: {
      id: 'usr_882194',
      name: 'Dev Tester',
      email,
      role: 'developer',
      createdAt: '2025-01-15T08:30:00.000Z',
    },
  });
});

/**
 * Mock User Profile endpoint (Requires Bearer token)
 */
router.get('/users/profile', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Bearer token is missing or malformed',
    });
  }

  res.status(200).json({
    success: true,
    user: {
      id: 'usr_882194',
      name: 'Dev Tester',
      email: 'tester@routelab.dev',
      role: 'developer',
      organization: 'RouteLab Engineering',
      tier: 'enterprise',
      activeProjectsCount: 14,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: `req_${Math.random().toString(36).substring(2, 10)}`,
    },
  });
});

/**
 * Mock Orders endpoint
 */
router.get('/orders', (req, res) => {
  res.status(200).json({
    success: true,
    total: 3,
    page: 1,
    orders: [
      {
        id: 'ord_101',
        customer: 'Acme Corp',
        amount: 299.99,
        currency: 'USD',
        status: 'completed',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord_102',
        customer: 'Stark Industries',
        amount: 1450.0,
        currency: 'USD',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord_103',
        customer: 'Wayne Enterprises',
        amount: 890.5,
        currency: 'USD',
        status: 'shipped',
        createdAt: new Date().toISOString(),
      },
    ],
  });
});

/**
 * Mock Single Order endpoint
 * Supports query params:
 * ?simulateRegression=breaking (removes 'amount' field, changes status from 'completed' to number or error)
 * ?delay=500 (simulates latency regression)
 */
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { simulateRegression, delay } = req.query;

  if (delay) {
    await new Promise((resolve) => setTimeout(resolve, Number(delay)));
  }

  // Simulated breaking contract change
  if (simulateRegression === 'breaking') {
    return res.status(200).json({
      success: true,
      order: {
        id,
        customer: 'Acme Corp',
        // 'amount' is removed! (Breaking change)
        // 'status' changed from string to number! (Breaking type change)
        status: 500,
        currency: 'USD',
        createdAt: new Date().toISOString(),
      },
      warning: 'SIMULATED BREAKING CHANGE DETECTED',
    });
  }

  // Normal expected contract
  res.status(200).json({
    success: true,
    order: {
      id,
      customer: 'Acme Corp',
      amount: 299.99,
      currency: 'USD',
      status: 'completed',
      itemCount: 4,
      createdAt: new Date().toISOString(),
    },
    meta: {
      cache: 'HIT',
      servedBy: 'mock-cluster-1',
    },
  });
});

/**
 * Mock Echo endpoint
 */
router.all('/echo', (req, res) => {
  res.status(200).json({
    message: 'Echo successful',
    method: req.method,
    headers: req.headers,
    query: req.query,
    body: req.body,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
});

export default router;
