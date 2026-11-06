import YAML from 'yaml';

/**
 * Parses and validates an OpenAPI 3.0 / Swagger 2.0 document from JSON or YAML string.
 */
export function parseOpenApiSpec(rawContent) {
  let spec;
  try {
    if (typeof rawContent === 'object' && rawContent !== null) {
      spec = rawContent;
    } else {
      const trimmed = String(rawContent).trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        spec = JSON.parse(trimmed);
      } else {
        spec = YAML.parse(trimmed);
      }
    }
  } catch (err) {
    throw new Error(`Failed to parse OpenAPI document: ${err.message}`);
  }

  if (!spec || (!spec.openapi && !spec.swagger)) {
    throw new Error('Invalid specification: missing "openapi" or "swagger" version declaration');
  }

  if (!spec.paths || typeof spec.paths !== 'object') {
    throw new Error('Invalid specification: missing "paths" object');
  }

  return spec;
}

/**
 * Converts OpenAPI paths and operations into RouteLab RequestDefinition items.
 */
export function convertOpenApiToRequests(spec, defaultBaseUrl = '{{baseUrl}}') {
  const requests = [];
  const paths = spec.paths || {};

  // Extract base URL if available in servers array
  let serverBase = defaultBaseUrl;
  if (Array.isArray(spec.servers) && spec.servers.length > 0 && spec.servers[0].url) {
    serverBase = spec.servers[0].url.replace(/\/$/, '');
  }

  const validMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

  for (const [pathStr, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const [methodKey, operation] of Object.entries(pathItem)) {
      const methodLower = methodKey.toLowerCase();
      if (!validMethods.includes(methodLower) || !operation) continue;

      const name = operation.summary || operation.operationId || `${methodKey.toUpperCase()} ${pathStr}`;
      const description = operation.description || '';

      // Convert path params /users/{id} to query or url
      const queryParams = [];
      const headers = [];

      if (Array.isArray(operation.parameters)) {
        for (const p of operation.parameters) {
          if (p.in === 'query') {
            queryParams.push({
              key: p.name,
              value: p.example || (p.schema?.default ?? ''),
              enabled: p.required ?? false,
              description: p.description || '',
            });
          } else if (p.in === 'header') {
            headers.push({
              key: p.name,
              value: p.example || '',
              enabled: p.required ?? false,
              description: p.description || '',
            });
          }
        }
      }

      // Handle request body
      let bodyType = 'none';
      let rawBody = '';

      if (operation.requestBody?.content) {
        const jsonContent = operation.requestBody.content['application/json'];
        if (jsonContent) {
          bodyType = 'json';
          if (jsonContent.example) {
            rawBody = JSON.stringify(jsonContent.example, null, 2);
          } else if (jsonContent.schema?.example) {
            rawBody = JSON.stringify(jsonContent.schema.example, null, 2);
          } else {
            rawBody = '{\n  \n}';
          }
          headers.push({
            key: 'Content-Type',
            value: 'application/json',
            enabled: true,
            description: 'Generated from OpenAPI',
          });
        }
      }

      // Generate basic status assertion from responses
      const tests = [];
      const responseCodes = Object.keys(operation.responses || {});
      const successCode = responseCodes.find((c) => c.startsWith('2')) || '200';
      tests.push({
        id: `test_${Math.random().toString(36).substring(2, 9)}`,
        name: `Status code is ${successCode}`,
        target: 'statusCode',
        property: '',
        operator: 'equals',
        expectedValue: successCode,
        enabled: true,
      });

      // Construct normalized URL
      const finalUrl = `${serverBase}${pathStr}`;

      requests.push({
        name,
        description,
        method: methodKey.toUpperCase(),
        url: finalUrl,
        params: queryParams,
        headers,
        auth: { type: 'none' },
        body: { type: bodyType, raw: rawBody },
        tests,
      });
    }
  }

  return requests;
}

/**
 * Compares two OpenAPI specs and detects added, removed, and modified endpoints.
 */
export function compareOpenApiSpecs(oldSpec, newSpec) {
  const oldEndpoints = new Set();
  const newEndpoints = new Set();

  for (const [pathStr, pathItem] of Object.entries(oldSpec.paths || {})) {
    for (const method of Object.keys(pathItem || {})) {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
        oldEndpoints.add(`${method.toUpperCase()} ${pathStr}`);
      }
    }
  }

  for (const [pathStr, pathItem] of Object.entries(newSpec.paths || {})) {
    for (const method of Object.keys(pathItem || {})) {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
        newEndpoints.add(`${method.toUpperCase()} ${pathStr}`);
      }
    }
  }

  const added = [];
  const removed = [];

  for (const ep of newEndpoints) {
    if (!oldEndpoints.has(ep)) added.push(ep);
  }

  for (const ep of oldEndpoints) {
    if (!newEndpoints.has(ep)) removed.push(ep);
  }

  return {
    added,
    removed,
    isBreaking: removed.length > 0,
    totalOld: oldEndpoints.size,
    totalNew: newEndpoints.size,
  };
}
