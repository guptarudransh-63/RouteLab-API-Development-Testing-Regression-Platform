import request from 'supertest';
import app from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { User } from '../../src/models/User.js';
import { Collection } from '../../src/models/Collection.js';
import { RequestDefinition } from '../../src/models/RequestDefinition.js';
import { Environment } from '../../src/models/Environment.js';

describe('RouteLab Integration API Tests', () => {
  let authCookie;
  let testUserId;
  let testCollectionId;
  let testEnvId;
  let testHttpServer;
  let serverPort;

  beforeAll(async () => {
    await connectDB();
    // Clean test user if exists
    await User.deleteMany({ email: 'integration_tester@routelab.dev' });

    // Start ephemeral server for mock requests
    await new Promise((resolve) => {
      testHttpServer = app.listen(0, () => {
        serverPort = testHttpServer.address().port;
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    if (testHttpServer) {
      await new Promise((resolve) => testHttpServer.close(resolve));
    }
    if (testUserId) {
      await User.deleteOne({ _id: testUserId });
      await Collection.deleteMany({ owner: testUserId });
      await RequestDefinition.deleteMany({ owner: testUserId });
      await Environment.deleteMany({ owner: testUserId });
    }
    await disconnectDB();
  }, 30000);

  describe('Authentication Flow', () => {
    it('POST /api/v1/auth/register should create a user and set HttpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Integration Tester',
          email: 'integration_tester@routelab.dev',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('integration_tester@routelab.dev');
      testUserId = res.body.user.id;

      // Extract cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      authCookie = cookies[0];
    });

    it('GET /api/v1/auth/me should return authenticated user profile', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('integration_tester@routelab.dev');
    });

    it('GET /api/v1/collections should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/collections');
      expect(res.status).toBe(401);
    });
  });

  describe('Collections & Environments', () => {
    it('POST /api/v1/collections should create a new collection', async () => {
      const res = await request(app)
        .post('/api/v1/collections')
        .set('Cookie', authCookie)
        .send({
          name: 'Test Integration Collection',
          description: 'A collection for integration testing',
        });

      expect(res.status).toBe(201);
      expect(res.body.collection.name).toBe('Test Integration Collection');
      testCollectionId = res.body.collection._id;
    });

    it('POST /api/v1/environments should create an environment', async () => {
      const res = await request(app)
        .post('/api/v1/environments')
        .set('Cookie', authCookie)
        .send({
          name: 'Integration Test Env',
          variables: [
            { key: 'baseUrl', value: `http://127.0.0.1:${serverPort}/api/v1/mock`, isSecret: false, enabled: true },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.environment.name).toBe('Integration Test Env');
      testEnvId = res.body.environment._id;
    });
  });

  describe('Request Creation & Execution', () => {
    let requestId;

    it('POST /api/v1/requests/collections/:id/requests should create a request definition', async () => {
      const res = await request(app)
        .post(`/api/v1/requests/collections/${testCollectionId}/requests`)
        .set('Cookie', authCookie)
        .send({
          name: 'Get Mock Orders',
          method: 'GET',
          url: '{{baseUrl}}/orders',
          tests: [
            {
              id: 't_1',
              name: 'Status is 200',
              target: 'statusCode',
              operator: 'equals',
              expectedValue: 200,
              enabled: true,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.request.name).toBe('Get Mock Orders');
      requestId = res.body.request._id;
    });

    it('POST /api/v1/requests/:id/execute should execute request safely and run assertions', async () => {
      const res = await request(app)
        .post(`/api/v1/requests/${requestId}/execute`)
        .set('Cookie', authCookie)
        .send({
          environmentId: testEnvId,
          allowLocalOverride: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.response.statusCode).toBe(200);
      expect(res.body.assertions.passed).toBe(1);
    });
  });

  describe('OpenAPI Import', () => {
    it('POST /api/v1/openapi/import should parse an OpenAPI spec and create collection + requests', async () => {
      const sampleSpec = {
        openapi: '3.0.0',
        info: { title: 'Test Swagger Petstore', version: '1.0' },
        paths: {
          '/pets': {
            get: { summary: 'List all pets', responses: { '200': { description: 'OK' } } },
            post: { summary: 'Create pet', responses: { '201': { description: 'Created' } } },
          },
        },
      };

      const res = await request(app)
        .post('/api/v1/openapi/import')
        .set('Cookie', authCookie)
        .send({ specContent: JSON.stringify(sampleSpec) });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.endpointCount).toBe(2);
    });
  });
});
