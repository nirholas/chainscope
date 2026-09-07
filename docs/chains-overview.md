# Chains Overview

A ranked view of where onchain trading is actually happening: 24h DEX volume, TVL, and the ratio between them, across every chain DeFiLlama indexes.

## Why turnover

TVL alone ranks chains by parked capital, which is a poor guide to where trading happens. Ethereum holds far more capital than any other chain and trades a small fraction of it each day. This panel's third column is **turnover**:

```
turnover = 24h DEX volume / TVL
```

It answers "how hard is this chain's capital working". A chain at `2.00x` turns over twice its TVL in a day; a chain at `0.02x` is mostly storage. Sorting by volume and reading turnover alongside separates venues that trade from venues that custody.

Observed at the time of writing: Robinhood Chain runs the highest turnover of any major chain (~2.0x) on ~$0.9B TVL, while Ethereum sits near 0.02x on ~$50B. That gap is the panel's entire reason to exist.

Colour bands: green `>= 1.0x`, amber `>= 0.25x`, dim below that.

## Endpoint

```
GET /api/chains-overview
```

Cached for 5 minutes. Responds with `X-Cache: HIT | MISS | STALE`.

```json
{
  "timestamp": "2026-09-07T23:00:00.000Z",
  "totals": { "chainCount": 389, "volume24h": 9650000000, "tvl": 88280000000, "turnover": 0.109 },
  "chains": [
    {
      "name": "Robinhood Chain",
      "slug": "robinhoodchain",
      "chainId": 4663,
      "tokenSymbol": null,
      "tvl": 909600000,
      "volume24h": 1841311171,
      "turnover": 2.0244
    }
  ]
}
```

`chains` holds the top 25 by 24h volume; `totals` is computed over all of them.

## How the two sides are joined

Volume and TVL come from two DeFiLlama surfaces that do not agree on chain naming:

- **TVL** from `/v2/chains`, keyed by display name (`"Robinhood Chain"`, `"Gnosis"`).
- **Volume** from `/overview/dexs`, summed across `protocols[].breakdown24h`, keyed by internal slug (`"robinhood"`, `"xdai"`).

Both sides are normalized to lowercase alphanumerics, and a small alias table in `api/chains-overview.js` covers the pairs that still do not match (`avax` → `avalanche`, `xdai` → `gnosis`, `hyperliquid` → `hyperliquidl1`, and others). A chain appearing on only one side is still listed, with the missing field as `null`, so a high-volume chain with little parked capital is never silently dropped.

Order-book and perp venues that report DEX volume but are not chains (`off_chain`, `edgex`, `zklighter`, `alphasec`, `native_core`) are excluded, so the panel stays an overview of chains rather than of venues.

## Request cost

`/overview/dexs` is fetched with `excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`. Those two flags matter: without them the response carries a full historical time series and is **18MB** instead of 1.75MB, while `protocols[].breakdown24h` (the part this route actually reads) is present either way.

## Related

- `api/chains-overview.js` — the route
- `src/components/ChainsOverviewPanel.ts` — the panel
- [Robinhood Chain](robinhood-chain.md) — the per-chain deep view
