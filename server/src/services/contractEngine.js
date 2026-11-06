/**
 * RouteLab API Contract Change Detection Engine
 */

const VOLATILE_KEY_REGEX = /^(timestamp|created_?at|updated_?at|last_?modified|date|uuid|id|_id|request_?id|trace_?id|token|access_?token|nonce|etag)$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Infers a normalized structural schema from a response JSON payload.
 * Normalizes volatile fields (dates, IDs, tokens) to preserve structural integrity without false alarms.
 */
export function inferResponseSchema(data, path = '$') {
  if (data === null) {
    return { type: 'null', path };
  }

  if (data === undefined) {
    return { type: 'undefined', path };
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { type: 'array', items: { type: 'any', path: `${path}[]` }, length: 0, path };
    }

    // Infer item schemas and merge them to handle heterogeneous array items
    const itemSchemas = data.slice(0, 10).map((item) => inferResponseSchema(item, `${path}[]`));
    const mergedItemSchema = mergeArrayItemSchemas(itemSchemas);

    return {
      type: 'array',
      items: mergedItemSchema,
      sampleSize: data.length,
      path,
    };
  }

  if (typeof data === 'object') {
    const properties = {};
    const required = [];

    for (const [key, val] of Object.entries(data)) {
      const childPath = `${path}.${key}`;
      const isVolatile = VOLATILE_KEY_REGEX.test(key);
      const childSchema = inferResponseSchema(val, childPath);

      if (isVolatile) {
        childSchema.volatile = true;
      }

      properties[key] = childSchema;
      if (val !== null && val !== undefined) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.sort(),
      path,
    };
  }

  if (typeof data === 'string') {
    let format = null;
    let isVolatile = false;

    if (ISO_DATE_REGEX.test(data)) {
      format = 'date-time';
      isVolatile = true;
    } else if (UUID_REGEX.test(data)) {
      format = 'uuid';
      isVolatile = true;
    }

    return {
      type: 'string',
      format,
      volatile: isVolatile,
      path,
    };
  }

  if (typeof data === 'number') {
    return {
      type: Number.isInteger(data) ? 'integer' : 'number',
      path,
    };
  }

  if (typeof data === 'boolean') {
    return {
      type: 'boolean',
      path,
    };
  }

  return { type: typeof data, path };
}

/**
 * Merges multiple item schemas found in an array into a unified representation.
 */
function mergeArrayItemSchemas(schemas) {
  if (!schemas || schemas.length === 0) return { type: 'any' };
  const first = schemas[0];
  const allSameType = schemas.every((s) => s.type === first.type);

  if (!allSameType) {
    const types = Array.from(new Set(schemas.map((s) => s.type)));
    return { type: 'union', types };
  }

  if (first.type === 'object') {
    const mergedProps = {};
    for (const s of schemas) {
      if (s.properties) {
        for (const [k, v] of Object.entries(s.properties)) {
          if (!mergedProps[k]) {
            mergedProps[k] = v;
          }
        }
      }
    }
    return { type: 'object', properties: mergedProps };
  }

  return first;
}

/**
 * Deeply compares candidate schema against baseline schema and produces classified findings.
 */
export function diffSchemas(baseline, candidate, findings = []) {
  if (!baseline && !candidate) return findings;

  // 1. Both schemas exist: check type mismatch
  if (baseline && candidate) {
    if (baseline.type !== candidate.type) {
      // Type changed (e.g. string -> number, or object -> array)
      const severity = candidate.type === 'null' ? 'potentially_breaking' : 'breaking';
      findings.push({
        severity,
        changeType: 'type_mismatch',
        jsonPath: baseline.path || '$',
        previousValue: baseline.type,
        newValue: candidate.type,
        explanation: `Field '${baseline.path}' type changed from '${baseline.type}' to '${candidate.type}'.`,
      });
      return findings;
    }

    // 2. Objects: check removed fields, added fields, and mutated children
    if (baseline.type === 'object' && candidate.type === 'object') {
      const baseProps = baseline.properties || {};
      const candProps = candidate.properties || {};

      // Check for removed fields (breaking!)
      for (const [propName, baseProp] of Object.entries(baseProps)) {
        if (!candProps[propName]) {
          findings.push({
            severity: 'breaking',
            changeType: 'removed_field',
            jsonPath: `${baseline.path}.${propName}`,
            previousValue: baseProp.type,
            newValue: undefined,
            explanation: `Required field '${propName}' present in baseline was removed from response.`,
          });
        } else {
          // Recursively diff matching property
          diffSchemas(baseProp, candProps[propName], findings);
        }
      }

      // Check for newly added fields (non-breaking extension)
      for (const [propName, candProp] of Object.entries(candProps)) {
        if (!baseProps[propName]) {
          findings.push({
            severity: 'non_breaking',
            changeType: 'added_field',
            jsonPath: `${candidate.path}.${propName}`,
            previousValue: undefined,
            newValue: candProp.type,
            explanation: `New field '${propName}' was added to response object.`,
          });
        }
      }
    }

    // 3. Arrays: check items
    if (baseline.type === 'array' && candidate.type === 'array') {
      if (baseline.items && candidate.items) {
        diffSchemas(baseline.items, candidate.items, findings);
      }
    }
  }

  return findings;
}

