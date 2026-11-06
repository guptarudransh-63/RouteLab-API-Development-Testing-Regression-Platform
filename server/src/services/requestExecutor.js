import { performance } from 'node:perf_hooks';
import { validateOutboundUrl, SSRFSecurityError } from './ssrfShield.js';
import { mergeVariableScopes, resolveStringVariables, resolveDeepVariables } from './variableResolver.js';

export class RequestExecutionError extends Error {
  constructor(message, originalError = null, isNetworkFailure = true) {
    super(message);
    this.name = 'RequestExecutionError';
    this.isNetworkFailure = isNetworkFailure;
    this.originalError = originalError;
  }
}

/**
 * Builds the final URL with query parameters.
 */
function buildFinalUrl(rawUrl, params = [], variables = {}) {
  const resolvedUrlStr = resolveStringVariables(rawUrl, variables, { strict: true });
  const urlObj = new URL(resolvedUrlStr);

  if (Array.isArray(params)) {
    for (const p of params) {
      if (p.enabled !== false && p.key) {
        const resolvedKey = resolveStringVariables(p.key, variables, { strict: false });
        const resolvedVal = resolveStringVariables(p.value || '', variables, { strict: false });
        urlObj.searchParams.append(resolvedKey, resolvedVal);
      }
    }
  }

  return urlObj;
}

/**
 * Builds final request headers with auth and content-type.
 */
function buildHeaders(headers = [], auth = {}, body = {}, variables = {}) {
  const finalHeaders = {};

  // User-defined headers
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h.enabled !== false && h.key) {
        const resolvedKey = resolveStringVariables(h.key, variables, { strict: false });
        const resolvedVal = resolveStringVariables(h.value || '', variables, { strict: false });
        finalHeaders[resolvedKey] = resolvedVal;
      }
    }
  }

  // Authorization handling
  if (auth && auth.type) {
    if (auth.type === 'bearer' && auth.bearer?.token) {
      const token = resolveStringVariables(auth.bearer.token, variables, { strict: false });
      finalHeaders['Authorization'] = `Bearer ${token}`;
    } else if (auth.type === 'basic' && auth.basic) {
      const user = resolveStringVariables(auth.basic.username || '', variables, { strict: false });
      const pass = resolveStringVariables(auth.basic.password || '', variables, { strict: false });
      const creds = Buffer.from(`${user}:${pass}`).toString('base64');
      finalHeaders['Authorization'] = `Basic ${creds}`;
    } else if (auth.type === 'apikey' && auth.apikey?.addTo === 'header' && auth.apikey?.key) {
      const key = resolveStringVariables(auth.apikey.key, variables, { strict: false });
      const val = resolveStringVariables(auth.apikey.value || '', variables, { strict: false });
      finalHeaders[key] = val;
    }
  }

  // Body content-type handling
  if (body?.type === 'json' && !finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
    finalHeaders['Content-Type'] = 'application/json';
  } else if (body?.type === 'urlencoded' && !finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
    finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  return finalHeaders;
}

/**
 * Serializes the request body based on type.
 */
function buildBody(method, body = {}, variables = {}) {
  if (['GET', 'HEAD'].includes(method.toUpperCase())) {
    return undefined;
  }

  if (!body || body.type === 'none') {
    return undefined;
  }

  if (body.type === 'json') {
    if (!body.raw) return undefined;
    const resolvedRaw = resolveStringVariables(body.raw, variables, { strict: false });
    try {
      // Validate that it's parseable JSON
      JSON.parse(resolvedRaw);
      return resolvedRaw;
    } catch (err) {
      throw new RequestExecutionError(`Invalid JSON in request body: ${err.message}`, err, false);
    }
  }

  if (body.type === 'urlencoded') {
    const params = new URLSearchParams();
    if (Array.isArray(body.urlencoded)) {
      for (const item of body.urlencoded) {
        if (item.enabled !== false && item.key) {
          const k = resolveStringVariables(item.key, variables, { strict: false });
          const v = resolveStringVariables(item.value || '', variables, { strict: false });
          params.append(k, v);
        }
      }
    }
    return params.toString();
  }

  if (body.type === 'raw') {
    return resolveStringVariables(body.raw || '', variables, { strict: false });
  }

  return undefined;
}

/**
 * Executes a request definition safely and returns response and timing metadata.
 */
