---
name: onchain-market-data
description: Pull live onchain market data (chain TVL and volume, perp funding, open interest, liquidations, gas, DEX volume, DeFi yields, top protocols, cross-venue spreads) from the Chainscope JSON API. Use when you need current numbers for a market, chain or protocol question.
---

# Chainscope market data

Chainscope is an open dashboard whose data layer is a set of public JSON endpoints, one file per
endpoint under `api/` in the repo. The hosted copy answers at
`https://chainscope-8m2.pages.dev/api/<endpoint>`. No key, no account. Every response is JSON with
a `timestamp` field (ISO 8601) except `fear-greed`, which passes the upstream shape through.

Use `curl -s` (or `WebFetch`) and read only the fields you need; some payloads are large.

## Endpoints

| Endpoint | What it returns | Query params |
| --- | --- | --- |
| `/api/health` | Service status and a probe of each upstream (`upstreams[].ok`) | `probes=0` skips the probes |
| `/api/chains-overview` | `totals` (chainCount, volume24h, tvl, turnover) and `chains[]` ranked by TVL with `volume24h` and `turnover` | none |
| `/api/chain-tvl` | `chains[]` with `tvl`, `tokenSymbol`, `chainId` | none |
| `/api/top-protocols` | `protocols[]` with `category`, `tvl`, `change24h`, `change7d`, `chains` | `limit` (default 100) |
| `/api/dex-volume` | `dexes[]` with chains and volume figures | none |
| `/api/defi-yields` | `pools[]` with `chain`, `project`, `symbol`, `tvlUsd`, `apy`, `apyBase`, `apyReward`, `apyMean30d`, `stablecoin`, `exposure` | `chain` (case-insensitive name, e.g. `Solana`), `minTvl` in USD (default 100000) |
| `/api/funding-rates` | `rates[]` per symbol: `exchanges.<venue>.fundingRate`, `markPrice`, `avgFunding`, `level` | none |
| `/api/open-interest` | `entries[]` per symbol: `exchanges.<venue>.openInterest`, `oiValue`, `totalOiValue`, `changePct`, `signal` | none |
| `/api/liquidations` | `liquidations[]`: `symbol`, `exchange`, `side` (LONG/SHORT), `price`, `qty`, `value` (USD), `time` (ms), `severity` | none |
| `/api/venue-spread` | Spot price spread across venues: `summary.avgSpreadBps`, `summary.widest`, `spreads[]` with per-venue prices | none |
| `/api/gas-tracker` | `chains[]`: `gasGwei`, `unit`, `level`, `costEstimate.{transfer,swap,complex}` | none |
| `/api/fear-greed` | Crypto Fear and Greed Index history in `data[]` (`value`, `value_classification`, `timestamp` in seconds) | `limit` 1 to 90 (default 30) |

The `api/` directory holds more endpoints (bridge flows, stablecoin dashboards, token unlocks,
governance, whale and MEV monitors). Read the matching `api/<name>.js` before calling one: some
need server-side keys and return an `unavailable` or empty payload on the hosted copy.

## Worked examples

Rank chains by 24h volume:

```bash
curl -s https://chainscope-8m2.pages.dev/api/chains-overview \
  | jq -r '.chains | sort_by(-.volume24h) | .[0:10][] | "\(.name)\t\(.volume24h)\t\(.tvl)"'
```

Best yields on Solana pools with at least 1M USD TVL:

```bash
curl -s 'https://chainscope-8m2.pages.dev/api/defi-yields?chain=Solana&minTvl=1000000' \
  | jq -r '.pools | sort_by(-.apy) | .[0:10][] | "\(.project)\t\(.symbol)\t\(.apy)\t\(.tvlUsd)"'
```

Symbols with the most extreme average funding:

```bash
curl -s https://chainscope-8m2.pages.dev/api/funding-rates \
  | jq -r '.rates | sort_by(-(.avgFunding|fabs)) | .[0:5][] | "\(.symbol)\t\(.avgFunding)\t\(.level)"'
```

## Notes

- Data is cached at the edge for a few minutes; quote the `timestamp` when you report a number.
- Before relying on a figure, check `/api/health?probes=1` (the default) for the upstream behind it.
- Run your own copy from a clone: `npm install`, then `npm run dev:api` (handler server on :46123)
  alongside `npm run dev` (Vite on :3000, proxies `/api`). The README Configuration table lists the
  env vars that enable keyed sources.
