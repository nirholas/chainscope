import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { volumeByChain, canonicalSlug, prettifySlug } from '../api/chains-overview.js';

/** Build the /overview/dexs shape the handler passes to volumeByChain. */
function dexs(protocols) {
  return { protocols: protocols.map((breakdown24h) => ({ breakdown24h })) };
}

describe('chains-overview canonicalSlug', () => {
  it('maps DeFiLlama volume slugs onto their TVL display names', () => {
    assert.equal(canonicalSlug('robinhood'), 'robinhoodchain');
    assert.equal(canonicalSlug('avax'), 'avalanche');
    assert.equal(canonicalSlug('xdai'), 'gnosis');
    assert.equal(canonicalSlug('hyperliquid'), 'hyperliquidl1');
  });

  it('normalizes an unaliased slug to lowercase alphanumerics', () => {
    assert.equal(canonicalSlug('Ethereum'), 'ethereum');
    assert.equal(canonicalSlug('OP Mainnet'), 'opmainnet');
    assert.equal(canonicalSlug('polygon-zkevm'), 'polygonzkevm');
  });
});

describe('chains-overview volumeByChain', () => {
  it('sums every protocol version into one figure per chain', () => {
    const totals = volumeByChain(
      dexs([
        { ethereum: { 'Uniswap V3': 100, 'Uniswap V4': 50 } },
        { ethereum: { 'Curve DEX': 25 }, base: { 'Curve DEX': 10 } },
      ])
    );
    assert.equal(totals.get('ethereum'), 175);
    assert.equal(totals.get('base'), 10);
  });

  it('folds aliased slugs into the same chain', () => {
    const totals = volumeByChain(
      dexs([{ robinhood: { 'Uniswap V2': 40 } }, { robinhood: { 'Uniswap V3': 60 } }])
    );
    assert.equal(totals.get('robinhoodchain'), 100);
    assert.equal(totals.has('robinhood'), false);
  });

  it('accepts a bare number as well as a per-version object', () => {
    const totals = volumeByChain(dexs([{ solana: 500 }, { solana: { Raydium: 250 } }]));
    assert.equal(totals.get('solana'), 750);
  });

  it('excludes venues that report volume but are not chains', () => {
    const totals = volumeByChain(
      dexs([{ off_chain: { Kalshi: 999 }, edgex: { edgeX: 5 }, zklighter: { Lighter: 5 }, ethereum: { 'Uniswap V3': 1 } }])
    );
    assert.equal(totals.has('off_chain'), false);
    assert.equal(totals.has('edgex'), false);
    assert.equal(totals.has('zklighter'), false);
    assert.equal(totals.get('ethereum'), 1);
  });

  it('ignores protocols with no breakdown and non-numeric entries', () => {
    const totals = volumeByChain({
      protocols: [{}, { breakdown24h: null }, { breakdown24h: { base: { A: 'n/a', B: 7 } } }],
    });
    assert.equal(totals.get('base'), 7);
  });

  it('drops a chain whose versions sum to zero rather than listing it at 0', () => {
    const totals = volumeByChain(dexs([{ someChain: { OnlyVersion: 0 } }]));
    assert.equal(totals.has('somechain'), false);
  });
});

describe('chains-overview prettifySlug', () => {
  it('title-cases a slug that matched no known chain', () => {
    assert.equal(prettifySlug('spark'), 'Spark');
    assert.equal(prettifySlug('native_core'), 'Native Core');
    assert.equal(prettifySlug('arbitrum-nova'), 'Arbitrum Nova');
  });
});
