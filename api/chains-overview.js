export const config = { runtime: 'edge' };

import { getCachedJson, setCachedJson } from './_upstash-cache.js';
import { recordCacheTelemetry } from './_cache-telemetry.js';
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { createIpRateLimiter } from './_ip-rate-limit.js';
import { UA_BOT } from './_ua.js';

const limiter = createIpRateLimiter({ limit: 30, windowMs: 60_000 });
const CACHE_KEY = 'chains-overview:v1';
const CACHE_TTL = 300; // 5 min: TVL and daily volume move slowly.

/** In-memory stale fallback for when Redis and upstream both fail. */
let staleResponse = null;

const LLAMA_CHAINS = 'https://api.llama.fi/v2/chains';
// excludeTotalDataChartBreakdown drops an 18MB time series we do not use, while
// still returning protocols[].breakdown24h, which is where per-chain volume lives.
const LLAMA_DEXS =
  'https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true';

/** How many chains the panel shows. */
const TOP_N = 25;

/**
 * DeFiLlama reports volume under internal chain slugs and TVL under display
 * names. Most pairs normalize to the same string; these are the ones that do not.
 */
const SLUG_ALIASES = {
  robinhood: 'robinhoodchain',
  avax: 'avalanche',
  xdai: 'gnosis',
  hyperliquid: 'hyperliquidl1',
  op_bnb: 'opbnb',
  zksync: 'zksyncera',
  polygon_zkevm: 'polygonzkevm',
  arbitrum_nova: 'arbitrumnova',
};

/**
 * Venues that report DEX volume but are not chains with their own TVL: order
 * books, perp venues and CEX aggregates. They are excluded so the overview stays
 * an overview of chains.
 */
const NON_CHAIN_VENUES = new Set(['off_chain', 'edgex', 'zklighter', 'alphasec', 'native_core']);

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function canonicalSlug(slug) {
  const normalized = normalize(slug);
  return SLUG_ALIASES[slug] || SLUG_ALIASES[normalized] || normalized;
}

async function fetchJson(url, signal) {
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json', 'User-Agent': UA_BOT },
  });
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
  return res.json();
}

/** Sum every protocol's 24h volume per chain slug. */
export function volumeByChain(dexs) {
  const totals = new Map();
  for (const protocol of dexs.protocols || []) {
    const breakdown = protocol.breakdown24h;
    if (!breakdown) continue;
    for (const [slug, versions] of Object.entries(breakdown)) {
      if (NON_CHAIN_VENUES.has(slug)) continue;
      let amount = 0;
      if (typeof versions === 'number') amount = versions;
      else if (versions && typeof versions === 'object') {
        for (const value of Object.values(versions)) {
          if (typeof value === 'number') amount += value;
        }
      }
      if (!amount) continue;
      const key = canonicalSlug(slug);
      totals.set(key, (totals.get(key) || 0) + amount);
    }
  }
  return totals;
}

/** Title-case a bare slug for display when it matched no known chain name. */
export function prettifySlug(slug) {
  return String(slug)
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

async function buildSnapshot(signal) {
  const [chains, dexs] = await Promise.all([
    fetchJson(LLAMA_CHAINS, signal),
    fetchJson(LLAMA_DEXS, signal),
  ]);

  const volumes = volumeByChain(dexs);
  const tvlBySlug = new Map();
  for (const chain of chains) {
    if (typeof chain.tvl === 'number' && chain.tvl > 0) {
      tvlBySlug.set(normalize(chain.name), chain);
    }
  }

  // Union of "has TVL" and "has volume", so a high-throughput chain with little
  // parked capital is not silently dropped.
  const slugs = new Set([...tvlBySlug.keys(), ...volumes.keys()]);

  const rows = [];
  for (const slug of slugs) {
    const chain = tvlBySlug.get(slug);
    const tvl = chain ? chain.tvl : null;
    const volume24h = volumes.get(slug) || 0;
    if (!tvl && !volume24h) continue;

    // Turnover is the point of this panel: volume relative to capital parked on
    // the chain. A high ratio means the chain is actually being traded on rather
    // than used as storage.
    const turnover = tvl && volume24h ? round(volume24h / tvl, 4) : null;

    rows.push({
      name: chain ? chain.name : prettifySlug(slug),
      slug,
      chainId: chain ? chain.chainId ?? null : null,
      tokenSymbol: chain ? chain.tokenSymbol ?? null : null,
      tvl: tvl ? round(tvl, 2) : null,
      volume24h: round(volume24h, 2),
      turnover,
    });
  }

  rows.sort((a, b) => b.volume24h - a.volume24h || (b.tvl || 0) - (a.tvl || 0));
  const top = rows.slice(0, TOP_N);

  const totalVolume = rows.reduce((sum, r) => sum + r.volume24h, 0);
  const totalTvl = rows.reduce((sum, r) => sum + (r.tvl || 0), 0);

  return {
    timestamp: new Date().toISOString(),
    totals: {
      chainCount: rows.length,
      volume24h: round(totalVolume, 2),
      tvl: round(totalTvl, 2),
      turnover: totalTvl ? round(totalVolume / totalTvl, 4) : null,
    },
    chains: top,
  };
}

export default async function handler(req) {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    if (isDisallowedOrigin(req)) return new Response(null, { status: 403, headers: cors });
    return new Response(null, { status: 204, headers: cors });
  }
  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json', Allow: 'GET, OPTIONS' },
    });
  }
  const clientIp = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  if (!limiter.check(clientIp)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  const cached = await getCachedJson(CACHE_KEY);
  if (cached) {
    recordCacheTelemetry('/api/chains-overview', 'HIT');
    return new Response(JSON.stringify(cached), {
      headers: {
        'Content-Type': 'application/json',
        ...cors,
        'X-Cache': 'HIT',
        'Cache-Control': `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}, stale-while-revalidate=120`,
      },
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const snapshot = await buildSnapshot(controller.signal);
    clearTimeout(timeout);

    staleResponse = snapshot;
    void setCachedJson(CACHE_KEY, snapshot, CACHE_TTL);
    recordCacheTelemetry('/api/chains-overview', 'MISS');

    return new Response(JSON.stringify(snapshot), {
      headers: {
        'Content-Type': 'application/json',
        ...cors,
        'X-Cache': 'MISS',
        'Cache-Control': `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}, stale-while-revalidate=120`,
      },
    });
  } catch (err) {
    if (staleResponse) {
      recordCacheTelemetry('/api/chains-overview', 'STALE');
      return new Response(JSON.stringify(staleResponse), {
        headers: {
          'Content-Type': 'application/json',
          ...cors,
          'X-Cache': 'STALE',
          'Cache-Control': 'public, max-age=120',
        },
      });
    }
    recordCacheTelemetry('/api/chains-overview', 'ERROR');
    return new Response(
      JSON.stringify({ error: 'Failed to build chains overview', detail: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
