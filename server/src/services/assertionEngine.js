import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

/**
 * Safely resolves a nested property path from an object (e.g. "data.users[0].id" or "token")
 */
export function getByPath(obj, path) {
  if (!obj || typeof obj !== 'object' || !path) return undefined;

  // Normalize array notation data[0].id -> data.0.id
  const cleanPath = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '');
  const keys = cleanPath.split('.');

  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Evaluates a single assertion rule against an HTTP response.
 *
 * @param {Object} assertion - Assertion definition { id, name, target, property, operator, expectedValue }
 * @param {Object} response - Response object { statusCode, durationMs, headers, body, rawBody, isJson }
 * @returns {Object} { id, name, passed, expected, actual, message }
 */
export function evaluateAssertion(assertion, response) {
  const { id, name, target, property, operator, expectedValue } = assertion;

  let actualValue;
  let targetDesc = target;

  switch (target) {
    case 'statusCode':
      actualValue = response.statusCode;
      targetDesc = 'Status Code';
      break;

    case 'responseTime':
      actualValue = response.durationMs;
      targetDesc = 'Response Time (ms)';
      break;

    case 'header':
      const headerKey = (property || '').toLowerCase();
      actualValue = response.headers ? response.headers[headerKey] : undefined;
      targetDesc = `Header '${property}'`;
      break;

    case 'jsonPath':
      actualValue = response.isJson ? getByPath(response.body, property) : undefined;
      targetDesc = `JSON Path '${property}'`;
      break;

    case 'bodyText':
      actualValue = response.rawBody || (typeof response.body === 'string' ? response.body : JSON.stringify(response.body));
      targetDesc = 'Response Body';
      break;

    case 'jsonSchema':
      targetDesc = 'JSON Schema Validation';
      break;

    default:
      actualValue = undefined;
  }

  let passed = false;
  let message = '';

  try {
    switch (operator) {
      case 'equals':
        // Handle numeric coercion if comparing strings to numbers
        if (typeof actualValue === 'number' && !isNaN(Number(expectedValue))) {
          passed = actualValue === Number(expectedValue);
        } else {
          passed = String(actualValue) === String(expectedValue);
        }
        message = passed
          ? `${targetDesc} equals ${expectedValue}`
          : `Expected ${targetDesc} to equal '${expectedValue}', got '${actualValue}'`;
        break;

      case 'notEquals':
        passed = String(actualValue) !== String(expectedValue);
        message = passed
          ? `${targetDesc} does not equal ${expectedValue}`
          : `Expected ${targetDesc} not to equal '${expectedValue}'`;
        break;

      case 'lessThan':
        passed = Number(actualValue) < Number(expectedValue);
        message = passed
          ? `${targetDesc} (${actualValue}) is less than ${expectedValue}`
          : `Expected ${targetDesc} (${actualValue}) to be less than ${expectedValue}`;
        break;

      case 'greaterThan':
        passed = Number(actualValue) > Number(expectedValue);
        message = passed
          ? `${targetDesc} (${actualValue}) is greater than ${expectedValue}`
          : `Expected ${targetDesc} (${actualValue}) to be greater than ${expectedValue}`;
        break;

      case 'exists':
        passed = actualValue !== undefined && actualValue !== null;
        message = passed ? `${targetDesc} exists` : `Expected ${targetDesc} to exist`;
        break;

      case 'notExists':
        passed = actualValue === undefined || actualValue === null;
        message = passed ? `${targetDesc} does not exist` : `Expected ${targetDesc} to not exist`;
        break;

      case 'contains':
        if (Array.isArray(actualValue)) {
          passed = actualValue.some((item) => String(item).includes(String(expectedValue)));
        } else if (typeof actualValue === 'string') {
          passed = actualValue.includes(String(expectedValue));
        } else {
          passed = false;
        }
        message = passed
          ? `${targetDesc} contains '${expectedValue}'`
          : `Expected ${targetDesc} to contain '${expectedValue}'`;
        break;

      case 'notContains':
        if (typeof actualValue === 'string') {
          passed = !actualValue.includes(String(expectedValue));
        } else {
          passed = true;
        }
        message = passed
          ? `${targetDesc} does not contain '${expectedValue}'`
          : `Expected ${targetDesc} to not contain '${expectedValue}'`;
        break;

      case 'matchesRegex':
        const regex = new RegExp(String(expectedValue));
        passed = regex.test(String(actualValue ?? ''));
        message = passed
          ? `${targetDesc} matches regex /${expectedValue}/`
          : `Expected ${targetDesc} to match regex /${expectedValue}/, got '${actualValue}'`;
        break;

      case 'isType':
        const expectedType = String(expectedValue).toLowerCase();
        let actualType = typeof actualValue;
        if (actualValue === null) actualType = 'null';
        else if (Array.isArray(actualValue)) actualType = 'array';
        passed = actualType === expectedType;
        message = passed
          ? `${targetDesc} is of type ${expectedType}`
          : `Expected ${targetDesc} type to be '${expectedType}', got '${actualType}'`;
        break;

      default:
        passed = false;
        message = `Unknown assertion operator: ${operator}`;
    }
  } catch (err) {
    passed = false;
    message = `Assertion evaluation error: ${err.message}`;
  }

  return {
    assertionId: id,
    name: name || `${targetDesc} ${operator} ${expectedValue ?? ''}`.trim(),
    passed,
    target,
    operator,
    expected: expectedValue,
    actual: actualValue,
    message,
  };
}

/**
 * Runs a list of test assertions against a response.
 */
export function runAssertions(assertions = [], response) {
  if (!Array.isArray(assertions) || assertions.length === 0) {
    return {
      results: [],
      total: 0,
      passed: 0,
      failed: 0,
    };
  }

  const results = assertions
    .filter((a) => a.enabled !== false)
    .map((assertion) => evaluateAssertion(assertion, response));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return {
    results,
    total: results.length,
    passed,
    failed,
  };
}

/**
 * Extracts variables from response based on request extraction rules.
 */
export function extractVariablesFromResponse(extractions = [], response) {
  const extracted = {};
  if (!Array.isArray(extractions)) return extracted;

  for (const rule of extractions) {
    if (rule.enabled === false || !rule.varName) continue;

    let val;
    if (rule.source === 'statusCode') {
      val = response.statusCode;
    } else if (rule.source === 'header') {
      const headerKey = (rule.path || '').toLowerCase();
      val = response.headers ? response.headers[headerKey] : undefined;
    } else if (rule.source === 'body') {
      if (response.isJson && rule.path) {
        val = getByPath(response.body, rule.path);
      } else if (response.rawBody) {
        val = response.rawBody;
      }
    }

    if (val !== undefined && val !== null) {
      extracted[rule.varName] = typeof val === 'object' ? JSON.stringify(val) : String(val);
    }
  }

  return extracted;
}
