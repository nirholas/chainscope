export const config = { runtime: 'edge' };

import { getCachedJson, setCachedJson } from './_upstash-cache.js';
import { recordCacheTelemetry } from './_cache-telemetry.js';
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { createIpRateLimiter } from './_ip-rate-limit.js';

const limiter = createIpRateLimiter({ limit: 30, windowMs: 60_000 });
const CACHE_KEY = 'robinhood-chain:v1';
const CACHE_TTL = 20; // Robinhood Chain produces sub-second blocks; 20s keeps the head fresh.

/** In-memory stale fallback, so a warm instance survives Redis + every RPC failing. */
let staleResponse = null;

const CHAIN_ID = 4663;
const EXPLORER = 'https://robinhoodchain.blockscout.com';

/**
 * Keyless public RPCs, tried in order. The official endpoint leads; the others
 * are real failover rungs, verified to answer eth_call and eth_getBlockByNumber.
 * drpc.org is last because its free tier rejects some methods.
 */
const RPC_ENDPOINTS = [
  'https://rpc.mainnet.chain.robinhood.com',
  'https://robinhood-rpc.publicnode.com',
  'https://robinhood.drpc.org',
];

/** Verified mainnet (4663) contracts. */
const CONTRACTS = {
  usdg: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  uniswapV2Factory: '0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f',
  uniswapV3Factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
  universalRouter: '0x8876789976DEcbFCBbbE364623c63652DB8C0904',
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
};

/** Function selectors used below. */
const SELECTOR = {
  totalSupply: '0x18160ddd',
  allPairsLength: '0x574f2ba3',
};

/** How far back to sample when measuring average block time. */
const BLOCK_TIME_SAMPLE = 500;

/** Send a JSON-RPC batch to one endpoint and return the responses by id. */
async function rpcBatch(endpoint, calls, signal) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: '2.0', id: i + 1, ...c }))),
    signal,
  });
  if (!res.ok) throw new Error(`RPC ${res.status} from ${endpoint}`);
  const body = await res.json();
  if (!Array.isArray(body)) throw new Error(`Non-batch reply from ${endpoint}`);
  const byId = new Map(body.map((r) => [r.id, r]));
  return calls.map((_, i) => {
    const entry = byId.get(i + 1);
    if (!entry) throw new Error(`Missing id ${i + 1} from ${endpoint}`);
    if (entry.error) throw new Error(`RPC error ${entry.error.code}: ${entry.error.message}`);
    return entry.result;
  });
}

/** Try each endpoint in order; the first that answers the whole batch wins. */
async function rpcBatchWithFailover(calls, signal) {
  const failures = [];
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const results = await rpcBatch(endpoint, calls, signal);
      return { results, endpoint, failures };
    } catch (err) {
      failures.push(`${endpoint}: ${err.message}`);
    }
  }
  throw new Error(`All Robinhood Chain RPCs failed. ${failures.join(' | ')}`);
}

const hexToInt = (hex) => (hex ? Number.parseInt(hex, 16) : 0);
/** Parse a uint256 hex word as a decimal number scaled by `decimals`. */
const hexToUnits = (hex, decimals) =>
  hex ? Number(BigInt(hex)) / 10 ** decimals : 0;

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

