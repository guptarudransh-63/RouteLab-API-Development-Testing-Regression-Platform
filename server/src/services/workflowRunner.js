import { executeRequest } from './requestExecutor.js';
import { runAssertions, extractVariablesFromResponse } from './assertionEngine.js';
import { compareContract } from './contractEngine.js';
import { ContractSnapshot } from '../models/ContractSnapshot.js';

/**
 * Runs a multi-step chained workflow with variable extraction and propagation.
 */
export async function runWorkflowSteps({
  steps,
  environmentVars = [],
  collectionVars = [],
  initialRuntimeVars = {},
  allowLocal = false,
  onStepComplete = null,
}) {
  const runtimeVars = { ...initialRuntimeVars };
  const stepResults = [];
  let workflowSuccess = true;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const { request, stopOnFailure = true, extract = [] } = step;

    // Check for baseline contract snapshot if available
    let baselineSnapshot = null;
    try {
      baselineSnapshot = await ContractSnapshot.findOne({
        requestId: request._id,
        isBaseline: true,
      });
    } catch {
      // Ignore if DB not ready in testing
    }

    // 1. Execute request with currently accumulated runtime variables
    const response = await executeRequest({
      request,
      environmentVars,
      collectionVars,
      runtimeVars,
      allowLocal,
    });

    // 2. Run declarative assertions
    const assertionReport = runAssertions(request.tests || [], response);

    // 3. Contract comparison
    let contractReport = { findings: [], summary: { breaking: 0, potentiallyBreaking: 0, nonBreaking: 0 } };
    if (baselineSnapshot) {
      contractReport = compareContract({
        baselineSnapshot,
        candidateResponse: response,
      });
    }

    // 4. Extract variables from response into runtime variables dictionary
    const extracted = extractVariablesFromResponse(
      [...(request.extractedVariables || []), ...(extract || [])],
      response
    );
    Object.assign(runtimeVars, extracted);

    const stepPassed = response.success && assertionReport.failed === 0;

    const result = {
      stepIndex: i,
      requestId: request._id,
      requestName: request.name,
      method: request.method,
      url: response.requestMetadata?.finalUrl || request.url,
      statusCode: response.statusCode,
      statusText: response.statusText,
      durationMs: response.durationMs,
      responseSize: response.responseSize,
      passed: stepPassed,
      assertions: assertionReport.results,
      extractedVariables: extracted,
      contractFindings: contractReport.findings,
      contractFindingsCount: contractReport.findings.length,
      error: response.error,
    };

    stepResults.push(result);

    if (onStepComplete) {
      onStepComplete(result, i, steps.length);
    }

    if (!stepPassed) {
      workflowSuccess = false;
      if (stopOnFailure) {
        break; // Stop execution of downstream dependent requests
      }
    }
  }

  return {
    success: workflowSuccess,
    stepResults,
    finalRuntimeVariables: runtimeVars,
  };
}
