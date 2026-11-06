import { compareTestRuns } from '../../src/services/regressionEngine.js';

describe('Regression Engine Service', () => {
  const baselineRun = {
    _id: 'run_baseline_1',
    results: [
      {
        requestId: 'req_1',
        requestName: 'Get Users',
        passed: true,
        statusCode: 200,
        durationMs: 50,
      },
      {
        requestId: 'req_2',
        requestName: 'Create Order',
        passed: false,
        statusCode: 400,
        durationMs: 70,
      },
      {
        requestId: 'req_3',
        requestName: 'Get Inventory',
        passed: true,
        statusCode: 200,
        durationMs: 60,
      },
    ],
  };

  it('should detect regressions when previously passing requests now fail', () => {
    const currentRun = {
      _id: 'run_candidate_2',
      results: [
        {
          requestId: 'req_1',
          requestName: 'Get Users',
          passed: false, // Regressed!
          statusCode: 500,
          durationMs: 55,
          error: 'Internal Server Error',
        },
        {
          requestId: 'req_2',
          requestName: 'Create Order',
          passed: true, // Fixed!
          statusCode: 201,
          durationMs: 75,
        },
        {
          requestId: 'req_3',
          requestName: 'Get Inventory',
          passed: true,
          statusCode: 200,
          durationMs: 350, // Latency regression!
        },
      ],
    };

    const diff = compareTestRuns(baselineRun, currentRun);

    expect(diff.isRegressed).toBe(true);
    expect(diff.summary.newFailuresCount).toBe(1);
    expect(diff.regressions[0].requestId).toBe('req_1');
    expect(diff.summary.fixedTestsCount).toBe(1);
    expect(diff.improvements[0].requestId).toBe('req_2');
    expect(diff.summary.latencyBreachesCount).toBeGreaterThanOrEqual(1);
  });
});
