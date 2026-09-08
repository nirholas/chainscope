# Copilot Instructions for Chainscope HQ

## Project Context

Chainscope is an open dashboard for onchain trading: a 3D WebGL globe with data overlays, dense panels, and analysis over live market data. It runs as a web app, a PWA, and a Tauri desktop app.

> **Important:** HQ was originally a geopolitical intelligence dashboard but is now a **DeFi crypto dashboard** for Chainscope. The 3D globe UI remains, and some legacy world-events layers (conflict, military, etc.) still exist in the codebase, but the mission is now **DeFi, crypto markets, protocol analytics, and blockchain data**.

### Tech Stack
- **Build**: Vite 6, vanilla TypeScript (NO React or framework)
- **3D Globe**: deck.gl 9.2 + MapLibre GL 5.16
- **Charts**: d3 7.9
- **API**: Vercel Serverless Functions (plain JavaScript in `api/`)
- **Cache**: Upstash Redis
- **ML**: @xenova/transformers (client-side inference)
- **Desktop**: Tauri v2
- **Tests**: Playwright E2E

### Architecture Overview
- `src/App.ts` (3,940 lines) — monolith orchestrator, initializes everything
- `src/components/DeckGLMap.ts` (3,524 lines) — 3D globe with 27+ map layers
- `src/components/` — 48 vanilla TypeScript classes (DOM-manipulating, no JSX)
- `src/services/` — 78 async data-fetching modules
- `src/config/` — static configuration (feeds, markets, panels, geo data)
- `api/` — 52 Vercel serverless routes (JavaScript)
- `api/_cors.js`, `api/_ip-rate-limit.js`, `api/_upstash-cache.js` — shared helpers (underscore prefix = not routes)

## Commands
```bash
npm run dev              # Dev server
npm run typecheck        # tsc --noEmit
npm run build            # Production build
npm run test:e2e         # Playwright E2E tests
```

## Code Style

### Components are vanilla TS classes
```typescript
export class PanelName {
  private container: HTMLElement;
  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    parent.appendChild(this.container);
  }
  update(data: DataType): void { /* DOM updates */ }
  destroy(): void { this.container.remove(); }
}
```

### Services are async functions
```typescript
export async function fetchSomething(): Promise<DataType[]> {
  const res = await fetch('/api/endpoint');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### API routes use Vercel conventions
```javascript
import { handleCors } from './_cors.js';
import { getCachedData, setCachedData } from './_upstash-cache.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const cached = await getCachedData('cache-key');
  if (cached) return res.json(cached);
  // fetch upstream data, cache it, return
}
```

## Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal

## Editor & Preview

- **Do NOT open files in the editor or preview pane** — it consumes significant processing power in Codespaces
- Never use "open file", "show preview", or similar editor commands — read file contents via tools instead
- Do not launch browser previews or live servers for visual inspection unless the user explicitly requests it

## Important Rules

- **Do NOT introduce React** — the project is deliberately vanilla TypeScript
- **Do NOT split App.ts or DeckGLMap.ts** without a full migration plan
- **Do NOT change API route signatures** without updating the matching client service
- **Do NOT commit API keys** — all secrets go in `.env`
- API helpers prefixed with `_` (e.g., `_cors.js`) are shared utilities, not routes
- Two build variants exist: `full` (DeFi crypto dashboard) and `tech` (AI/startup focus)

## Relationship to Chainscope

HQ is a standalone app that also runs inside [Chainscope](https://github.com/nirholas/chainscope) via iframe. They communicate through `postMessage`. See `docs/llms-full.txt` for complete Chainscope documentation.
