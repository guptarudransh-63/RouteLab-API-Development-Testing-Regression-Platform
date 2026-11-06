import crypto from 'node:crypto';

export class UnresolvedVariableError extends Error {
  constructor(missingVariables) {
    super(`Missing required variables: ${missingVariables.join(', ')}`);
    this.name = 'UnresolvedVariableError';
    this.missingVariables = missingVariables;
    this.status = 400;
  }
}

/**
 * Builds a resolved dictionary with proper precedence.
 * Precedence: runtime (step extractions) > request-local > collection > environment > built-ins
 */
export function mergeVariableScopes({
  environmentVars = [],
  collectionVars = [],
  requestVars = [],
  runtimeVars = {},
}) {
  const merged = {};

  // 1. Environment variables
  if (Array.isArray(environmentVars)) {
    for (const v of environmentVars) {
      if (v.enabled !== false && v.key) {
        merged[v.key] = v.value ?? '';
      }
    }
  }

  // 2. Collection variables
  if (Array.isArray(collectionVars)) {
    for (const v of collectionVars) {
      if (v.key) {
        merged[v.key] = v.value ?? '';
      }
    }
  }

  // 3. Request variables
  if (Array.isArray(requestVars)) {
    for (const v of requestVars) {
      if (v.key) {
        merged[v.key] = v.value ?? '';
      }
    }
  }

  // 4. Runtime variables (from previous workflow steps or execution context)
  if (runtimeVars && typeof runtimeVars === 'object') {
    for (const [key, val] of Object.entries(runtimeVars)) {
      merged[key] = String(val ?? '');
    }
  }

  return merged;
}

/**
 * Replaces built-in dynamic variables
 */
function getBuiltInValue(varName) {
  switch (varName) {
    case '$timestamp':
      return Date.now().toString();
    case '$isoTimestamp':
      return new Date().toISOString();
    case '$guid':
    case '$uuid':
      return crypto.randomUUID();
    case '$randomInt':
      return Math.floor(Math.random() * 1000).toString();
    default:
      return null;
  }
}

/**
 * Resolves all {{variable}} patterns in a string.
 */
export function resolveStringVariables(template, variables = {}, { strict = true } = {}) {
  if (typeof template !== 'string') return template;

  const missing = new Set();
  const regex = /\{\{([a-zA-Z0-9_$.-]+)\}\}/g;

  const resolved = template.replace(regex, (match, varName) => {
    const trimmed = varName.trim();
    if (trimmed.startsWith('$')) {
      const builtIn = getBuiltInValue(trimmed);
      if (builtIn !== null) return builtIn;
    }

    if (Object.prototype.hasOwnProperty.call(variables, trimmed)) {
      return variables[trimmed];
    }

    missing.add(trimmed);
    return match; // Keep unresolved for now
  });

  if (strict && missing.size > 0) {
    throw new UnresolvedVariableError(Array.from(missing));
  }

  return resolved;
}

/**
 * Deeply resolves variables in an object or array.
 */
export function resolveDeepVariables(data, variables = {}, { strict = true } = {}) {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return resolveStringVariables(data, variables, { strict });
  }

  if (Array.isArray(data)) {
    return data.map((item) => resolveDeepVariables(item, variables, { strict }));
  }

  if (typeof data === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(data)) {
      const resolvedKey = resolveStringVariables(key, variables, { strict: false });
      result[resolvedKey] = resolveDeepVariables(val, variables, { strict });
    }
    return result;
  }

  return data;
}
