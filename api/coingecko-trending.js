export const config = { runtime: 'edge' };

import { getCachedJson, setCachedJson } from './_upstash-cache.js';
import { recordCacheTelemetry } from './_cache-telemetry.js';
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

const CACHE_KEY = 'cg-trending:v1';
const CACHE_TTL = 300; // 5 min

/** In-memory stale fallback (survives warm-start when Redis + upstream both fail) */
let staleResponse = null;

/**
 * CoinGecko's public API refuses requests from some datacenter ranges, and
 * Cloudflare's edge is one of them: the primary lane 403s in production while
 * working fine from a laptop. GeckoTerminal is the keyless DEX-native failover.
 *
 * Its pools are normalized into CoinGecko's trending shape so the panel needs no
 * change. market_cap_rank has no equivalent there, so it stays null and renders
 * as "unranked" rather than being invented.
 */
async function fetchGeckoTerminalTrending(signal) {
  const res = await fetch(
    'https://api.geckoterminal.com/api/v2/networks/trending_pools?include=base_token&page=1',
    { signal, headers: { Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
  const body = await res.json();

  const tokens = new Map(
    (body.included || [])
      .filter((entry) => entry.type === 'token')
      .map((entry) => [entry.id, entry.attributes || {}])
  );

  const coins = [];
  const seen = new Set();
  for (const pool of body.data || []) {
    const baseId = pool?.relationships?.base_token?.data?.id;
    const token = baseId ? tokens.get(baseId) : null;
    if (!token || !token.symbol || seen.has(token.symbol)) continue;
    seen.add(token.symbol);
    coins.push({
      item: {
        id: token.coingecko_coin_id || baseId,
        coin_id: 0,
        name: token.name || token.symbol,
        symbol: token.symbol,
        market_cap_rank: null,
        thumb: token.image_url || '',
        small: token.image_url || '',
        large: token.image_url || '',
        slug: token.coingecko_coin_id || '',
        price_btc: 0,
        score: coins.length,
      },
    });
  }
  if (!coins.length) throw new Error('GeckoTerminal returned no usable tokens');
  return { coins, source: 'geckoterminal' };
}

export default async function handler(req) {
  const cors = getCorsHeaders(req);
  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: cors });
  }

  const cached = await getCachedJson(CACHE_KEY);
  if (cached) {
    recordCacheTelemetry('/api/coingecko-trending', 'HIT');
    return new Response(JSON.stringify(cached), {
      headers: { 'Content-Type': 'application/json', ...cors, 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=120' },
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch('https://api.coingecko.com/api/v3/search/trending', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    // A blocked or throttled primary is expected in production, so fail over
    // rather than surfacing the upstream status to the panel.
    const data = res.ok
      ? await res.json()
      : await fetchGeckoTerminalTrending(controller.signal);
    staleResponse = data;
    void setCachedJson(CACHE_KEY, data, CACHE_TTL);
    recordCacheTelemetry('/api/coingecko-trending', 'MISS');

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', ...cors, 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=120' },
    });
  } catch (err) {
    if (staleResponse) {
      recordCacheTelemetry('/api/coingecko-trending', 'STALE');
      return new Response(JSON.stringify(staleResponse), {
        headers: { 'Content-Type': 'application/json', ...cors, 'X-Cache': 'STALE', 'Cache-Control': 'public, max-age=60' },
      });
    }
    // Last resort: try the failover lane on its own before giving up.
    try {
      const fallback = await fetchGeckoTerminalTrending(undefined);
      staleResponse = fallback;
      recordCacheTelemetry('/api/coingecko-trending', 'FALLBACK');
      return new Response(JSON.stringify(fallback), {
        headers: { 'Content-Type': 'application/json', ...cors, 'X-Cache': 'MISS', 'X-Data-Source': 'geckoterminal', 'Cache-Control': 'public, max-age=300' },
      });
    } catch { /* fall through to the error below */ }

    recordCacheTelemetry('/api/coingecko-trending', 'ERROR');
    return new Response(JSON.stringify({ error: 'Failed to fetch trending data' }), {
      status: 502, headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
