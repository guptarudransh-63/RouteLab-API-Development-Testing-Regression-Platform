import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './routes/authRoutes.js';
import collectionRoutes from './routes/collectionRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import environmentRoutes from './routes/environmentRoutes.js';
import testRunRoutes from './routes/testRunRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import openapiRoutes from './routes/openapiRoutes.js';
import mockRoutes from './mock/mockRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: [clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

app.use(cookieParser(process.env.COOKIE_SECRET || 'routelab_cookie_secret_salt_12345'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', platform: 'RouteLab', time: new Date().toISOString() });
});

// Swagger documentation
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'RouteLab API',
    version: '1.0.0',
    description: 'API for RouteLab Developer Platform — Request Execution, Test Runs, and Contract Change Detection',
  },
  servers: [{ url: '/api/v1', description: 'RouteLab V1 API' }],
  paths: {
    '/auth/register': { post: { summary: 'Register a new user' } },
    '/auth/login': { post: { summary: 'Login and set HttpOnly auth cookie' } },
    '/auth/logout': { post: { summary: 'Clear auth cookie' } },
    '/auth/me': { get: { summary: 'Get current user profile' } },
    '/collections': {
      get: { summary: 'List user collections' },
      post: { summary: 'Create collection' },
    },
    '/requests/{id}/execute': { post: { summary: 'Execute HTTP request safely with SSRF defense' } },
    '/test-runs': {
      get: { summary: 'List test runs' },
      post: { summary: 'Run all collection requests and evaluate assertions' },
    },
    '/contract-findings': { get: { summary: 'Get classified breaking and non-breaking contract findings' } },
    '/workflows/{id}/run': { post: { summary: 'Execute chained workflow with variable extraction' } },
    '/mock/echo': { all: { summary: 'Built-in echo endpoint' } },
    '/mock/orders/{id}': { get: { summary: 'Mock orders endpoint supporting ?simulateRegression=breaking' } },
  },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Mount REST API routes under /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/collections', collectionRoutes);
app.use('/api/v1/requests', requestRoutes);
app.use('/api/v1/environments', environmentRoutes);
app.use('/api/v1/test-runs', testRunRoutes);
app.use('/api/v1/contracts', contractRoutes);
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/openapi', openapiRoutes);
app.use('/api/v1/mock', mockRoutes);

// Centralized error handler
app.use(errorHandler);

export default app;
