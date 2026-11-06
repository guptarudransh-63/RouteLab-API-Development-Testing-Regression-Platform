import {
  getByPath,
  evaluateAssertion,
  runAssertions,
  extractVariablesFromResponse,
} from '../../src/services/assertionEngine.js';

describe('Assertion Engine Service', () => {
  const mockResponse = {
    statusCode: 200,
    durationMs: 120,
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'req_xyz_123',
    },
    body: {
      success: true,
      data: {
        users: [
          { id: 1, name: 'Alice', active: true },
          { id: 2, name: 'Bob', active: false },
        ],
        total: 2,
      },
      message: 'Found 2 users',
    },
    rawBody: '{"success":true}',
    isJson: true,
  };

  it('should extract values using getByPath', () => {
    expect(getByPath(mockResponse.body, 'data.users[0].name')).toBe('Alice');
    expect(getByPath(mockResponse.body, 'data.users.1.active')).toBe(false);
    expect(getByPath(mockResponse.body, 'data.total')).toBe(2);
    expect(getByPath(mockResponse.body, 'non.existent.path')).toBeUndefined();
  });

  it('should evaluate status code assertions correctly', () => {
    const res = evaluateAssertion(
      { target: 'statusCode', operator: 'equals', expectedValue: 200 },
      mockResponse
    );
    expect(res.passed).toBe(true);

    const failRes = evaluateAssertion(
      { target: 'statusCode', operator: 'equals', expectedValue: 404 },
      mockResponse
    );
    expect(failRes.passed).toBe(false);
  });

  it('should evaluate response time threshold', () => {
    const res = evaluateAssertion(
      { target: 'responseTime', operator: 'lessThan', expectedValue: 500 },
      mockResponse
    );
    expect(res.passed).toBe(true);
  });

  it('should evaluate JSON path assertions', () => {
    const res = evaluateAssertion(
      { target: 'jsonPath', property: 'data.users[0].name', operator: 'equals', expectedValue: 'Alice' },
      mockResponse
    );
    expect(res.passed).toBe(true);

    const typeRes = evaluateAssertion(
      { target: 'jsonPath', property: 'data.total', operator: 'isType', expectedValue: 'number' },
      mockResponse
    );
    expect(typeRes.passed).toBe(true);
  });

  it('should evaluate header assertions', () => {
    const res = evaluateAssertion(
      { target: 'header', property: 'Content-Type', operator: 'contains', expectedValue: 'json' },
      mockResponse
    );
    expect(res.passed).toBe(true);
  });

  it('should run a batch of assertions and return aggregate metrics', () => {
    const assertions = [
      { id: '1', target: 'statusCode', operator: 'equals', expectedValue: 200 },
      { id: '2', target: 'responseTime', operator: 'lessThan', expectedValue: 1000 },
      { id: '3', target: 'jsonPath', property: 'data.total', operator: 'equals', expectedValue: 999 }, // will fail
    ];

    const report = runAssertions(assertions, mockResponse);
    expect(report.total).toBe(3);
    expect(report.passed).toBe(2);
    expect(report.failed).toBe(1);
  });

  it('should extract variables from response correctly', () => {
    const extractions = [
      { varName: 'firstUserName', source: 'body', path: 'data.users[0].name' },
      { varName: 'reqId', source: 'header', path: 'x-request-id' },
      { varName: 'code', source: 'statusCode' },
    ];

    const extracted = extractVariablesFromResponse(extractions, mockResponse);
    expect(extracted.firstUserName).toBe('Alice');
    expect(extracted.reqId).toBe('req_xyz_123');
    expect(extracted.code).toBe('200');
  });
});
