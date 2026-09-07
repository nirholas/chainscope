import { strict as assert } from 'node:assert';
import test from 'node:test';
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

function makeRequest(origin) {
  const headers = new Headers();
  if (origin !== null) {
    headers.set('origin', origin);
  }
  return new Request('https://chainscope.local/api/test', { headers });
}

test('allows desktop Tauri origins', () => {
  const origins = [
    'https://tauri.localhost',
    'https://abc123.tauri.localhost',
    'tauri://localhost',
    'asset://localhost',
    'http://127.0.0.1:46123',
  ];

  for (const origin of origins) {
    const req = makeRequest(origin);
    assert.equal(isDisallowedOrigin(req), false, `origin should be allowed: ${origin}`);
    const cors = getCorsHeaders(req);
    assert.equal(cors['Access-Control-Allow-Origin'], origin);
  }
});

test('allows local development origins with no configuration', () => {
  for (const origin of ['http://localhost:5173', 'https://localhost', 'http://[::1]:5173']) {
    assert.equal(isDisallowedOrigin(makeRequest(origin)), false, `should allow: ${origin}`);
  }
});

test('allows preview deployments on the common static hosts', () => {
  for (const origin of [
    'https://chainscope.vercel.app',
    'https://chainscope-git-main.vercel.app',
    'https://chainscope-abc123.run.app',
    'https://chainscope.pages.dev',
  ]) {
    assert.equal(isDisallowedOrigin(makeRequest(origin)), false, `should allow: ${origin}`);
  }
});

test('rejects an unrelated external origin', () => {
  const req = makeRequest('https://unrelated.example.com');
  assert.equal(isDisallowedOrigin(req), true);
  const cors = getCorsHeaders(req);
  // "null" is a valid header value matching no real origin, so the browser
  // blocks the read rather than handing the body to an unknown site.
  assert.equal(cors['Access-Control-Allow-Origin'], 'null');
});

test('does not let a lookalike domain pass as a preview host', () => {
  for (const origin of [
    'https://chainscope.vercel.app.example.com',
    'https://notchainscope.pages.dev',
  ]) {
    assert.equal(isDisallowedOrigin(makeRequest(origin)), true, `should reject: ${origin}`);
  }
});

test('requests without origin remain allowed', () => {
  assert.equal(isDisallowedOrigin(makeRequest(null)), false);
});

test('honours CHAINSCOPE_ALLOWED_ORIGINS for exact and subdomain entries', async () => {
  process.env.CHAINSCOPE_ALLOWED_ORIGINS = 'https://scope.example.com, .team.example.org';
  // The allowlist is compiled at module load, so import a fresh instance.
  const fresh = await import(`./_cors.js?configured=${Date.now()}`);
  delete process.env.CHAINSCOPE_ALLOWED_ORIGINS;

  for (const origin of [
    'https://scope.example.com',
    'https://team.example.org',
    'https://desk.team.example.org',
  ]) {
    assert.equal(fresh.isDisallowedOrigin(makeRequest(origin)), false, `should allow: ${origin}`);
  }

  // An exact entry must not also grant its subdomains.
  assert.equal(fresh.isDisallowedOrigin(makeRequest('https://other.example.com')), true);
  // A suffix entry must not match a domain that merely ends with the same text.
  assert.equal(fresh.isDisallowedOrigin(makeRequest('https://notteam.example.org')), true);
});