async function buildSnapshot(signal) {
  // One round trip for everything that does not depend on the head block number.
  const { results, endpoint, failures } = await rpcBatchWithFailover(
    [
      { method: 'eth_chainId', params: [] },
      { method: 'eth_gasPrice', params: [] },
      { method: 'eth_getBlockByNumber', params: ['latest', false] },
      { method: 'eth_call', params: [{ to: CONTRACTS.usdg, data: SELECTOR.totalSupply }, 'latest'] },
      {
        method: 'eth_call',
        params: [{ to: CONTRACTS.uniswapV2Factory, data: SELECTOR.allPairsLength }, 'latest'],
      },
    ],
    signal
  );

  const [chainIdHex, gasPriceHex, head, usdgSupplyHex, pairsHex] = results;

  const reportedChainId = hexToInt(chainIdHex);
  if (reportedChainId !== CHAIN_ID) {
    throw new Error(`Endpoint ${endpoint} reports chain ${reportedChainId}, expected ${CHAIN_ID}`);
  }

  const headNumber = hexToInt(head.number);
  const headTimestamp = hexToInt(head.timestamp);

  // Average block time over a recent window, which also gives a throughput figure.
  // A failure here degrades those two fields rather than the whole snapshot.
  let blockTimeSec = null;
  let tps = null;
  try {
    const olderNumber = Math.max(headNumber - BLOCK_TIME_SAMPLE, 0);
    const span = headNumber - olderNumber;
    if (span > 0) {
      const [older] = await rpcBatch(
        endpoint,
        [{ method: 'eth_getBlockByNumber', params: [`0x${olderNumber.toString(16)}`, false] }],
        signal
      );
      const elapsed = headTimestamp - hexToInt(older.timestamp);
      if (elapsed > 0) {
        blockTimeSec = round(elapsed / span, 3);
        tps = round(head.transactions.length / blockTimeSec, 2);
      }
    }
  } catch {
    // Leave blockTimeSec / tps null; the panel renders them as unavailable.
  }

  const gasPriceWei = hexToInt(gasPriceHex);
  const baseFeeWei = hexToInt(head.baseFeePerGas);

  return {
    timestamp: new Date().toISOString(),
    chain: {
      id: CHAIN_ID,
      name: 'Robinhood Chain',
      explorer: EXPLORER,
      rpc: endpoint,
      rpcFailures: failures,
    },
    head: {
      number: headNumber,
      timestamp: new Date(headTimestamp * 1000).toISOString(),
      txCount: head.transactions.length,
      gasUsed: hexToInt(head.gasUsed),
    },
    gas: {
      gasPriceGwei: round(gasPriceWei / 1e9, 4),
      baseFeeGwei: round(baseFeeWei / 1e9, 4),
    },
    performance: { blockTimeSec, tps },
    dex: {
      uniswapV2Pairs: hexToInt(pairsHex),
      uniswapV2Factory: CONTRACTS.uniswapV2Factory,
      uniswapV3Factory: CONTRACTS.uniswapV3Factory,
      universalRouter: CONTRACTS.universalRouter,
    },
    stablecoin: {
      symbol: 'USDG',
      address: CONTRACTS.usdg,
      // USDG is a 6-decimal token, confirmed on chain via decimals().
      supply: round(hexToUnits(usdgSupplyHex, 6), 2),
    },
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
    recordCacheTelemetry('/api/robinhood-chain', 'HIT');
    return new Response(JSON.stringify(cached), {
      headers: {
        'Content-Type': 'application/json',
        ...cors,
        'X-Cache': 'HIT',
        'Cache-Control': `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}, stale-while-revalidate=30`,
      },
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const snapshot = await buildSnapshot(controller.signal);
    clearTimeout(timeout);

    staleResponse = snapshot;
    void setCachedJson(CACHE_KEY, snapshot, CACHE_TTL);
    recordCacheTelemetry('/api/robinhood-chain', 'MISS');

    return new Response(JSON.stringify(snapshot), {
      headers: {
        'Content-Type': 'application/json',
        ...cors,
        'X-Cache': 'MISS',
        'Cache-Control': `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}, stale-while-revalidate=30`,
      },
    });
  } catch (err) {
    if (staleResponse) {
      recordCacheTelemetry('/api/robinhood-chain', 'STALE');
      return new Response(JSON.stringify(staleResponse), {
        headers: {
          'Content-Type': 'application/json',
          ...cors,
          'X-Cache': 'STALE',
          'Cache-Control': 'public, max-age=30',
        },
      });
    }
    recordCacheTelemetry('/api/robinhood-chain', 'ERROR');
    return new Response(
      JSON.stringify({ error: 'Failed to reach Robinhood Chain', detail: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
