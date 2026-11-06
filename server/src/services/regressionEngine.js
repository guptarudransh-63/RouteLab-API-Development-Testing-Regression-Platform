/**
 * RouteLab Cross-Run Regression Comparison Engine
 */

export function compareTestRuns(baselineRun, currentRun, latencyDeviationPercent = 30) {
  if (!baselineRun || !currentRun) {
    throw new Error('Both baselineRun and currentRun are required for regression comparison');
  }

  const baseResultsMap = new Map();
  for (const res of baselineRun.results || []) {
    const key = String(res.requestId || res.requestName);
    baseResultsMap.set(key, res);
  }

  const regressions = [];
  const improvements = [];
  const statusChanges = [];
  const latencyChanges = [];
  const contractDiffs = [];

  for (const currentRes of currentRun.results || []) {
    const key = String(currentRes.requestId || currentRes.requestName);
    const baseRes = baseResultsMap.get(key);

    if (!baseRes) {
      // New request added in this run
      continue;
    }

    // 1. Pass/Fail regression check
    if (baseRes.passed && !currentRes.passed) {
      regressions.push({
        requestId: currentRes.requestId,
        requestName: currentRes.requestName,
        type: 'test_regression',
        severity: 'high',
        message: `Request '${currentRes.requestName}' previously passed but failed in current run.`,
        error: currentRes.error || 'Assertion failures',
      });
    } else if (!baseRes.passed && currentRes.passed) {
      improvements.push({
        requestId: currentRes.requestId,
        requestName: currentRes.requestName,
        type: 'test_fixed',
        message: `Request '${currentRes.requestName}' previously failed but passed in current run.`,
      });
    }

    // 2. Status code change
    if (baseRes.statusCode !== currentRes.statusCode) {
      statusChanges.push({
        requestId: currentRes.requestId,
        requestName: currentRes.requestName,
        previousStatus: baseRes.statusCode,
        currentStatus: currentRes.statusCode,
        message: `Status code changed from ${baseRes.statusCode} to ${currentRes.statusCode}`,
      });
    }

    // 3. Latency regression
    if (baseRes.durationMs > 0 && currentRes.durationMs > 0) {
      const deltaMs = currentRes.durationMs - baseRes.durationMs;
      const percentChange = Math.round((deltaMs / baseRes.durationMs) * 100);

      if (percentChange > latencyDeviationPercent && deltaMs > 150) {
        latencyChanges.push({
          requestId: currentRes.requestId,
          requestName: currentRes.requestName,
          baseDurationMs: baseRes.durationMs,
          currentDurationMs: currentRes.durationMs,
          deltaMs,
          percentChange,
          message: `Latency increased by ${percentChange}% (+${deltaMs}ms)`,
        });
      }
    }

    // 4. Contract findings check
    if (currentRes.contractFindings && currentRes.contractFindings.length > 0) {
      for (const finding of currentRes.contractFindings) {
        contractDiffs.push({
          requestId: currentRes.requestId,
          requestName: currentRes.requestName,
          severity: finding.severity,
          changeType: finding.changeType,
          path: finding.jsonPath,
          explanation: finding.explanation,
        });
      }
    }
  }

  // Summary
  const isRegressed = regressions.length > 0 || contractDiffs.some((c) => c.severity === 'breaking');

  return {
    baselineRunId: baselineRun._id,
    currentRunId: currentRun._id,
    isRegressed,
    summary: {
      newFailuresCount: regressions.length,
      fixedTestsCount: improvements.length,
      statusChangesCount: statusChanges.length,
      latencyBreachesCount: latencyChanges.length,
      contractFindingsCount: contractDiffs.length,
      breakingContractChangesCount: contractDiffs.filter((c) => c.severity === 'breaking').length,
    },
    regressions,
    improvements,
    statusChanges,
    latencyChanges,
    contractDiffs,
  };
}
