import { inferResponseSchema, compareContract } from '../../src/services/contractEngine.js';

describe('API Contract Change Detection Engine', () => {
  const baselinePayload = {
    id: 'ord_12345',
    customer: 'Acme Corp',
    amount: 150.5,
    currency: 'USD',
    status: 'completed',
    items: [
      { sku: 'WIDGET-1', quantity: 2, price: 50.0 },
      { sku: 'GADGET-2', quantity: 1, price: 50.5 },
    ],
    createdAt: '2025-01-15T12:00:00.000Z',
  };

  const baselineSnapshot = {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    normalizedSchema: inferResponseSchema(baselinePayload),
    responseTimeMs: 80,
  };

  it('should infer normalized schema and mark volatile fields like id and createdAt', () => {
    const schema = inferResponseSchema(baselinePayload);
    expect(schema.type).toBe('object');
    expect(schema.properties.customer.type).toBe('string');
    expect(schema.properties.amount.type).toBe('number');
    expect(schema.properties.items.type).toBe('array');
    expect(schema.properties.createdAt.volatile).toBe(true);
    expect(schema.properties.id.volatile).toBe(true);
  });

  it('should detect BREAKING change when a field is removed', () => {
    const candidatePayload = {
      id: 'ord_99999',
      customer: 'Acme Corp',
      // 'amount' removed!
      currency: 'USD',
      status: 'completed',
      items: [{ sku: 'WIDGET-1', quantity: 2, price: 50.0 }],
      createdAt: '2025-01-16T15:00:00.000Z',
    };

    const report = compareContract({
      baselineSnapshot,
      candidateResponse: {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        isJson: true,
        body: candidatePayload,
        durationMs: 85,
      },
    });

    expect(report.hasBreakingChanges).toBe(true);
    expect(report.summary.breaking).toBeGreaterThanOrEqual(1);
    const removedFinding = report.findings.find((f) => f.changeType === 'removed_field');
    expect(removedFinding).toBeDefined();
    expect(removedFinding.severity).toBe('breaking');
    expect(removedFinding.jsonPath).toContain('amount');
  });

  it('should detect BREAKING change when field type is mutated', () => {
    const candidatePayload = {
      ...baselinePayload,
      amount: 'one-hundred-fifty', // string instead of number!
    };

    const report = compareContract({
      baselineSnapshot,
      candidateResponse: {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        isJson: true,
        body: candidatePayload,
        durationMs: 85,
      },
    });

    expect(report.hasBreakingChanges).toBe(true);
    const typeFinding = report.findings.find((f) => f.changeType === 'type_mismatch');
    expect(typeFinding).toBeDefined();
    expect(typeFinding.severity).toBe('breaking');
    expect(typeFinding.previousValue).toBe('number');
    expect(typeFinding.newValue).toBe('string');
  });

  it('should detect NON-BREAKING change when an optional new field is added', () => {
    const candidatePayload = {
      ...baselinePayload,
      discountCode: 'SUMMER2025', // Newly added field
    };

    const report = compareContract({
      baselineSnapshot,
      candidateResponse: {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        isJson: true,
        body: candidatePayload,
        durationMs: 85,
      },
    });

    expect(report.hasBreakingChanges).toBe(false);
    expect(report.summary.nonBreaking).toBeGreaterThanOrEqual(1);
    const addedFinding = report.findings.find((f) => f.changeType === 'added_field');
    expect(addedFinding).toBeDefined();
    expect(addedFinding.severity).toBe('non_breaking');
    expect(addedFinding.jsonPath).toContain('discountCode');
  });

  it('should detect BREAKING change when HTTP status code changes unexpectedly', () => {
    const report = compareContract({
      baselineSnapshot,
      candidateResponse: {
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        isJson: true,
        body: { error: 'Internal Error' },
        durationMs: 100,
      },
    });

    expect(report.hasBreakingChanges).toBe(true);
    const statusFinding = report.findings.find((f) => f.changeType === 'status_code_changed');
    expect(statusFinding).toBeDefined();
    expect(statusFinding.previousValue).toBe(200);
    expect(statusFinding.newValue).toBe(500);
  });
});
