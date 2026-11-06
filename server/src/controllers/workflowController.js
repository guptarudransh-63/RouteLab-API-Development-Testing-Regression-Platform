import { Workflow } from '../models/Workflow.js';
import { RequestDefinition } from '../models/RequestDefinition.js';
import { Environment } from '../models/Environment.js';
import { Collection } from '../models/Collection.js';
import { runWorkflowSteps } from '../services/workflowRunner.js';

export async function getWorkflows(req, res, next) {
  try {
    const workflows = await Workflow.find({ owner: req.user._id })
      .populate('steps.requestId', 'name method url')
      .sort({ updatedAt: -1 });
    res.status(200).json({ success: true, workflows });
  } catch (err) {
    next(err);
  }
}

export async function createWorkflow(req, res, next) {
  try {
    const { name, description, steps } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Workflow name is required' });
    }

    const workflow = await Workflow.create({
      owner: req.user._id,
      name,
      description: description || '',
      steps: steps || [],
    });

    res.status(201).json({ success: true, workflow });
  } catch (err) {
    next(err);
  }
}

export async function getWorkflowById(req, res, next) {
  try {
    const workflow = await Workflow.findOne({ _id: req.params.id, owner: req.user._id }).populate(
      'steps.requestId'
    );
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.status(200).json({ success: true, workflow });
  } catch (err) {
    next(err);
  }
}

export async function updateWorkflow(req, res, next) {
  try {
    const { name, description, steps } = req.body;
    const workflow = await Workflow.findOne({ _id: req.params.id, owner: req.user._id });
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    if (name) workflow.name = name;
    if (description !== undefined) workflow.description = description;
    if (steps) workflow.steps = steps;

    await workflow.save();
    res.status(200).json({ success: true, workflow });
  } catch (err) {
    next(err);
  }
}

export async function deleteWorkflow(req, res, next) {
  try {
    const workflow = await Workflow.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.status(200).json({ success: true, message: 'Workflow deleted' });
  } catch (err) {
    next(err);
  }
}

export async function executeWorkflow(req, res, next) {
  try {
    const { id } = req.params;
    const { environmentId, initialRuntimeVars = {}, allowLocalOverride } = req.body;

    const workflow = await Workflow.findOne({ _id: id, owner: req.user._id }).populate('steps.requestId');
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      return res.status(400).json({ success: false, error: 'Workflow has no configured steps' });
    }

    // Load environment variables
    let environmentVars = [];
    if (environmentId) {
      const env = await Environment.findOne({ _id: environmentId, owner: req.user._id });
      if (env) {
        environmentVars = env.variables || [];
      }
    }

    const allowLocal =
      process.env.ALLOW_LOCAL_REQUESTS === 'true' ||
      req.user.preferences?.allowLocalRequests === true ||
      allowLocalOverride === true;

    // Build steps input array
    const stepDefinitions = workflow.steps
      .filter((s) => s.requestId)
      .map((s) => ({
        request: s.requestId,
        stopOnFailure: s.stopOnFailure,
        extract: s.extract || [],
      }));

    const result = await runWorkflowSteps({
      steps: stepDefinitions,
      environmentVars,
      initialRuntimeVars,
      allowLocal,
    });

    res.status(200).json({
      success: true,
      workflowId: workflow._id,
      workflowName: workflow.name,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}
