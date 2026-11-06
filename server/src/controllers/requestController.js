import { RequestDefinition } from '../models/RequestDefinition.js';
import { Collection } from '../models/Collection.js';
import { Environment } from '../models/Environment.js';
import { ContractSnapshot } from '../models/ContractSnapshot.js';
import { executeRequest } from '../services/requestExecutor.js';
import { runAssertions, extractVariablesFromResponse } from '../services/assertionEngine.js';
import { compareContract } from '../services/contractEngine.js';

export async function getRequestById(req, res, next) {
  try {
    const request = await RequestDefinition.findOne({ _id: req.params.id, owner: req.user._id });
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    res.status(200).json({ success: true, request });
  } catch (err) {
    next(err);
  }
}

export async function createRequest(req, res, next) {
  try {
    const { collectionId } = req.params;
    const collection = await Collection.findOne({ _id: collectionId, owner: req.user._id });
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    const { name, method, url, folderId, params, headers, auth, body, tests, extractedVariables, description } = req.body;

    const highestOrder = await RequestDefinition.findOne({ collectionId: collection._id })
      .sort({ order: -1 })
      .select('order');
    const order = highestOrder ? highestOrder.order + 1 : 0;

    const request = await RequestDefinition.create({
      owner: req.user._id,
      collectionId: collection._id,
      folderId: folderId || null,
      name: name || `${method || 'GET'} Request`,
      description: description || '',
      method: (method || 'GET').toUpperCase(),
      url: url || '{{baseUrl}}',
      params: params || [],
      headers: headers || [],
      auth: auth || { type: 'none' },
      body: body || { type: 'none' },
      tests: tests || [],
      extractedVariables: extractedVariables || [],
      order,
    });

    res.status(201).json({ success: true, request });
  } catch (err) {
    next(err);
  }
}

export async function updateRequest(req, res, next) {
  try {
    const request = await RequestDefinition.findOne({ _id: req.params.id, owner: req.user._id });
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const fields = [
      'name',
      'description',
      'folderId',
      'method',
      'url',
      'params',
      'headers',
      'auth',
      'body',
      'tests',
      'extractedVariables',
      'order',
    ];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        request[f] = req.body[f];
      }
    }

    await request.save();
    res.status(200).json({ success: true, request });
  } catch (err) {
    next(err);
  }
}

export async function deleteRequest(req, res, next) {
  try {
    const request = await RequestDefinition.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    res.status(200).json({ success: true, message: 'Request deleted' });
  } catch (err) {
    next(err);
  }
}

export async function duplicateRequest(req, res, next) {
  try {
    const original = await RequestDefinition.findOne({ _id: req.params.id, owner: req.user._id });
    if (!original) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const copyObj = original.toObject();
    delete copyObj._id;
    delete copyObj.createdAt;
    delete copyObj.updatedAt;

    copyObj.name = `${copyObj.name} (Copy)`;
    copyObj.order = original.order + 1;

    const copy = await RequestDefinition.create(copyObj);
    res.status(201).json({ success: true, request: copy });
  } catch (err) {
    next(err);
  }
}

/**
 * Execute a saved or scratchpad request definition with SSRF defense, variable resolution, and assertions
 */
export async function executeRequestHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { environmentId, runtimeVars = {}, allowLocalOverride, scratchpadRequest } = req.body;

    let requestDef;
    let collectionVars = [];

    if (id && id !== 'ad-hoc') {
      requestDef = await RequestDefinition.findOne({ _id: id, owner: req.user._id });
      if (!requestDef) {
        return res.status(404).json({ success: false, error: 'Request definition not found' });
      }

      const collection = await Collection.findById(requestDef.collectionId);
      if (collection) {
        collectionVars = collection.variables || [];
      }
    } else if (scratchpadRequest) {
      requestDef = scratchpadRequest;
    } else {
      return res.status(400).json({ success: false, error: 'No request definition provided' });
    }

    // Fetch environment variables if selected
    let environmentVars = [];
    if (environmentId) {
      const env = await Environment.findOne({ _id: environmentId, owner: req.user._id });
      if (env) {
        environmentVars = env.variables || [];
      }
    }

    // Check if user allows local requests
    const allowLocal =
      process.env.ALLOW_LOCAL_REQUESTS === 'true' ||
      req.user.preferences?.allowLocalRequests === true ||
      allowLocalOverride === true;

    // 1. Execute HTTP Request via secure executor
    const response = await executeRequest({
      request: requestDef,
      environmentVars,
      collectionVars,
      runtimeVars,
      allowLocal,
    });

    // 2. Evaluate Declarative Test Assertions
    const assertionReport = runAssertions(requestDef.tests || [], response);

    // 3. Extract Variables
    const extractedVariables = extractVariablesFromResponse(requestDef.extractedVariables || [], response);

    // 4. Contract Comparison against baseline snapshot if request is saved
    let contractReport = {
      findings: [],
      hasBreakingChanges: false,
      summary: { breaking: 0, potentiallyBreaking: 0, nonBreaking: 0 },
    };

    if (requestDef._id) {
      const baselineSnapshot = await ContractSnapshot.findOne({
        requestId: requestDef._id,
        isBaseline: true,
      });

      if (baselineSnapshot) {
        contractReport = compareContract({
          baselineSnapshot,
          candidateResponse: response,
        });
      }
    }

    res.status(200).json({
      success: true,
      response,
      assertions: assertionReport,
      contractReport,
      extractedVariables,
    });
  } catch (err) {
    next(err);
  }
}
