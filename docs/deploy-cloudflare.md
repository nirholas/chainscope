# Deploying to Cloudflare Pages

Chainscope runs on Cloudflare Pages: the Vite build is served as static assets, and the ~100 handlers in `api/` run as a single Pages Function.

```bash
npm install
npx wrangler login          # or export CLOUDFLARE_API_TOKEN
npm run deploy:pages
```

That builds the Function, builds the site, and uploads `dist/` to the Pages project named `chainscope`.

## Preview it locally first

```bash
npm run preview:pages
```

This runs the real Function in workerd on <http://127.0.0.1:8788>, exactly as Cloudflare will. **No credentials are required**, so it is the right way to catch a bundling problem before it reaches a deploy.

Note this is different from `npm run dev`, which runs Vite plus the Node sidecar (`npm run dev:api`). Both serve the same handlers; only `preview:pages` proves they survive the Workers bundler.

## How the API gets there

`api/` is not written for Pages, but it is nearly Workers-native already: every route exports a default `handler(request)` returning a `Response`, declares `runtime: 'edge'`, and imports no Node builtins.

The gap is that a Pages Functions bundle is built ahead of time and **cannot resolve a dynamic import path at runtime**. So `scripts/build-pages-functions.mjs` walks `api/`, emits one static import per route, and writes a catch-all to `functions/api/[[path]].js`:

```
npm run build:functions
# [pages-functions] 100 routes bundled
# [pages-functions] 1 skipped (no default export): data/military-hex-db
```

`functions/` is generated and git-ignored. Regenerate it whenever you add a route; `npm run build:pages` and `npm run deploy:pages` both do that for you.

Files starting with `_` (shared helpers like `_cors.js`), `.test.` files, and modules without a default export are skipped: they are imported *by* routes rather than being routes.

### Route matching

The generated matcher mirrors `src-tauri/sidecar/local-api-server.mjs` exactly, so one route behaves the same under `npm run dev:api`, the desktop sidecar, and Pages. Dynamic segments are supported and verified:

| Pattern | Example | Matches |
| --- | --- | --- |
| `[[...path]]` | `api/eia/[[...path]].js` | `/api/eia/foo/bar` |
| `[param]` | `api/wingbits/details/[icao24].js` | `/api/wingbits/details/abc123` |

More specific routes win: a literal segment outranks `[param]`, which outranks `[...rest]`, which outranks `[[...path]]`.

### `process.env`

Routes read configuration from `process.env`; Workers expose it as `context.env`. The generated Function bridges the two before dispatch, so a route needs no change. Set values with `wrangler pages secret put NAME` or in the Pages dashboard.

`nodejs_compat` is enabled in `wrangler.toml` and is required.

## Configuration

Set these as Pages environment variables or secrets. Everything is optional; the dashboard works with none of them.

| Variable | Purpose |
| --- | --- |
| `CHAINSCOPE_ALLOWED_ORIGINS` | Origins allowed to call the API. An entry beginning with `.` also matches subdomains. Local development and `chainscope*.pages.dev` are always allowed. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Shared response cache across isolates. Without it each isolate keeps its own in-memory cache, which still works but warms more slowly. |
| `GROQ_API_KEY` | AI summaries. |
| `FINNHUB_API_KEY` | Equities lanes. |

## Verified on Pages

Checked against `wrangler pages dev` (workerd), the same runtime Cloudflare uses:

- `/api/robinhood-chain` → 200, live chain 4663 data
- `/api/chains-overview` → 200, 389 chains
- `/api/gas-tracker` → 200, 6 chains including Robinhood
- `/api/eia/foo/bar`, `/api/wingbits/details/abc123` → dispatched to the right dynamic route
- unknown `/api/*` → 404 from the catch-all
- full dashboard: 69 panels mounted, **0 page errors**

## Other targets

A Docker image plus Cloud Run remains supported and is unaffected by any of this: see [deploy-cloud-run.md](deploy-cloud-run.md). That path serves the same handlers through the Node sidecar rather than a Pages Function.
