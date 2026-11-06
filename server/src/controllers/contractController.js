import { ContractSnapshot } from '../models/ContractSnapshot.js';
import { ContractFinding } from '../models/ContractFinding.js';
import { RequestDefinition } from '../models/RequestDefinition.js';
import { inferResponseSchema, compareContract } from '../services/contractEngine.js';

export async function getSnapshotsForRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const snapshots = await ContractSnapshot.find({
      requestId,
      owner: req.user._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, snapshots });
  } catch (err) {
    next(err);
  }
}

export async function captureSnapshot(req, res, next) {
  try {
    const { requestId } = req.params;
    const { response, makeBaseline, notes } = req.body;

    const request = await RequestDefinition.findOne({ _id: requestId, owner: req.user._id });
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    if (!response || !response.statusCode) {
      return res.status(400).json({ success: false, error: 'Valid response object required to capture snapshot' });
    }

    // Infer normalized schema from response body
    const normalizedSchema = response.isJson && response.body
      ? inferResponseSchema(response.body)
      : { type: 'non-json' };

    // Get current version count
    const latest = await ContractSnapshot.findOne({ requestId }).sort({ version: -1 });
    const version = latest ? latest.version + 1 : 1;

    // If making baseline or if this is the very first snapshot, set as baseline
    const isBaseline = makeBaseline || !latest;

    if (isBaseline) {
      // Demote previous baseline
      await ContractSnapshot.updateMany({ requestId, owner: req.user._id }, { isBaseline: false });
    }

    const snapshot = await ContractSnapshot.create({
      owner: req.user._id,
      requestId: request._id,
      collectionId: request.collectionId,
      isBaseline,
      version,
      statusCode: response.statusCode,
      headers: {
        'content-type': response.headers?.['content-type'],
        'content-encoding': response.headers?.['content-encoding'],
      },
      normalizedSchema,
      rawSample: typeof response.body === 'object'
        ? JSON.stringify(response.body, null, 2).substring(0, 3000)
        : String(response.body || '').substring(0, 3000),
      responseTimeMs: response.durationMs || 0,
      notes: notes || (isBaseline ? 'Initial Baseline Snapshot' : `Snapshot v${version}`),
    });

    res.status(201).json({ success: true, snapshot });
  } catch (err) {
    next(err);
  }
}

export async function promoteToBaseline(req, res, next) {
  try {
    const snapshot = await ContractSnapshot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!snapshot) {
      return res.status(404).json({ success: false, error: 'Snapshot not found' });
    }

    // Demote existing baselines for this request
    await ContractSnapshot.updateMany(
      { requestId: snapshot.requestId, owner: req.user._id },
      { isBaseline: false }
    );

    snapshot.isBaseline = true;
    await snapshot.save();

    res.status(200).json({
      success: true,
      message: `Snapshot v${snapshot.version} promoted to active baseline`,
      snapshot,
    });
  } catch (err) {
    next(err);
  }
}

export async function compareSnapshotWithBaseline(req, res, next) {
  try {
    const candidate = await ContractSnapshot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Snapshot not found' });
    }

    const baseline = await ContractSnapshot.findOne({
      requestId: candidate.requestId,
      isBaseline: true,
      owner: req.user._id,
    });

    if (!baseline) {
      return res.status(400).json({
        success: false,
        error: 'No active baseline snapshot found to compare against. Promote a baseline snapshot first.',
      });
    }

    const report = compareContract({
      baselineSnapshot: baseline,
      candidateResponse: {
        statusCode: candidate.statusCode,
        headers: candidate.headers,
        isJson: candidate.normalizedSchema?.type !== 'non-json',
        body: candidate.rawSample ? JSON.parse(candidate.rawSample) : null,
        durationMs: candidate.responseTimeMs,
      },
    });

    res.status(200).json({
      success: true,
      baseline,
      candidate,
      diff: report,
    });
  } catch (err) {
    next(err);
  }
}

export async function getContractFindings(req, res, next) {
  try {
    const { severity, status } = req.query;
    const filter = { owner: req.user._id };

    if (severity) filter.severity = severity;
    if (status) filter.status = status;

    const findings = await ContractFinding.find(filter)
      .populate('requestId', 'name method url')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, findings });
  } catch (err) {
    next(err);
  }
}

export async function suppressFinding(req, res, next) {
  try {
    const { reason } = req.body;
    const finding = await ContractFinding.findOne({ _id: req.params.id, owner: req.user._id });
    if (!finding) {
      return res.status(404).json({ success: false, error: 'Finding not found' });
    }

    finding.status = 'suppressed';
    finding.suppressionReason = reason || 'Suppressed by user';
    await finding.save();

    res.status(200).json({ success: true, finding });
  } catch (err) {
    next(err);
  }
}
