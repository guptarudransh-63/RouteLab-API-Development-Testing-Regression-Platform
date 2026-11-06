import { TestRun } from '../models/TestRun.js';
import { Collection } from '../models/Collection.js';
import { RequestDefinition } from '../models/RequestDefinition.js';
import { Environment } from '../models/Environment.js';
import { ContractSnapshot } from '../models/ContractSnapshot.js';
import { executeRequest } from '../services/requestExecutor.js';
import { runAssertions, extractVariablesFromResponse } from '../services/assertionEngine.js';
import { compareContract } from '../services/contractEngine.js';
import { compareTestRuns } from '../services/regressionEngine.js';

export async function createTestRun(req, res, next) {
  try {
    const { collectionId, environmentId, stopOnFailure = false, allowLocalOverride } = req.body;

    const collection = await Collection.findOne({ _id: collectionId, owner: req.user._id });
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    const requests = await RequestDefinition.find({
      collectionId: collection._id,
      owner: req.user._id,
    }).sort({ order: 1, createdAt: 1 });

    if (requests.length === 0) {
      return res.status(400).json({ success: false, error: 'Collection has no requests to run' });
    }

    // Load environment variables
    let environmentVars = [];
    let environmentName = 'No Environment';
    if (environmentId) {
      const env = await Environment.findOne({ _id: environmentId, owner: req.user._id });
      if (env) {
        environmentVars = env.variables || [];
        environmentName = env.name;
      }
    }

    const allowLocal =
      process.env.ALLOW_LOCAL_REQUESTS === 'true' ||
      req.user.preferences?.allowLocalRequests === true ||
      allowLocalOverride === true;

    const runtimeVars = {};
    const results = [];
    let totalAssertions = 0;
    let passedAssertions = 0;
    let failedAssertions = 0;
    let totalRequests = requests.length;
    let passedRequests = 0;
    let failedRequests = 0;
    const contractSummary = { breaking: 0, potentiallyBreaking: 0, nonBreaking: 0 };

    const startTime = new Date();

    for (const request of requests) {
      // 1. Check for baseline contract snapshot
      const baselineSnapshot = await ContractSnapshot.findOne({
        requestId: request._id,
        isBaseline: true,
      });

      // 2. Execute request with accumulated runtime variables
      const response = await executeRequest({
        request,
        environmentVars,
        collectionVars: collection.variables || [],
        runtimeVars,
        allowLocal,
      });

      // 3. Evaluate assertions
      const assertionReport = runAssertions(request.tests || [], response);
      totalAssertions += assertionReport.total;
      passedAssertions += assertionReport.passed;
      failedAssertions += assertionReport.failed;

      // 4. Contract check
      let contractReport = { findings: [], summary: { breaking: 0, potentiallyBreaking: 0, nonBreaking: 0 } };
      if (baselineSnapshot) {
        contractReport = compareContract({
          baselineSnapshot,
          candidateResponse: response,
        });
        contractSummary.breaking += contractReport.summary.breaking;
        contractSummary.potentiallyBreaking += contractReport.summary.potentiallyBreaking;
        contractSummary.nonBreaking += contractReport.summary.nonBreaking;
      }

      // 5. Variable extractions
      const extracted = extractVariablesFromResponse(request.extractedVariables || [], response);
      Object.assign(runtimeVars, extracted);

      const passed = response.success && assertionReport.failed === 0;
      if (passed) passedRequests++;
      else failedRequests++;

      results.push({
        requestId: request._id,
        requestName: request.name,
        method: request.method,
        url: response.requestMetadata?.finalUrl || request.url,
        statusCode: response.statusCode,
        statusText: response.statusText,
        durationMs: response.durationMs,
        responseSize: response.responseSize,
        assertions: assertionReport.results,
        passed,
        contractChangesCount: contractReport.findings.length,
        contractFindings: contractReport.findings.map((f) => ({
          severity: f.severity,
          changeType: f.changeType,
          jsonPath: f.jsonPath,
          explanation: f.explanation,
        })),
        error: response.error,
      });

      if (!passed && stopOnFailure) {
        break;
      }
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const status = failedRequests === 0 ? 'completed' : 'failed';

    const testRun = await TestRun.create({
      owner: req.user._id,
      collectionId: collection._id,
      environmentId: environmentId || null,
      environmentName,
      runType: 'collection',
      status,
      startTime,
      endTime,
      durationMs,
      totalRequests,
      passedRequests,
      failedRequests,
      totalAssertions,
      passedAssertions,
      failedAssertions,
      contractFindingsSummary: contractSummary,
      results,
    });

    res.status(201).json({ success: true, testRun });
  } catch (err) {
    next(err);
  }
}

export async function getTestRuns(req, res, next) {
  try {
    const { collectionId, limit = 20, page = 1 } = req.query;
    const filter = { owner: req.user._id };
    if (collectionId) filter.collectionId = collectionId;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await TestRun.countDocuments(filter);
    const testRuns = await TestRun.find(filter)
      .populate('collectionId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      testRuns,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getTestRunById(req, res, next) {
  try {
    const testRun = await TestRun.findOne({ _id: req.params.id, owner: req.user._id }).populate(
      'collectionId',
      'name'
    );
    if (!testRun) {
      return res.status(404).json({ success: false, error: 'Test run not found' });
    }
    res.status(200).json({ success: true, testRun });
  } catch (err) {
    next(err);
  }
}

export async function compareTestRunsHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { baselineRunId } = req.body;

    const currentRun = await TestRun.findOne({ _id: id, owner: req.user._id });
    if (!currentRun) {
      return res.status(404).json({ success: false, error: 'Current test run not found' });
    }

    let baselineRun;
    if (baselineRunId) {
      baselineRun = await TestRun.findOne({ _id: baselineRunId, owner: req.user._id });
    } else {
      // Find the most recent previous run of the same collection
      baselineRun = await TestRun.findOne({
        collectionId: currentRun.collectionId,
        owner: req.user._id,
        _id: { $ne: currentRun._id },
        createdAt: { $lt: currentRun.createdAt },
      }).sort({ createdAt: -1 });
    }

    if (!baselineRun) {
      return res.status(400).json({
        success: false,
        error: 'No suitable previous test run found for regression comparison',
      });
    }

    const comparison = compareTestRuns(baselineRun, currentRun);

    res.status(200).json({
      success: true,
      baselineRun: {
        id: baselineRun._id,
        createdAt: baselineRun.createdAt,
        passedRequests: baselineRun.passedRequests,
        failedRequests: baselineRun.failedRequests,
      },
      currentRun: {
        id: currentRun._id,
        createdAt: currentRun.createdAt,
        passedRequests: currentRun.passedRequests,
        failedRequests: currentRun.failedRequests,
      },
      comparison,
    });
  } catch (err) {
    next(err);
  }
}

export async function getRegressionDashboardStats(req, res, next) {
  try {
    const testRuns = await TestRun.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .limit(15);

    // Trend data for Recharts
    const trend = testRuns.reverse().map((run) => ({
      date: new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      runId: run._id,
      passed: run.passedRequests,
      failed: run.failedRequests,
      durationMs: run.durationMs,
      breakingChanges: run.contractFindingsSummary?.breaking || 0,
    }));

    const totalRuns = await TestRun.countDocuments({ owner: req.user._id });
    const successfulRuns = await TestRun.countDocuments({ owner: req.user._id, status: 'completed' });

    res.status(200).json({
      success: true,
      stats: {
        totalRuns,
        successfulRuns,
        passRate: totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0,
        trend,
      },
    });
  } catch (err) {
    next(err);
  }
}
