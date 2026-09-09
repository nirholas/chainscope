#!/usr/bin/env node
/**
 * Audit every API route against a running deployment.
 *
 * Walks api/, calls each route, and classifies the response. A route is only
 * FAIL if it is actually broken: a non-2xx status, a non-JSON body where JSON is
 * expected, or a 200 whose payload carries an error. A route that answers
 * honestly with "no API key configured" is reported as UNCONFIGURED, not broken,
 * because that is the designed behaviour for the optional lanes.
 *
 *   node scripts/audit-routes.mjs
 *   node scripts/audit-routes.mjs --base http://localhost:3000
 *   node scripts/audit-routes.mjs --json report.json
 *
 * Exits non-zero if any route FAILs.
 */
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = path.join(ROOT, 'api');

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = arg('--base', 'https://chainscope-8m2.pages.dev');
const JSON_OUT = arg('--json', null);
const TIMEOUT_MS = Number(arg('--timeout', '45000'));
const CONCURRENCY = Number(arg('--concurrency', '6'));

/**
 * Query strings for routes that require parameters. Without these a route
 * correctly returns 400 and the audit would read it as broken.
 */
const ROUTE_PARAMS = {
  'stock-index': '?code=SPX',
  'temporal-baseline': '?type=earthquakes&count=5',
  'wallet-tracker': '?wallets=0x0000000000000000000000000000000000000000',
  worldbank: '?indicator=IT.NET.USER.ZS',
  coingecko: '?ids=bitcoin&vs_currencies=usd',
  'coingecko-markets': '?ids=bitcoin,ethereum',
  finnhub: '?symbols=AAPL',
  'yahoo-finance': '?symbol=AAPL',
  'youtube/live': '?channel=@CNBC',
  'youtube/embed': '?videoId=dQw4w9WgXcQ',
  'country-intel': '?country=US',
  'classify-event': '?text=test',
  'gdelt-doc': '?query=crypto',
  'fred-data': '?series_id=DGS10',
  download: '?url=https://example.com/x.json',
  rss: '?url=https://feeds.bbci.co.uk/news/rss.xml',
  'rss-proxy': '?url=https://feeds.bbci.co.uk/news/rss.xml',
  'wingbits/details/[icao24]': '/abc123',
  'eia/[[...path]]': '/series',
  'wingbits/[[...path]]': '/status',
  'tvl-geo': '',
};

/** Routes that legitimately answer to something other than GET, or are not data endpoints. */
const SKIP = new Set(['data/military-hex-db']);

/**
 * Routes that only accept POST. A GET correctly returns 405, so they are probed
 * with a HEAD-style expectation rather than being counted as broken.
 */
const POST_ONLY = new Set([
  'classify-batch',
  'classify-event',
  'country-intel',
  'groq-summarize',
  'openrouter-summarize',
  'wingbits/details/batch',
  'download',
]);

async function collectRoutes(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectRoutes(abs, out);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;
    if (entry.name.startsWith('_') || entry.name.includes('.test.')) continue;
    out.push(path.relative(API_DIR, abs).replace(/\\/g, '/').replace(/\.js$/, ''));
  }
  return out;
}

/** Turn a route file path into a callable URL path. */
function toUrlPath(route) {
  const extra = ROUTE_PARAMS[route];
  if (extra !== undefined && (extra.startsWith('/') || extra === '')) {
    // A dynamic route: strip the bracket segment and append the sample path.
    return `/api/${route.replace(/\/\[+\.*\.*\.*[^/]*\]+$/, '')}${extra}`;
  }
  return `/api/${route}${extra || ''}`;
}

/** Does this 200 body actually represent a working lane? */
function classifyBody(body, contentType) {
  if (typeof body !== 'object' || body === null) {
    return contentType.includes('json') ? { verdict: 'FAIL', note: 'non-object JSON body' } : { verdict: 'OK', note: 'non-JSON body' };
  }
  // Routes signal a missing optional credential explicitly, which is by design.
  if (body.configured === false || body.skipped === true) {
    return { verdict: 'UNCONFIGURED', note: String(body.reason || body.error || 'not configured') };
  }
  if (body.unavailable === true) {
    return { verdict: 'DEGRADED', note: 'upstream unavailable, route returned its fallback shape' };
  }
  if (body.error) {
    return { verdict: 'FAIL', note: String(body.error).slice(0, 120) };
  }
  const keys = Object.keys(body);
  if (!keys.length) return { verdict: 'FAIL', note: 'empty object' };
  if (Array.isArray(body) && body.length === 0) return { verdict: 'DEGRADED', note: 'empty array' };
  return { verdict: 'OK', note: keys.slice(0, 4).join(',') };
}

async function probe(route) {
  const urlPath = toUrlPath(route);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${urlPath}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json', Origin: BASE },
    });
    const ms = Date.now() - started;
    const contentType = res.headers.get('content-type') || '';
    const cache = res.headers.get('x-cache') || '';
    const text = await res.text();

    if (!res.ok) {
      // A POST-only route answering 405 to our GET is behaving correctly.
      if (res.status === 405 && POST_ONLY.has(route)) {
        return { route, urlPath, status: res.status, ms, cache, verdict: 'OK', note: 'POST-only, correctly rejects GET' };
      }
      return { route, urlPath, status: res.status, ms, cache, verdict: 'FAIL', note: text.slice(0, 120).replace(/\s+/g, ' ') };
    }
    let body = text;
    if (contentType.includes('json')) {
      try {
        body = JSON.parse(text);
      } catch {
        return { route, urlPath, status: res.status, ms, cache, verdict: 'FAIL', note: 'claimed JSON but did not parse' };
      }
    }
    const { verdict, note } = classifyBody(body, contentType);
    return { route, urlPath, status: res.status, ms, cache, verdict, note, bytes: text.length };
  } catch (err) {
    const ms = Date.now() - started;
    const aborted = err.name === 'AbortError';
    return { route, urlPath, status: 0, ms, cache: '', verdict: 'FAIL', note: aborted ? `timeout after ${TIMEOUT_MS}ms` : String(err.message).slice(0, 120) };
  }
}

/** Run probes with a bounded number in flight. */
async function runPool(items, worker, limit) {
  const results = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    })
  );
  return results;
}

const routes = (await collectRoutes(API_DIR)).filter((r) => !SKIP.has(r)).sort();
console.log(`[audit] ${routes.length} routes against ${BASE}\n`);

const results = await runPool(routes, probe, CONCURRENCY);

const order = { FAIL: 0, DEGRADED: 1, UNCONFIGURED: 2, OK: 3 };
for (const r of [...results].sort((a, b) => order[a.verdict] - order[b.verdict] || a.route.localeCompare(b.route))) {
  const tag = r.verdict.padEnd(12);
  const status = String(r.status).padEnd(4);
  console.log(`${tag} ${status} ${String(r.ms).padStart(6)}ms  ${r.route.padEnd(30)} ${r.note || ''}`);
}

const counts = results.reduce((acc, r) => ({ ...acc, [r.verdict]: (acc[r.verdict] || 0) + 1 }), {});
console.log(`\n[audit] OK=${counts.OK || 0} DEGRADED=${counts.DEGRADED || 0} UNCONFIGURED=${counts.UNCONFIGURED || 0} FAIL=${counts.FAIL || 0}`);

if (JSON_OUT) {
  await writeFile(JSON_OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
  console.log(`[audit] wrote ${JSON_OUT}`);
}

if (counts.FAIL) process.exit(1);
