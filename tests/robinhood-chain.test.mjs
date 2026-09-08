import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mapBatchResults, hexToInt, hexToUnits } from '../api/robinhood-chain.js';

const CALLS = [
  { method: 'eth_chainId', params: [] },
  { method: 'eth_gasPrice', params: [] },
  { method: 'eth_blockNumber', params: [] },
];

describe('robinhood-chain mapBatchResults', () => {
  it('returns results in call order when the reply is already ordered', () => {
    const body = [
      { id: 1, result: '0x1237' },
      { id: 2, result: '0x11aac420' },
      { id: 3, result: '0x367e3d6' },
    ];
    assert.deepEqual(mapBatchResults(CALLS, body), ['0x1237', '0x11aac420', '0x367e3d6']);
  });

  it('matches by id, not position, when the server reorders the batch', () => {
    // JSON-RPC explicitly permits any ordering. Reading positionally here would
    // report the gas price as the chain id.
    const body = [
      { id: 3, result: '0x367e3d6' },
      { id: 1, result: '0x1237' },
      { id: 2, result: '0x11aac420' },
    ];
    assert.deepEqual(mapBatchResults(CALLS, body), ['0x1237', '0x11aac420', '0x367e3d6']);
  });

  it('throws when the batch is missing a response', () => {
    const body = [
      { id: 1, result: '0x1237' },
      { id: 3, result: '0x367e3d6' },
    ];
    assert.throws(() => mapBatchResults(CALLS, body, 'test-rpc'), /Missing id 2 from test-rpc/);
  });

  it('throws when any single call returned an error', () => {
    const body = [
      { id: 1, result: '0x1237' },
      { id: 2, result: '0x11aac420' },
      { id: 3, error: { code: -32601, message: 'the method eth_blockNumber does not exist' } },
    ];
    assert.throws(() => mapBatchResults(CALLS, body), /RPC error -32601/);
  });

  it('rejects a non-array reply, which is how a rate-limit page arrives', () => {
    assert.throws(() => mapBatchResults(CALLS, { error: 'rate limited' }, 'test-rpc'), /Non-batch reply/);
  });
});

describe('robinhood-chain hex helpers', () => {
  it('parses hex quantities', () => {
    assert.equal(hexToInt('0x1237'), 4663);
    assert.equal(hexToInt('0xa0f2'), 41202);
  });

  it('treats an absent quantity as zero rather than NaN', () => {
    assert.equal(hexToInt(undefined), 0);
    assert.equal(hexToInt(null), 0);
  });

  it('scales a uint256 word by the token decimals', () => {
    // USDG carries 6 decimals; this is a real totalSupply() word.
    const word = '0x00000000000000000000000000000000000000000000000000026398735accac';
    assert.equal(Math.round(hexToUnits(word, 6) * 100) / 100, 672456374.93);
  });

  it('scales an 18-decimal word without losing the integer part', () => {
    const oneToken = '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000';
    assert.equal(hexToUnits(oneToken, 18), 1);
  });
});
