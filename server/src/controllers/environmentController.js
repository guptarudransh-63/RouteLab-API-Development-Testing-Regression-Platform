import { Environment } from '../models/Environment.js';

export async function getEnvironments(req, res, next) {
  try {
    const environments = await Environment.find({ owner: req.user._id }).sort({ isDefault: -1, createdAt: 1 });
    res.status(200).json({ success: true, environments });
  } catch (err) {
    next(err);
  }
}

export async function createEnvironment(req, res, next) {
  try {
    const { name, variables, isDefault } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Environment name is required' });
    }

    if (isDefault) {
      await Environment.updateMany({ owner: req.user._id }, { isDefault: false });
    }

    const environment = await Environment.create({
      owner: req.user._id,
      name,
      variables: variables || [],
      isDefault: isDefault || false,
    });

    res.status(201).json({ success: true, environment });
  } catch (err) {
    next(err);
  }
}

export async function getEnvironmentById(req, res, next) {
  try {
    const environment = await Environment.findOne({ _id: req.params.id, owner: req.user._id });
    if (!environment) {
      return res.status(404).json({ success: false, error: 'Environment not found' });
    }
    res.status(200).json({ success: true, environment });
  } catch (err) {
    next(err);
  }
}

export async function updateEnvironment(req, res, next) {
  try {
    const { name, variables, isDefault } = req.body;
    const environment = await Environment.findOne({ _id: req.params.id, owner: req.user._id });
    if (!environment) {
      return res.status(404).json({ success: false, error: 'Environment not found' });
    }

    if (name) environment.name = name;
    if (variables) environment.variables = variables;
    if (isDefault !== undefined) {
      if (isDefault) {
        await Environment.updateMany({ owner: req.user._id }, { isDefault: false });
      }
      environment.isDefault = isDefault;
    }

    await environment.save();
    res.status(200).json({ success: true, environment });
  } catch (err) {
    next(err);
  }
}

export async function deleteEnvironment(req, res, next) {
  try {
    const environment = await Environment.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!environment) {
      return res.status(404).json({ success: false, error: 'Environment not found' });
    }
    res.status(200).json({ success: true, message: 'Environment deleted' });
  } catch (err) {
    next(err);
  }
}

export async function exportEnvironment(req, res, next) {
  try {
    const environment = await Environment.findOne({ _id: req.params.id, owner: req.user._id });
    if (!environment) {
      return res.status(404).json({ success: false, error: 'Environment not found' });
    }

    const safeVariables = environment.variables.map((v) => ({
      key: v.key,
      value: v.isSecret ? '' : v.value,
      isSecret: v.isSecret,
      enabled: v.enabled,
    }));

    res.status(200).json({
      routelab_schema: '1.0.0',
      type: 'environment',
      name: environment.name,
      variables: safeVariables,
    });
  } catch (err) {
    next(err);
  }
}