/**
 * Performs a comprehensive API contract comparison between baseline snapshot and candidate response.
 */
export function compareContract({
  baselineSnapshot,
  candidateResponse,
  latencyThresholdMs = 2000,
}) {
  const findings = [];

  if (!baselineSnapshot) {
    return {
      findings: [],
      hasBreakingChanges: false,
      summary: { breaking: 0, potentiallyBreaking: 0, nonBreaking: 0 },
    };
  }

  // 1. Status Code Comparison
  if (baselineSnapshot.statusCode !== candidateResponse.statusCode) {
    findings.push({
      severity: 'breaking',
      changeType: 'status_code_changed',
      jsonPath: '$',
      previousValue: baselineSnapshot.statusCode,
      newValue: candidateResponse.statusCode,
      explanation: `HTTP Status Code changed from ${baselineSnapshot.statusCode} to ${candidateResponse.statusCode}.`,
    });
  }

  // 2. Response Headers (Content-Type & critical contract headers)
  const baselineContentType = (baselineSnapshot.headers?.['content-type'] || '').split(';')[0].trim();
  const candidateContentType = (candidateResponse.headers?.['content-type'] || '').split(';')[0].trim();

  if (baselineContentType && candidateContentType && baselineContentType !== candidateContentType) {
    findings.push({
      severity: 'breaking',
      changeType: 'content_type_mismatch',
      jsonPath: 'headers.content-type',
      previousValue: baselineContentType,
      newValue: candidateContentType,
      explanation: `Content-Type changed from '${baselineContentType}' to '${candidateContentType}'.`,
    });
  }

  // 3. Schema Diffing
  let candidateSchema = null;
  if (candidateResponse.isJson && candidateResponse.body !== null) {
    candidateSchema = inferResponseSchema(candidateResponse.body);
    diffSchemas(baselineSnapshot.normalizedSchema, candidateSchema, findings);
  } else if (baselineSnapshot.normalizedSchema && !candidateResponse.isJson) {
    findings.push({
      severity: 'breaking',
      changeType: 'non_json_response',
      jsonPath: '$',
      previousValue: 'application/json',
      newValue: 'non-json',
      explanation: 'Response body is no longer valid JSON contrary to baseline contract.',
    });
  }

  // 4. Latency / Performance Regression check
  if (baselineSnapshot.responseTimeMs && candidateResponse.durationMs) {
    const delta = candidateResponse.durationMs - baselineSnapshot.responseTimeMs;
    if (candidateResponse.durationMs > latencyThresholdMs && delta > 500) {
      findings.push({
        severity: 'performance_regression',
        changeType: 'latency_threshold',
        jsonPath: 'meta.durationMs',
        previousValue: `${baselineSnapshot.responseTimeMs}ms`,
        newValue: `${candidateResponse.durationMs}ms`,
        explanation: `Response time increased by ${delta}ms (${baselineSnapshot.responseTimeMs}ms -> ${candidateResponse.durationMs}ms), exceeding performance threshold.`,
      });
    }
  }

  // Summary counts
  const breakingCount = findings.filter((f) => f.severity === 'breaking').length;
  const potentiallyBreakingCount = findings.filter((f) => f.severity === 'potentially_breaking').length;
  const nonBreakingCount = findings.filter((f) => f.severity === 'non_breaking').length;
  const performanceCount = findings.filter((f) => f.severity === 'performance_regression').length;

  return {
    findings,
    candidateSchema,
    hasBreakingChanges: breakingCount > 0,
    summary: {
      breaking: breakingCount,
      potentiallyBreaking: potentiallyBreakingCount,
      nonBreaking: nonBreakingCount,
      performance: performanceCount,
      total: findings.length,
    },
  };
}
