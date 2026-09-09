# Auditing routes, APIs and panels

Two tools cover the surface. Both run against a deployed URL by default, because several upstreams behave differently for Cloudflare's edge IPs than for a laptop, and the deployed behaviour is the one users get.

```bash
npm run audit:api      # every route in api/
npm run audit:panels   # every panel, in a real browser
```

## `audit:api`

Walks `api/`, calls each route, and classifies the answer:

| Verdict | Meaning |
| --- | --- |
| `OK` | 2xx with a usable payload |
| `DEGRADED` | 200, but the route returned its documented `unavailable` fallback because an upstream failed |
| `UNCONFIGURED` | 200 with `configured: false`. The lane needs an optional API key. This is designed behaviour, not a fault |
| `FAIL` | non-2xx, unparseable body, or a 200 carrying an error |

Routes needing parameters have them in `ROUTE_PARAMS`, and POST-only routes are listed in `POST_ONLY` so their correct 405 is not read as breakage. Add to those lists when you add a route, or the audit will report a false failure.

Exits non-zero on any `FAIL`, so it can gate a deploy.

## `audit:panels`

Mounting is not the same as working. A panel can mount and then render its error state, sit on a spinner, or come up blank. This drives a real browser, scrolls each panel into view (they lazy-load on intersection), waits for it to settle, and reports what a user would actually see: `OK`, `DEGRADED`, `EMPTY`, `LOADING`, `ERROR`, `MISSING`, plus any uncaught page errors.

If Playwright's bundled browser revision does not match what is installed, point it at one:

```bash
CHROMIUM_PATH=/path/to/chrome npm run audit:panels
```

## What the first full audit found

Run against production on 2026-09-09. Four real defects, all fixed:

1. **`whale-monitor` returned 500 on every request.** It called `createIpRateLimiter`'s return value as a function (`await limiter(req)`), but that helper returns `{ check, size }`. Thirty-eight other routes use `limiter.check(ip)` correctly.
2. **`story` and `og-story` returned 500 on every request.** Both were written as Express-style `(req, res)` handlers calling `res.setHeader` and `res.writeHead`, in a codebase where every other route is edge-style `(request) => Response`. Neither can work on Workers or in the sidecar.
3. **`mev-monitor` had no working data source and was fabricating output.** Its primary, `blocks.flashbots.net`, is decommissioned and answers HTTP 410; the libmev secondary is unreachable. Worse, when block data lacked MEV detail the route invented it: `sandwichRate` fell back to a hardcoded `0.15`, `arbitrageProfit24h` was `totalMev * 0.4` under a comment reading "~40% of MEV is arb", and ETH was pinned at `$3500` (roughly 40% above the real price), so every USD figure on the panel was wrong. It now reads MEV-Boost relay payload traces, prices ETH from a live lane with failover, and reports only what the relay actually provides. The sandwich section is gone because nothing supplies that data.
4. **`coingecko-trending` had a single lane and hard-failed on it.** CoinGecko refuses Cloudflare's edge ranges, so it 403'd in production while working locally. GeckoTerminal is now a keyless DEX-native failover, normalized into the same shape.

Two upstreams are gone for good and no keyless replacement exists:

- **DeFiLlama's bridge endpoints are paid.** `bridges.llama.fi` answers HTTP 402 on every path. `bridge-flows` and `bridge-monitor` return their `unavailable` shape and the panels show it.
- **The Graph's hosted subgraphs need a key.** `subgraph-aave`, `subgraph-compound` and `subgraph-uniswap` degrade the same way.

These are reported as `DEGRADED` rather than patched over with invented numbers.
