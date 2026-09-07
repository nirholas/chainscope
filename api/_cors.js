/**
 * Origin allowlist for Chainscope API routes.
 *
 * Chainscope is meant to be self-hosted, so the allowlist is configuration, not
 * a hardcoded list of one operator's domains. Deployments add their own origins
 * through CHAINSCOPE_ALLOWED_ORIGINS (comma-separated). Each entry is either an
 * exact origin ("https://scope.example.com") or a leading-dot suffix that also
 * matches subdomains (".example.com" allows example.com and any subdomain).
 *
 * Local development, Tauri desktop shells and preview deployments are always
 * allowed, so a fresh clone works with no configuration at all.
 */

/**
 * Sent when the request's origin is not allowed. The literal string "null" is a
 * valid Access-Control-Allow-Origin value that matches no real origin, so the
 * browser blocks the read instead of handing the response to an unknown site.
 */
const DENIED_ORIGIN = 'null';

/** Origins that always work, so `npm run dev` and the desktop build need no setup. */
const BUILTIN_ORIGIN_PATTERNS = [
  // Local development
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/\[::1\](:\d+)?$/,
  // Tauri desktop shells
  /^https:\/\/tauri\.localhost(:\d+)?$/i,
  /^https:\/\/[a-z0-9-]+\.tauri\.localhost(:\d+)?$/i,
  /^tauri:\/\/localhost$/,
  /^asset:\/\/localhost$/,
  // Preview deployments on the common static hosts
  /^https:\/\/chainscope[a-z0-9-]*\.vercel\.app$/i,
  /^https:\/\/chainscope[a-z0-9-]*\.run\.app$/i,
  /^https:\/\/chainscope[a-z0-9-]*\.pages\.dev$/i,
];

/** Escape a string for literal use inside a RegExp. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile one CHAINSCOPE_ALLOWED_ORIGINS entry into a matcher.
 * A leading dot means "this domain and any subdomain".
 */
function compileConfiguredOrigin(entry) {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('.')) {
    const domain = escapeRegExp(trimmed.slice(1));
    return new RegExp(`^https?://([a-z0-9-]+\\.)*${domain}(:\\d+)?$`, 'i');
  }
  return new RegExp(`^${escapeRegExp(trimmed)}$`, 'i');
}

function readConfiguredOrigins() {
  const raw =
    (typeof process !== 'undefined' && process.env && process.env.CHAINSCOPE_ALLOWED_ORIGINS) || '';
  return raw.split(',').map(compileConfiguredOrigin).filter(Boolean);
}

// Read once per cold start: serverless instances are short-lived, and re-parsing
// the same env var on every request would be pure overhead.
const ALLOWED_ORIGIN_PATTERNS = [...BUILTIN_ORIGIN_PATTERNS, ...readConfiguredOrigins()];

export function isAllowedOrigin(origin) {
  return Boolean(origin) && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

export function getCorsHeaders(req, methods = 'GET, OPTIONS') {
  const origin = req.headers.get('origin') || '';
  const allowOrigin = isAllowedOrigin(origin) ? origin : DENIED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function isDisallowedOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  return !isAllowedOrigin(origin);
}