export async function executeRequest({
  request,
  environmentVars = [],
  collectionVars = [],
  runtimeVars = {},
  allowLocal = false,
  timeoutMs = 15000,
  abortSignal = null,
}) {
  // 1. Merge variables with strict precedence
  const variables = mergeVariableScopes({
    environmentVars,
    collectionVars,
    requestVars: request.params ? [] : [],
    runtimeVars,
  });

  // 2. Build final URL & query parameters
  const finalUrl = buildFinalUrl(request.url, request.params, variables);

  // If apikey is added to query
  if (request.auth?.type === 'apikey' && request.auth.apikey?.addTo === 'query' && request.auth.apikey.key) {
    const k = resolveStringVariables(request.auth.apikey.key, variables, { strict: false });
    const v = resolveStringVariables(request.auth.apikey.value || '', variables, { strict: false });
    finalUrl.searchParams.append(k, v);
  }

  // 3. Security Check: SSRF Shield validation
  await validateOutboundUrl(finalUrl.toString(), allowLocal);

  // 4. Build headers & body
  const method = (request.method || 'GET').toUpperCase();
  const headers = buildHeaders(request.headers, request.auth, request.body, variables);
  const serializedBody = buildBody(method, request.body, variables);

  // 5. Setup timeout with AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  if (abortSignal) {
    abortSignal.addEventListener('abort', () => controller.abort(abortSignal.reason));
  }

  const startTime = performance.now();
  let rawResponse;
  let status = 0;
  let statusText = '';
  let responseHeaders = {};
  let responseBody = null;
  let responseSize = 0;
  let isJson = false;

  try {
    rawResponse = await fetch(finalUrl.toString(), {
      method,
      headers,
      body: serializedBody,
      signal: controller.signal,
      redirect: 'manual', // We handle redirects manually to prevent SSRF bypass via redirects!
    });

    clearTimeout(timeoutId);

    // 6. Handle Redirects with SSRF re-validation
    if ([301, 302, 303, 307, 308].includes(rawResponse.status)) {
      const redirectLocation = rawResponse.headers.get('location');
      if (redirectLocation) {
        const nextUrl = new URL(redirectLocation, finalUrl.toString()).toString();
        // Re-validate redirect destination
        await validateOutboundUrl(nextUrl, allowLocal);
        // Execute redirect fetch
        const redirectRes = await fetch(nextUrl, {
          method: [301, 302, 303].includes(rawResponse.status) ? 'GET' : method,
          headers,
          signal: controller.signal,
        });
        rawResponse = redirectRes;
      }
    }

    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    status = rawResponse.status;
    statusText = rawResponse.statusText;

    // Extract headers
    rawResponse.headers.forEach((val, key) => {
      responseHeaders[key.toLowerCase()] = val;
    });

    const contentType = responseHeaders['content-type'] || '';
    const textData = await rawResponse.text();
    responseSize = Buffer.byteLength(textData, 'utf8');

    if (contentType.includes('application/json') || (textData.startsWith('{') || textData.startsWith('['))) {
      try {
        responseBody = JSON.parse(textData);
        isJson = true;
      } catch {
        responseBody = textData;
      }
    } else {
      responseBody = textData;
    }

    return {
      success: true,
      statusCode: status,
      statusText: statusText || (status >= 200 && status < 300 ? 'OK' : 'Response'),
      durationMs,
      responseSize,
      headers: responseHeaders,
      body: responseBody,
      rawBody: textData,
      isJson,
      requestMetadata: {
        method,
        finalUrl: finalUrl.toString(),
        headers: redactSensitiveHeaders(headers),
      },
      error: null,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const durationMs = Math.round(performance.now() - startTime);

    const isSSRF = err instanceof SSRFSecurityError;
    return {
      success: false,
      statusCode: 0,
      statusText: isSSRF ? 'SSRF Blocked' : 'Network Error',
      durationMs,
      responseSize: 0,
      headers: {},
      body: null,
      rawBody: '',
      isJson: false,
      requestMetadata: {
        method,
        finalUrl: finalUrl.toString(),
      },
      error: err.message || 'Network request failed',
      isNetworkFailure: true,
      isSSRF,
    };
  }
}

function redactSensitiveHeaders(headers = {}) {
  const clean = { ...headers };
  for (const k of Object.keys(clean)) {
    if (['authorization', 'cookie', 'x-api-key'].includes(k.toLowerCase())) {
      clean[k] = '[REDACTED]';
    }
  }
  return clean;
}
