export const config = { runtime: 'edge' };

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { createIpRateLimiter } from './_ip-rate-limit.js';
import { UA_BOT } from './_ua.js';

const limiter = createIpRateLimiter({ limit: 30, windowMs: 60_000 });
const CACHE_TTL = 120; // 2 min: relay payloads land every slot.

/** In-memory stale fallback, so a warm instance survives an upstream outage. */
let staleResponse = null;

/**
 * MEV-Boost relay payload traces.
 *
 * The previous source, blocks.flashbots.net, was decommissioned and now answers
 * HTTP 410; the libmev secondary is unreachable as well. The relay data API is
 * the keyless replacement, and it reports what a relay actually delivered:
 * the payment to the proposer, the builder, and the block's gas and tx count.
 *
 * Every relay only wins a fraction of blocks, so these figures describe THIS
 * relay's delivered payloads, not network-wide MEV. The response says so rather
 * than implying full coverage.
 */
const RELAYS = [
  { name: 'Flashbots', url: 'https://boost-relay.flashbots.net' },
  { name: 'bloXroute Max Profit', url: 'https://bloxroute.max-profit.blxrbdn.com' },
  { name: 'Agnostic', url: 'https://agnostic-relay.net' },
];

const PAYLOAD_PATH = '/relay/v1/data/bidtraces/proposer_payload_delivered?limit=200';

/** Beacon chain genesis (mainnet) and slot length, used to date a slot. */
const GENESIS_UNIX = 1606824023;
const SECONDS_PER_SLOT = 12;

/**
 * Builders are identified only by pubkey here. There is no keyless registry
 * mapping those to the names people know ("beaverbuild", "Titan"), and guessing
 * would put unverified attribution on screen, so the pubkey is shown truncated.
 */
function builderLabel(pubkey) {
  if (!pubkey) return 'unknown';
  return `${pubkey.slice(0, 10)}...${pubkey.slice(-4)}`;
}

const slotToIso = (slot) =>
  new Date((GENESIS_UNIX + Number(slot) * SECONDS_PER_SLOT) * 1000).toISOString();

const round = (value, places) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/** Live ETH price, with a failover. Never a hardcoded constant. */
async function fetchEthPrice(signal) {
  const lanes = [
    {
      url: 'https://coins.llama.fi/prices/current/coingecko:ethereum',
      read: (d) => d?.coins?.['coingecko:ethereum']?.price,
    },
    {
      url: 'https://api.coinpaprika.com/v1/tickers/eth-ethereum',
      read: (d) => d?.quotes?.USD?.price,
    },
  ];
  for (const lane of lanes) {
    try {
      const res = await fetch(lane.url, {
        signal,
        headers: { Accept: 'application/json', 'User-Agent': UA_BOT },
      });
      if (!res.ok) continue;
      const price = lane.read(await res.json());
      if (Number.isFinite(price) && price > 0) return price;
    } catch {
      // Try the next lane.
    }
  }
  return null;
}

/** Delivered payloads from the first relay that answers. */
async function fetchDeliveredPayloads(signal) {
  const failures = [];
  for (const relay of RELAYS) {
    try {
      const res = await fetch(`${relay.url}${PAYLOAD_PATH}`, {
        signal,
        headers: { Accept: 'application/json', 'User-Agent': UA_BOT },
      });
      if (!res.ok) {
        failures.push(`${relay.name}: HTTP ${res.status}`);
        continue;
      }
      const payloads = await res.json();
      if (Array.isArray(payloads) && payloads.length) {
        return { relay: relay.name, payloads, failures };
      }
      failures.push(`${relay.name}: empty payload list`);
    } catch (err) {
      failures.push(`${relay.name}: ${err.message}`);
    }
  }
  throw new Error(`No MEV-Boost relay answered. ${failures.join(' | ')}`);
}

function buildSnapshot({ relay, payloads, failures }, ethPrice) {
  // Newest first, which is how the relay already orders them.
  const sorted = [...payloads].sort((a, b) => Number(b.slot) - Number(a.slot));

  const blocks = sorted.slice(0, 20).map((p) => {
    const valueEth = Number(BigInt(p.value)) / 1e18;
    return {
      blockNumber: Number(p.block_number),
      slot: Number(p.slot),
      proposerPaymentEth: round(valueEth, 6),
      proposerPaymentUSD: ethPrice ? round(valueEth * ethPrice, 2) : null,
      gasUsed: Number(p.gas_used),
      gasLimit: Number(p.gas_limit),
      txCount: Number(p.num_tx),
      builderName: builderLabel(p.builder_pubkey),
      builderPubkey: p.builder_pubkey,
      timestamp: slotToIso(p.slot),
    };
  });

  const builderCounts = new Map();
  for (const p of sorted) {
    const name = builderLabel(p.builder_pubkey);
    builderCounts.set(name, (builderCounts.get(name) || 0) + 1);
  }
  const builderShare = [...builderCounts.entries()]
    .map(([name, blockCount]) => ({
      name,
      blockCount,
      share: round((blockCount / sorted.length) * 100, 1),
    }))
    .sort((a, b) => b.blockCount - a.blockCount)
    .slice(0, 10);

  const totalEth = sorted.reduce((sum, p) => sum + Number(BigInt(p.value)) / 1e18, 0);
  const avgEth = totalEth / sorted.length;

  // The sampled window, measured from the slots actually returned.
  const newestSlot = Number(sorted[0].slot);
  const oldestSlot = Number(sorted[sorted.length - 1].slot);
  const windowSeconds = (newestSlot - oldestSlot) * SECONDS_PER_SLOT;

  return {
    timestamp: new Date().toISOString(),
    source: {
      relay,
      note: 'Payloads delivered by this relay only. Every relay wins a fraction of blocks, so these are not network-wide MEV totals.',
      relayFailures: failures,
      ethPriceUSD: ethPrice ? round(ethPrice, 2) : null,
      ethPriceUnavailable: ethPrice === null,
    },
    window: {
      payloadCount: sorted.length,
      newestSlot,
      oldestSlot,
      seconds: windowSeconds,
      newestBlockAt: slotToIso(newestSlot),
    },
    blocks,
    builderShare,
    stats: {
      totalProposerPaymentEth: round(totalEth, 6),
      totalProposerPaymentUSD: ethPrice ? round(totalEth * ethPrice, 2) : null,
      avgProposerPaymentEth: round(avgEth, 6),
      avgProposerPaymentUSD: ethPrice ? round(avgEth * ethPrice, 2) : null,
      topBuilder: builderShare[0]?.name || 'unknown',
      builderDominance: builderShare[0]?.share ?? 0,
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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const [delivered, ethPrice] = await Promise.all([
      fetchDeliveredPayloads(controller.signal),
      fetchEthPrice(controller.signal),
    ]);
    clearTimeout(timeout);

    const snapshot = buildSnapshot(delivered, ethPrice);
    staleResponse = snapshot;

    return new Response(JSON.stringify(snapshot), {
      headers: {
        'Content-Type': 'application/json',
        ...cors,
        'X-Cache': 'MISS',
        'Cache-Control': `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}, stale-while-revalidate=60`,
      },
    });
  } catch (err) {
    if (staleResponse) {
      return new Response(JSON.stringify(staleResponse), {
        headers: { 'Content-Type': 'application/json', ...cors, 'X-Cache': 'STALE', 'Cache-Control': 'public, max-age=60' },
      });
    }
    return new Response(
      JSON.stringify({ error: 'Failed to reach any MEV-Boost relay', detail: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}
