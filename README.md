# Chainscope

An open dashboard for onchain trading. Perps, trenches, arbitrage and a live overview of every chain, on one screen.

Chainscope reads public data directly, from chain RPCs and keyless public APIs, and renders it as a dense command center: ~140 panels, a 3D globe, and a resilient fetch layer that fails over instead of going blank. It runs as a web app, a PWA, and a Tauri desktop app.

> **Status:** actively being refocused. Chainscope is a rebrand and redirection of a general DeFi intelligence dashboard toward onchain trading specifically. Robinhood Chain support is the first chain built out under the new direction; the broader all-chains overview is in progress. See [ROADMAP.md](ROADMAP.md).

## What it covers

**Perps.** Funding rates, open interest, long/short ratios and liquidation flow across venues, so positioning is visible before it unwinds.

**Trenches.** New launches and early token flow: DEX trending, trending tokens, whale movement and wallet tracking.

**Arbitrage.** Cross-venue price divergence, cross-chain fee comparison, gas across chains and bridge flow, which is where the executable spreads actually live.

**Chains.** A [ranked overview of every chain](docs/chains-overview.md) by 24h DEX volume, TVL and turnover (volume/TVL), which separates chains that trade from chains that merely custody. Plus per-chain TVL, activity, gas and health. [Robinhood Chain](docs/robinhood-chain.md) (chain 4663) is wired directly to its JSON-RPC with a three-endpoint failover chain: block height, block time, gas, USDG supply and Uniswap v2 pair count, all read live with no API key.

**Context.** Protocol revenue and health scores, token unlocks, stablecoin health, ETF flows, exploit alerts and a structured exploit ledger, MEV monitoring, governance, plus 30+ RSS lanes with topic extraction.

## Quick start

```bash
npm install
npm run dev        # Vite dev server on :3000
```

The dashboard works with zero configuration.

Most panels are served by handlers in `api/`, which Vite cannot execute itself. Run them alongside the dev server in a second terminal:

```bash
npm run dev:api    # local handler server on :46123, proxied from /api
```

Without it, `/api/*` returns 404 and the panels that depend on it show their error state rather than data.

Optional API keys in `.env` unlock more lanes (see `.env.example`): `GROQ_API_KEY` (AI summaries), `FINNHUB_API_KEY` (equities), `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (shared cache).

## Commands

```bash
npm run dev              # Dev server (full variant)
npm run dev:api          # Local API handler server (run alongside dev)
npm run dev:tech         # Dev server (tech/AI variant)
npm run typecheck        # tsc --noEmit
npm run build            # Production build
npm run test:e2e         # Playwright E2E tests
npm run test:sidecar     # API/sidecar unit tests
npm run test:data        # Data + config unit tests
npm run build:pages      # Build the Cloudflare Pages Function + site
npm run preview:pages    # Serve the Pages build locally in workerd
```

## Architecture

- Vite 6 + vanilla TypeScript, no framework. Components are TS classes that build DOM directly.
- `src/App.ts` orchestrates everything; `src/components/` holds the panels; `src/services/` fetches data; `src/config/panels.ts` is the panel registry.
- `api/` holds ~100 serverless-style routes (plain JS, edge-runtime shape) that proxy, cache and normalize upstream sources.
- deck.gl 9 + MapLibre GL for the 3D globe, d3 for charts, Tauri v2 for desktop.
- Two build variants: `full` (markets) and `tech` (AI/startups).

**Resilient by design.** Every route has keyless fallback lanes and Upstash Redis caching plus an in-memory stale fallback, so a panel degrades to cached or stale data rather than emptying. Venues that refuse datacenter egress IPs fail over automatically.

### Adding a panel

1. Write the route in `api/<name>.js` following the shape of `api/robinhood-chain.js` (CORS, rate limit, cache, stale fallback).
2. Write `src/components/<Name>Panel.ts` extending `Panel`.
3. Export it from `src/components/index.ts`, register it in `src/config/panels.ts`, and add a lazy factory in `src/App.ts`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `CHAINSCOPE_ALLOWED_ORIGINS` | Comma-separated origins allowed to call the API. An entry beginning with `.` also matches subdomains. Local development, Tauri shells and preview hosts are always allowed. |
| `VITE_TRUSTED_PARENT_ORIGINS` | Comma-separated origins allowed to drive the embedded view over `postMessage`. |
| `LOCAL_API_PORT` | Port for `npm run dev:api` (default `46123`). |

## Desktop

```bash
npm run desktop:dev                  # Tauri dev shell
npm run desktop:package:macos:full   # packaged build (see scripts/desktop-package.mjs)
```

Secrets entered in the desktop Settings window are stored in the OS keychain under the `chainscope` service.

## Deployment

**Cloudflare Pages** is the primary target. The Vite build ships as static assets and the ~100 handlers in `api/` run as a single Pages Function:

```bash
npm run preview:pages   # run the real Function locally in workerd, no credentials needed
npm run deploy:pages    # build and upload
```

Runbook: [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).

**Docker / Cloud Run** is also supported: one container serves the static build and the API routes through an in-process sidecar. Runbook: [docs/deploy-cloud-run.md](docs/deploy-cloud-run.md).

`GET /api/health` reports service status and upstream lane reachability on either target.

## Acknowledgements

Chainscope descends from a DeFi intelligence dashboard that itself began as a fork of [worldmonitor](https://github.com/koala73/worldmonitor) (MIT), and has been rebuilt around onchain trading. Those upstream portions remain available under the MIT License from their original source.

## License

Proprietary. Copyright (c) 2025-2026 nich. All rights reserved: see [LICENSE](LICENSE). No permission is granted to use, copy, modify, or distribute this software without prior written consent.
