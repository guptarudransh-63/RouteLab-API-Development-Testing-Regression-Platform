import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export class SSRFSecurityError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SSRFSecurityError';
    this.status = 403;
    this.details = details;
  }
}

/**
 * Checks if a parsed IP address falls into restricted/private/reserved subnets.
 */
export function isPrivateOrRestrictedIP(ipString) {
  let addr;
  try {
    addr = ipaddr.parse(ipString);
  } catch {
    return true; // Invalid IP is treated as restricted
  }

  // IPv4 mapped in IPv6 (e.g. ::ffff:127.0.0.1)
  if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
    addr = addr.toIPv4Address();
  }

  const range = addr.range();

  // Blocked ranges
  const blockedRanges = [
    'loopback', // 127.0.0.0/8 or ::1
    'private', // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    'linkLocal', // 169.254.0.0/16, fe80::/10
    'multicast', // 224.0.0.0/4, ff00::/8
    'broadcast',
    'reserved',
    'carrierGradeNat', // 100.64.0.0/10
    'unspecified', // 0.0.0.0
  ];

  if (blockedRanges.includes(range)) {
    return true;
  }

  // Explicit check for cloud metadata endpoint 169.254.169.254
  const normalized = addr.toString();
  if (normalized === '169.254.169.254' || normalized === 'metadata.google.internal') {
    return true;
  }

  return false;
}

/**
 * Validates a target URL and its resolved IP addresses against SSRF attack vectors.
 * @param {string} rawUrl - Target URL to inspect
 * @param {boolean} allowLocal - Explicit flag allowing local network/loopback destinations
 * @returns {Promise<{ validUrl: URL, resolvedIPs: string[], pinnedIP: string }>}
 */
export async function validateOutboundUrl(rawUrl, allowLocal = false) {
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (err) {
    throw new SSRFSecurityError(`Invalid URL format: ${rawUrl}`, { rawUrl });
  }

  // 1. Scheme validation: only http and https are allowed
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new SSRFSecurityError(
      `Unsupported protocol '${parsedUrl.protocol}'. Only 'http:' and 'https:' are permitted.`,
      { protocol: parsedUrl.protocol }
    );
  }

  // 2. Block userinfo embedded credentials (e.g. http://user:pass@evil.com)
  if (parsedUrl.username || parsedUrl.password) {
    throw new SSRFSecurityError('Userinfo embedded in URL is not allowed for security reasons.', {
      host: parsedUrl.host,
    });
  }

  const hostname = parsedUrl.hostname;

  // 3. Obvious localhost and metadata string checks
  if (
    !allowLocal &&
    (hostname.toLowerCase() === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.toLowerCase() === 'metadata.google.internal' ||
      hostname.toLowerCase() === 'instance-data')
  ) {
    throw new SSRFSecurityError(
      `Access to loopback or metadata destination '${hostname}' is blocked. Enable Local Development Mode to access localhost.`,
      { hostname }
    );
  }

  // 4. Resolve hostname to all IP addresses (DNS resolution)
  let resolvedIPs = [];
  try {
    // If hostname is already an IP
    if (ipaddr.isValid(hostname)) {
      resolvedIPs = [hostname];
    } else {
      const addresses = await dns.lookup(hostname, { all: true });
      resolvedIPs = addresses.map((a) => a.address);
    }
  } catch (err) {
    throw new SSRFSecurityError(`DNS resolution failed for hostname '${hostname}': ${err.message}`, {
      hostname,
    });
  }

  if (resolvedIPs.length === 0) {
    throw new SSRFSecurityError(`No IP addresses could be resolved for '${hostname}'.`, { hostname });
  }

  // 5. Evaluate all resolved IP addresses against private / restricted subnets
  if (!allowLocal) {
    for (const ip of resolvedIPs) {
      if (isPrivateOrRestrictedIP(ip)) {
        throw new SSRFSecurityError(
          `Destination host '${hostname}' resolved to private/restricted IP address '${ip}'. Outbound access denied.`,
          { hostname, resolvedIp: ip }
        );
      }
    }
  }

  return {
    validUrl: parsedUrl,
    resolvedIPs,
    pinnedIP: resolvedIPs[0], // Pin primary IP for DNS rebinding mitigation
  };
}

/**
 * Redacts sensitive tokens and credentials from logs, reports, and exported data.
 */
export function redactSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const SENSITIVE_KEYS = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'api-key',
    'apikey',
    'password',
    'token',
    'secret',
    'jwt',
    'bearer',
    'client_secret',
  ];

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item));
  }

  const redacted = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      redacted[key] = redactSensitiveData(val);
    } else {
      redacted[key] = val;
    }
  }
  return redacted;
}
