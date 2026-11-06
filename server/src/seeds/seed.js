import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Collection } from '../models/Collection.js';
import { RequestDefinition } from '../models/RequestDefinition.js';
import { Environment } from '../models/Environment.js';
import { ContractSnapshot } from '../models/ContractSnapshot.js';
import { ContractFinding } from '../models/ContractFinding.js';
import { TestRun } from '../models/TestRun.js';
import { Workflow } from '../models/Workflow.js';
import { AuditLog } from '../models/AuditLog.js';
import { inferResponseSchema } from '../services/contractEngine.js';

async function seed() {
  try {
    await connectDB();
    console.log('[Seed] Cleaning existing seed data...');

    await User.deleteMany({ email: 'demo@routelab.dev' });
    const demoUser = await User.create({
      name: 'Demo Engineer',
      email: 'demo@routelab.dev',
      password: 'RouteLabDemo123!',
      role: 'admin',
      preferences: {
        theme: 'dark',
        allowLocalRequests: true,
      },
    });

    console.log(`[Seed] Created demo user: ${demoUser.email} / RouteLabDemo123!`);

    // Clean user resources
    await Collection.deleteMany({ owner: demoUser._id });
    await RequestDefinition.deleteMany({ owner: demoUser._id });
    await Environment.deleteMany({ owner: demoUser._id });
    await ContractSnapshot.deleteMany({ owner: demoUser._id });
    await ContractFinding.deleteMany({ owner: demoUser._id });
    await TestRun.deleteMany({ owner: demoUser._id });
    await Workflow.deleteMany({ owner: demoUser._id });
    await AuditLog.deleteMany({ userId: demoUser._id });

    // 1. Environments
    const localEnv = await Environment.create({
      owner: demoUser._id,
      name: 'Local Mock Environment',
      isDefault: true,
      variables: [
        { key: 'baseUrl', value: 'http://localhost:5001/api/v1/mock', isSecret: false, enabled: true },
        { key: 'apiKey', value: 'local-test-key-9988', isSecret: false, enabled: true },
        { key: 'tenantId', value: 'tenant-local-dev', isSecret: false, enabled: true },
      ],
    });

    const stagingEnv = await Environment.create({
      owner: demoUser._id,
      name: 'Staging Environment',
      isDefault: false,
      variables: [
        { key: 'baseUrl', value: 'https://staging.api.routelab.dev', isSecret: false, enabled: true },
        { key: 'apiKey', value: 'stg_secret_99881122', isSecret: true, enabled: true },
        { key: 'tenantId', value: 'tenant-staging-corp', isSecret: false, enabled: true },
      ],
    });

    const prodEnv = await Environment.create({
      owner: demoUser._id,
      name: 'Production US-East',
      isDefault: false,
      variables: [
        { key: 'baseUrl', value: 'https://api.routelab.dev', isSecret: false, enabled: true },
        { key: 'apiKey', value: 'live_sec_prod_443900', isSecret: true, enabled: true },
        { key: 'tenantId', value: 'tenant-prod-main', isSecret: false, enabled: true },
      ],
    });

    console.log('[Seed] Created Environments');

    // 2. Collection 1: Auth & User Flow
    const authCollection = await Collection.create({
      owner: demoUser._id,
      name: 'Auth & Petstore Chained Flow',
      description: 'End-to-end chained API requests demonstrating variable extraction and Bearer token propagation',
      folders: [
        { id: 'f_auth', name: 'Authentication', parentId: null },
        { id: 'f_orders', name: 'Order Management', parentId: null },
      ],
      variables: [{ key: 'serviceTag', value: 'v1.4-beta', isSecret: false }],
    });

    const loginReq = await RequestDefinition.create({
      owner: demoUser._id,
      collectionId: authCollection._id,
      folderId: 'f_auth',
      name: '1. POST Login & Extract Token',
      description: 'Authenticates and extracts bearer token to pass downstream',
      method: 'POST',
      url: '{{baseUrl}}/auth/login',
      headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
      auth: { type: 'none' },
      body: {
        type: 'json',
        raw: JSON.stringify({ email: 'tester@routelab.dev', password: 'secretPassword123' }, null, 2),
      },
      tests: [
        {
          id: 't_status_200',
          name: 'Status code is 200',
          target: 'statusCode',
          operator: 'equals',
          expectedValue: '200',
          enabled: true,
        },
        {
          id: 't_token_exists',
          name: 'Token exists in response body',
          target: 'jsonPath',
          property: 'token',
          operator: 'exists',
          enabled: true,
        },
      ],
      extractedVariables: [
        { varName: 'authToken', source: 'body', path: 'token', enabled: true },
        { varName: 'userId', source: 'body', path: 'user.id', enabled: true },
      ],
      order: 0,
    });

    const profileReq = await RequestDefinition.create({
      owner: demoUser._id,
      collectionId: authCollection._id,
      folderId: 'f_auth',
      name: '2. GET User Profile (Chained Token)',
      description: 'Fetches user details using Bearer token extracted from step 1',
      method: 'GET',
      url: '{{baseUrl}}/users/profile',
      headers: [],
      auth: {
        type: 'bearer',
        bearer: { token: '{{authToken}}' },
      },
      body: { type: 'none' },
      tests: [
        {
          id: 't_prof_200',
          name: 'Status code is 200',
          target: 'statusCode',
          operator: 'equals',
          expectedValue: '200',
          enabled: true,
        },
        {
          id: 't_user_tier',
          name: 'User tier is enterprise',
          target: 'jsonPath',
          property: 'user.tier',
          operator: 'equals',
          expectedValue: 'enterprise',
          enabled: true,
        },
      ],
      order: 1,
    });

    const ordersReq = await RequestDefinition.create({
      owner: demoUser._id,
      collectionId: authCollection._id,
      folderId: 'f_orders',
      name: '3. GET Orders List',
      description: 'Fetches list of orders',
      method: 'GET',
      url: '{{baseUrl}}/orders',
      headers: [],
      auth: { type: 'none' },
      body: { type: 'none' },
      tests: [
        {
          id: 't_orders_count',
          name: 'Status code is 200',
          target: 'statusCode',
          operator: 'equals',
          expectedValue: '200',
          enabled: true,
        },
        {
          id: 't_orders_curr',
          name: 'Currency is USD',
          target: 'jsonPath',
          property: 'orders[0].currency',
          operator: 'equals',
          expectedValue: 'USD',
          enabled: true,
        },
      ],
      order: 2,
    });

    // 3. Collection 2: E-Commerce & Payments
    const ecomCollection = await Collection.create({
      owner: demoUser._id,
      name: 'E-Commerce & Stripe Payments API',
      description: 'Product catalog browsing, shopping cart mutation, payment intent generation, and webhook verification',
      folders: [
        { id: 'f_catalog', name: 'Product Catalog', parentId: null },
        { id: 'f_checkout', name: 'Checkout & Payments', parentId: null },
      ],
      variables: [{ key: 'currency', value: 'USD', isSecret: false }],
    });

    const productsReq = await RequestDefinition.create({
      owner: demoUser._id,
      collectionId: ecomCollection._id,
      folderId: 'f_catalog',
      name: '1. GET Product Catalog',
      description: 'Retrieves active inventory items with stock indicators',
      method: 'GET',
      url: '{{baseUrl}}/echo?service=catalog&category=electronics',
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      auth: { type: 'none' },
      body: { type: 'none' },
      tests: [
        {
          id: 't_prod_200',
          name: 'Status code is 200',
          target: 'statusCode',
          operator: 'equals',
          expectedValue: '200',
          enabled: true,
        },
        {
          id: 't_prod_latency',
          name: 'Response time under 500ms',
          target: 'responseTime',
          operator: 'lessThan',
          expectedValue: '500',
          enabled: true,
        },
      ],
      order: 0,
    });

    const createPaymentReq = await RequestDefinition.create({
      owner: demoUser._id,
      collectionId: ecomCollection._id,
      folderId: 'f_checkout',
      name: '2. POST Create Payment Intent',
      description: 'Generates client secret and registers charge with payment gateway',
      method: 'POST',
      url: '{{baseUrl}}/echo',
      headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
      auth: {
        type: 'apikey',
        apikey: { key: 'X-API-KEY', value: '{{apiKey}}', addTo: 'header' },
      },
      body: {
        type: 'json',
        raw: JSON.stringify(
          {
            amount: 14900,
            currency: 'usd',
            customer: 'cus_99120489',
            paymentMethodTypes: ['card'],
            metadata: { orderId: 'ord_77889' },
          },
          null,
          2
        ),
      },
      tests: [
        {
          id: 't_pay_200',
          name: 'Payment intent created (200)',
          target: 'statusCode',
          operator: 'equals',
          expectedValue: '200',
          enabled: true,
        },
      ],
      order: 1,
    });

    // 4. Collection 3: Contract Regression Suite
    const contractCollection = await Collection.create({
      owner: demoUser._id,
      name: 'Contract & Regression Detection Suite',
      description: 'Demonstrates baseline contract snapshotting, breaking schema change detection, and regression triage',
      folders: [],
    });

    const baselineOrderReq = await RequestDefinition.create({
      owner: demoUser._id,
      collectionId: contractCollection._id,
      name: 'Order API (Contract Baseline)',
      description: 'API endpoint with approved contract baseline snapshot',
      method: 'GET',
      url: '{{baseUrl}}/orders/101',
      headers: [],
      auth: { type: 'none' },
      body: { type: 'none' },
      tests: [
        {
          id: 't_b_200',
          name: 'Status is 200',
          target: 'statusCode',
          operator: 'equals',
          expectedValue: '200',
          enabled: true,
        },
        {
          id: 't_b_status',
          name: 'Order status is completed',
          target: 'jsonPath',
          property: 'order.status',
          operator: 'equals',
          expectedValue: 'completed',
          enabled: true,
        },
      ],
      order: 0,
    });

    const breakingOrderReq = await RequestDefinition.create({
      owner: demoUser._id,
      collectionId: contractCollection._id,
      name: 'Order API (Simulated Breaking Regression)',
      description: 'Simulates removed field and type mutation to trigger breaking contract regression',
      method: 'GET',
      url: '{{baseUrl}}/orders/101?simulateRegression=breaking',
      headers: [],
      auth: { type: 'none' },
      body: { type: 'none' },
      tests: [
        {
          id: 't_brk_200',
          name: 'Status is 200',
          target: 'statusCode',
          operator: 'equals',
          expectedValue: '200',
          enabled: true,
        },
      ],
      order: 1,
    });

    // 5. Approved Baseline Snapshot
    const baselineSample = {
      success: true,
      order: {
        id: '101',
        customer: 'Acme Corp',
        amount: 299.99,
        currency: 'USD',
        status: 'completed',
        itemCount: 4,
        createdAt: '2025-01-15T12:00:00.000Z',
      },
      meta: { cache: 'HIT', servedBy: 'mock-cluster-1' },
    };

    const baselineSnapshot = await ContractSnapshot.create({
      owner: demoUser._id,
      requestId: baselineOrderReq._id,
      collectionId: contractCollection._id,
      isBaseline: true,
      version: 1,
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      normalizedSchema: inferResponseSchema(baselineSample),
      rawSample: JSON.stringify(baselineSample, null, 2),
      responseTimeMs: 45,
      notes: 'Initial Approved Production Baseline (v1.0)',
    });

    // Recent Snapshot with Breaking Change
    const breakingSample = {
      success: true,
      order: {
        id: '101',
        customer: 'Acme Corp',
        amount: '299.99', // Type mutated number -> string
        currency: 'USD',
        status: 'completed',
        // itemCount removed!
        createdAt: '2025-01-15T12:00:00.000Z',
      },
      meta: { cache: 'MISS', servedBy: 'mock-cluster-2' },
    };

    const breakingSnapshot = await ContractSnapshot.create({
      owner: demoUser._id,
      requestId: breakingOrderReq._id,
      collectionId: contractCollection._id,
      isBaseline: false,
      version: 2,
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      normalizedSchema: inferResponseSchema(breakingSample),
      rawSample: JSON.stringify(breakingSample, null, 2),
      responseTimeMs: 92,
      notes: 'Automated snapshot from CI test run #1042',
    });

    // 6. Contract Findings
    await ContractFinding.create([
      {
        owner: demoUser._id,
        requestId: breakingOrderReq._id,
        snapshotId: breakingSnapshot._id,
        baselineSnapshotId: baselineSnapshot._id,
        severity: 'breaking',
        changeType: 'removed_property',
        jsonPath: '$.order.itemCount',
        previousValue: 4,
        newValue: undefined,
        explanation: 'Required field `itemCount` was removed from the response schema. Downstream consumers parsing this property will encounter undefined/null pointer exceptions.',
        status: 'open',
      },
      {
        owner: demoUser._id,
        requestId: breakingOrderReq._id,
        snapshotId: breakingSnapshot._id,
        baselineSnapshotId: baselineSnapshot._id,
        severity: 'breaking',
        changeType: 'type_mutation',
        jsonPath: '$.order.amount',
        previousValue: 'number',
        newValue: 'string',
        explanation: 'Property `amount` type changed from number to string ("299.99"). Strict JSON schema validators and type-safe clients will fail contract verification.',
        status: 'open',
      },
      {
        owner: demoUser._id,
        requestId: breakingOrderReq._id,
        snapshotId: breakingSnapshot._id,
        baselineSnapshotId: baselineSnapshot._id,
        severity: 'non_breaking',
        changeType: 'added_property',
        jsonPath: '$.order.discountApplied',
        previousValue: undefined,
        newValue: false,
        explanation: 'New optional boolean property `discountApplied` added to order payload. Safe for backward-compatible consumers.',
        status: 'resolved',
      },
      {
        owner: demoUser._id,
        requestId: breakingOrderReq._id,
        snapshotId: breakingSnapshot._id,
        baselineSnapshotId: baselineSnapshot._id,
        severity: 'potentially_breaking',
        changeType: 'header_mutation',
        jsonPath: 'headers.content-type',
        previousValue: 'application/json; charset=utf-8',
        newValue: 'application/json',
        explanation: 'Charset attribute omitted from Content-Type response header.',
        status: 'suppressed',
        suppressionReason: 'API gateway edge ingress strips redundant charset definitions by design.',
      },
      {
        owner: demoUser._id,
        requestId: breakingOrderReq._id,
        snapshotId: breakingSnapshot._id,
        baselineSnapshotId: baselineSnapshot._id,
        severity: 'performance_regression',
        changeType: 'latency_spike',
        jsonPath: 'responseTimeMs',
        previousValue: 45,
        newValue: 890,
        explanation: 'P95 latency increased by 1,877% (45ms -> 890ms) during cold database scan.',
        status: 'open',
      },
    ]);

    console.log('[Seed] Created Contract Snapshots & Findings');

    // 7. Workflows
    const authWorkflow = await Workflow.create({
      owner: demoUser._id,
      name: 'User Authentication & Profile Chaining Workflow',
      description: 'Executes login, extracts authorization token, and queries authenticated profile sequentially',
      steps: [
        {
          requestId: loginReq._id,
          order: 0,
          stopOnFailure: true,
          extract: [{ varName: 'authToken', source: 'body', path: 'token' }],
        },
        {
          requestId: profileReq._id,
          order: 1,
          stopOnFailure: true,
          extract: [],
        },
      ],
    });

    await Workflow.create({
      owner: demoUser._id,
      name: 'End-to-End E-Commerce Checkout Flow',
      description: 'Browse catalog, create payment intent, and execute webhook validation sequence',
      steps: [
        {
          requestId: productsReq._id,
          order: 0,
          stopOnFailure: true,
          extract: [],
        },
        {
          requestId: createPaymentReq._id,
          order: 1,
          stopOnFailure: true,
          extract: [{ varName: 'paymentIntentId', source: 'body', path: 'id' }],
        },
      ],
    });

    console.log('[Seed] Created Workflows');

    // 8. Historical Test Runs (Populates Regression Dashboard charts)
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const testRunsData = [
      {
        daysAgo: 5,
        passedRequests: 3,
        failedRequests: 0,
        passedAssertions: 6,
        failedAssertions: 0,
        durationMs: 142,
        breaking: 0,
        potentiallyBreaking: 0,
        nonBreaking: 0,
      },
      {
        daysAgo: 4,
        passedRequests: 3,
        failedRequests: 0,
        passedAssertions: 6,
        failedAssertions: 0,
        durationMs: 135,
        breaking: 0,
        potentiallyBreaking: 0,
        nonBreaking: 0,
      },
      {
        daysAgo: 3,
        passedRequests: 2,
        failedRequests: 1,
        passedAssertions: 5,
        failedAssertions: 1,
        durationMs: 210,
        breaking: 1,
        potentiallyBreaking: 0,
        nonBreaking: 0,
      },
      {
        daysAgo: 2,
        passedRequests: 3,
        failedRequests: 0,
        passedAssertions: 6,
        failedAssertions: 0,
        durationMs: 128,
        breaking: 0,
        potentiallyBreaking: 0,
        nonBreaking: 1,
      },
      {
        daysAgo: 1,
        passedRequests: 3,
        failedRequests: 0,
        passedAssertions: 6,
        failedAssertions: 0,
        durationMs: 130,
        breaking: 0,
        potentiallyBreaking: 1,
        nonBreaking: 0,
      },
      {
        daysAgo: 0,
        passedRequests: 2,
        failedRequests: 1,
        passedAssertions: 4,
        failedAssertions: 2,
        durationMs: 345,
        breaking: 2,
        potentiallyBreaking: 1,
        nonBreaking: 1,
      },
    ];

    for (const run of testRunsData) {
      const runTime = new Date(now - run.daysAgo * day);
      await TestRun.create({
        owner: demoUser._id,
        collectionId: contractCollection._id,
        environmentId: localEnv._id,
        environmentName: localEnv.name,
        runType: 'collection',
        status: run.failedRequests > 0 ? 'failed' : 'completed',
        startTime: runTime,
        endTime: new Date(runTime.getTime() + run.durationMs),
        durationMs: run.durationMs,
        totalRequests: run.passedRequests + run.failedRequests,
        passedRequests: run.passedRequests,
        failedRequests: run.failedRequests,
        totalAssertions: run.passedAssertions + run.failedAssertions,
        passedAssertions: run.passedAssertions,
        failedAssertions: run.failedAssertions,
        contractFindingsSummary: {
          breaking: run.breaking,
          potentiallyBreaking: run.potentiallyBreaking,
          nonBreaking: run.nonBreaking,
        },
        results: [
          {
            requestId: baselineOrderReq._id,
            requestName: baselineOrderReq.name,
            method: baselineOrderReq.method,
            url: baselineOrderReq.url,
            statusCode: 200,
            statusText: 'OK',
            durationMs: 45,
            responseSize: 512,
            passed: true,
            contractChangesCount: 0,
            assertions: [
              {
                assertionId: 't_b_200',
                name: 'Status is 200',
                passed: true,
                target: 'statusCode',
                operator: 'equals',
                expected: '200',
                actual: 200,
              },
              {
                assertionId: 't_b_status',
                name: 'Order status is completed',
                passed: true,
                target: 'jsonPath',
                operator: 'equals',
                expected: 'completed',
                actual: 'completed',
              },
            ],
          },
          {
            requestId: breakingOrderReq._id,
            requestName: breakingOrderReq.name,
            method: breakingOrderReq.method,
            url: breakingOrderReq.url,
            statusCode: run.failedRequests > 0 ? 500 : 200,
            statusText: run.failedRequests > 0 ? 'Internal Server Error' : 'OK',
            durationMs: run.durationMs - 45,
            responseSize: 420,
            passed: run.failedRequests === 0,
            contractChangesCount: run.breaking,
            contractFindings: run.breaking > 0 ? [
              {
                severity: 'breaking',
                changeType: 'removed_property',
                jsonPath: '$.order.itemCount',
                explanation: 'Required field `itemCount` was removed.',
              },
            ] : [],
            assertions: [
              {
                assertionId: 't_brk_200',
                name: 'Status is 200',
                passed: run.failedRequests === 0,
                target: 'statusCode',
                operator: 'equals',
                expected: '200',
                actual: run.failedRequests > 0 ? 500 : 200,
                message: run.failedRequests > 0 ? 'Expected 200 but received 500' : '',
              },
            ],
          },
        ],
        createdAt: runTime,
        updatedAt: runTime,
      });
    }

    console.log('[Seed] Created Test Runs with historical trends');

    // 9. Audit Logs
    await AuditLog.create([
      {
        userId: demoUser._id,
        action: 'contract.baseline_approved',
        resourceType: 'ContractSnapshot',
        resourceId: baselineSnapshot._id.toString(),
        details: { version: 1, notes: 'Initial Production Baseline approved by lead architect' },
      },
      {
        userId: demoUser._id,
        action: 'test_run.executed',
        resourceType: 'TestRun',
        resourceId: contractCollection._id.toString(),
        details: { suite: 'Contract & Regression Detection Suite', passed: 4, failed: 2 },
      },
      {
        userId: demoUser._id,
        action: 'contract.finding_suppressed',
        resourceType: 'ContractFinding',
        details: {
          path: 'headers.content-type',
          reason: 'API gateway edge ingress strips redundant charset definitions by design.',
        },
      },
    ]);

    console.log('[Seed] Created Audit Logs');
    console.log('------------------------------------------------------------');
    console.log('[Seed] SUCCESS! Database seeded with rich dummy data:');
    console.log('       User: demo@routelab.dev / RouteLabDemo123!');
    console.log('       Environments: 3 (Local Mock, Staging, Production)');
    console.log('       Collections: 3 with folders and chained requests');
    console.log('       Workflows: 2 multi-step test workflows');
    console.log('       Contract Baselines & Findings: 5 classified findings');
    console.log('       Historical Test Runs: 6 runs across past 5 days');
    console.log('------------------------------------------------------------');

    await disconnectDB();
  } catch (err) {
    console.error('[Seed Error]', err);
    process.exit(1);
  }
}

seed();
