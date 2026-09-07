# Robinhood Chain

Chainscope reads [Robinhood Chain](https://robinhoodchain.blockscout.com) (chain ID **4663**) directly over JSON-RPC. No API key, no indexer, no third-party aggregator sits in the path: the panel shows what the chain itself reports.

This is the first chain wired up under Chainscope's onchain-trading direction, and `api/robinhood-chain.js` is the reference implementation for adding another.

## What the panel shows

| Field | Source |
| --- | --- |
| Block height | `eth_getBlockByNumber("latest")` |
| Block time | timestamp delta across a 500-block window, divided by the span |
| Gas (gwei) | `eth_gasPrice` |
| Base fee | `baseFeePerGas` on the head block |
| TPS (head) | head-block transaction count divided by average block time |
| USDG supply | `totalSupply()` on the USDG token, scaled by its 6 decimals |
| Uniswap v2 pairs | `allPairsLength()` on the v2 factory |
| Head block txs | transaction count of the head block |

"TPS (head)" is an instantaneous rate taken from the newest block, not a rolling average, so it moves around a lot between refreshes. Treat it as a liveness signal rather than a throughput benchmark.

## Endpoint

```
GET /api/robinhood-chain
```

Cached for 20 seconds. Responds with `X-Cache: HIT | MISS | STALE`.

```bash
curl -s http://localhost:3000/api/robinhood-chain | jq
```

```json
{
  "timestamp": "2026-09-07T22:36:35.661Z",
  "chain": {
    "id": 4663,
    "name": "Robinhood Chain",
    "explorer": "https://robinhoodchain.blockscout.com",
    "rpc": "https://rpc.mainnet.chain.robinhood.com",
    "rpcFailures": []
  },
  "head": {
    "number": 57195764,
    "timestamp": "2026-09-07T22:36:34.000Z",
    "txCount": 10,
    "gasUsed": 2728967
  },
  "gas": { "gasPriceGwei": 0.2955, "baseFeeGwei": 0.3008 },
  "performance": { "blockTimeSec": 0.1, "tps": 100 },
  "dex": {
    "uniswapV2Pairs": 41202,
    "uniswapV2Factory": "0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f",
    "uniswapV3Factory": "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
    "universalRouter": "0x8876789976DEcbFCBbbE364623c63652DB8C0904"
  },
  "stablecoin": {
    "symbol": "USDG",
    "address": "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    "supply": 672456374.93
  }
}
```

`chain.rpc` names the endpoint that actually answered, and `chain.rpcFailures` lists the ones that did not. When failover happens the panel footer shows `failover +N`, so a degraded upstream is visible rather than silent.

## RPC failover

Three keyless public endpoints are tried in order:

1. `https://rpc.mainnet.chain.robinhood.com` (official)
2. `https://robinhood-rpc.publicnode.com`
3. `https://robinhood.drpc.org`

drpc is last on purpose: its free tier rejects some methods, including `eth_blockNumber`, so it can answer a handshake and still fail a real batch. The route sends one JSON-RPC **batch** per snapshot and only accepts an endpoint that satisfies the whole batch, which keeps a partially-working endpoint from producing a half-filled panel.

The route also asserts `eth_chainId` equals 4663 before trusting a response, so a misconfigured or redirected endpoint fails loudly instead of rendering another chain's numbers under this panel's title.

## Verified mainnet contracts

These are read from chain 4663 and all hold code:

| Contract | Address |
| --- | --- |
| USDG (6 decimals) | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| Uniswap v2 factory | `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f` |
| Uniswap v3 factory | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` |
| Uniswap v4 PoolManager | `0x8366A39cC670b4001a1121b8F6A443A643E40951` |
| UniversalRouter | `0x8876789976DEcbFCBbbE364623c63652DB8C0904` |

## Notes for anyone extending this

- **The block explorer is not a usable data source from a server.** `robinhoodchain.blockscout.com` sits behind a Cloudflare challenge that rejects datacenter egress IPs, so its REST API returns an interstitial HTML page rather than JSON when called from a deployed backend. It is linked from the panel for humans and never fetched. Everything the panel renders comes from JSON-RPC.
- **`gasLimit` on this chain is effectively unbounded** (2^50), so a "gas utilization %" derived from `gasUsed / gasLimit` is meaningless. The panel deliberately reports raw `gasUsed` instead.
- **UniversalRouter here is a modified build.** Its `V2_SWAP_EXACT_IN` / `V3_SWAP_EXACT_IN` inputs take an extra trailing `uint256[]` argument. Standard encodings revert with `SliceOutOfBounds()` (`0x3b99b53d`). This does not affect the read-only panel, but it matters for anything that goes on to build swap calldata.

## Related

- `api/robinhood-chain.js` — the route
- `src/components/RobinhoodChainPanel.ts` — the panel
- [README](../README.md#adding-a-panel) — how to add another chain
