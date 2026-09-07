# Agent Task 01: DeFi Globe Layer — Validator Node Distribution

## Objective

Add a new 3D globe layer that visualizes the geographic distribution of blockchain validator/node infrastructure worldwide. This is the first of several DeFi-specific globe layers that will differentiate HQ from every other DeFi dashboard — no competitor has a 3D globe for crypto data.

## Context

- HQ is a vanilla TypeScript app (NO React) built with Vite 6, deck.gl 9.2, MapLibre GL 5.16
- The 3D globe lives in `src/components/DeckGLMap.ts` (3,500+ lines)
- There are 27+ existing map layers (conflicts, bases, earthquakes, etc.) but ZERO DeFi layers
- API routes are plain JavaScript Edge Functions in `api/`
- All types live in `src/types/index.ts`
- Layer config lives in `src/config/panels.ts`

## Files to Create

### 1. `api/validator-nodes.js` — Edge API Route

Fetch validator/node geographic data. Use these free data sources:
- **Ethereum nodes**: `https://ethernodes.org/api/nodes` (country-level distribution)
- **Fallback**: Use static geographic distribution data based on known node statistics from ethernodes.org

Follow the exact Edge Runtime pattern:

```javascript
export const config = { runtime: 'edge' };

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { createIpRateLimiter } from './_ip-rate-limit.js';

const limiter = createIpRateLimiter({ limit: 20, windowMs: 60_000 });
const CACHE_TTL = 900; // 15 min — node data changes slowly
let cachedResponse = null;
let cacheTimestamp = 0;
```

Response shape:
```json
{
  "timestamp": "2024-...",
  "nodes": [
    {
      "id": "eth-us",
      "chain": "ethereum",
      "country": "US",
      "countryName": "United States",
      "lat": 37.0902,
      "lon": -95.7129,
      "nodeCount": 1842,
      "percentage": 34.2,
      "client": { "geth": 62, "nethermind": 18, "besu": 8, "erigon": 7, "other": 5 }
    }
  ],
  "chains": ["ethereum", "solana", "polygon", "arbitrum", "base"],
  "summary": {
    "totalNodes": 12500,
    "topCountry": "United States",
    "chainCount": 5,
    "nakamotoCoefficient": 3
  }
}
```

Since ethernodes.org API may be unreliable, include a hardcoded fallback dataset of the top 20 countries for Ethereum nodes based on publicly known distribution. The API should try the live fetch first, then fall back to static data.

Also include approximate node locations for Solana (via validators.app data patterns), and the major L2s (Arbitrum, Base, Optimism) using known sequencer/node locations.

### 2. `src/types/index.ts` — Add Types

Add these types near the DeFi section (bottom of file):

```typescript
export interface ValidatorNode {
  id: string;
  chain: string;
  country: string;
  countryName: string;
  lat: number;
  lon: number;
  nodeCount: number;
  percentage: number;
  client?: Record<string, number>;
}

export interface ValidatorNodesResult {
  timestamp: string;
  nodes: ValidatorNode[];
  chains: string[];
  summary: {
    totalNodes: number;
    topCountry: string;
    chainCount: number;
    nakamotoCoefficient: number;
  };
}
```

### 3. `src/types/index.ts` — Extend MapLayers

Add `validatorNodes: boolean;` to the `MapLayers` interface after the tech variant layers:

```typescript
// DeFi globe layers
validatorNodes: boolean;
```

### 4. `src/config/panels.ts` — Enable Layer

In `FULL_MAP_LAYERS`, add:
```typescript
validatorNodes: true,
```

In `FULL_MOBILE_MAP_LAYERS`, `TECH_MAP_LAYERS`, and `TECH_MOBILE_MAP_LAYERS`, add:
```typescript
validatorNodes: false,
```

### 5. `src/components/DeckGLMap.ts` — Add Layer

Add these modifications to DeckGLMap.ts:

**a) Add data property:**
```typescript
private validatorNodes: ValidatorNode[] = [];
```

**b) Add fetch method:**
```typescript
private async fetchValidatorNodes(): Promise<void> {
  try {
    const res = await fetch('/api/validator-nodes');
    if (!res.ok) return;
    const data = await res.json();
    this.validatorNodes = data.nodes || [];
    this.render();
  } catch (e) {
    console.warn('[DeckGLMap] Failed to fetch validator nodes:', e);
  }
}
```

**c) Call fetch in init (where other fetches happen):**
```typescript
this.fetchValidatorNodes();
```

**d) Add layer creation method:**
```typescript
private createValidatorNodesLayer(): ScatterplotLayer {
  return new ScatterplotLayer({
    id: 'validator-nodes-layer',
    data: this.validatorNodes,
    getPosition: (d: ValidatorNode) => [d.lon, d.lat],
    getRadius: (d: ValidatorNode) => Math.sqrt(d.nodeCount) * 5000,
    getFillColor: (d: ValidatorNode) => {
      // Color by chain
      const colors: Record<string, [number, number, number, number]> = {
        ethereum: [98, 126, 234, 200],    // ETH blue
        solana: [153, 69, 255, 200],      // SOL purple
        polygon: [130, 71, 229, 200],     // MATIC purple
        arbitrum: [40, 160, 240, 200],    // ARB blue
        base: [0, 82, 255, 200],          // Base blue
      };
      return colors[d.chain] || [100, 200, 255, 180];
    },
    radiusMinPixels: 6,
    radiusMaxPixels: 40,
    pickable: true,
    stroked: true,
    getLineColor: [255, 255, 255, 100],
    lineWidthMinPixels: 1,
  });
}
```

**e) Add to `buildLayers()`:**
```typescript
if (mapLayers.validatorNodes && this.validatorNodes.length > 0) {
  layers.push(this.createValidatorNodesLayer());
}
```

**f) Add popup handler for clicks on this layer (in the onClick or getTooltip section):**
Show chain name, country, node count, percentage, and client distribution when clicked.

### 6. Layer Toggle UI

In DeckGLMap.ts, find where layer toggles are created (search for `layer-toggle` or the layer control panel builder). Add a toggle for `validatorNodes` with label "Validator Nodes" and a chain-colored icon.

## Integration Notes

- The layer should use `ScatterplotLayer` with radius proportional to `sqrt(nodeCount)` for visual balance
- Colors differentiate chains (ETH blue, SOL purple, etc.)
- Clicking a node cluster shows a popup with chain breakdown and client diversity
- The layer toggle appears in the map controls alongside existing toggles
- Data refreshes every 15 minutes (matching the API cache TTL)

## Testing

After implementation, verify:
1. `npm run typecheck` passes
2. The validator nodes layer appears on the globe when toggled on
3. Clicking a node shows the popup with correct data
4. The API route returns valid JSON with the expected shape

## Do NOT

- Do NOT introduce React or any UI framework
- Do NOT change existing API route signatures
- Do NOT restructure DeckGLMap.ts — only add new methods and layer entries
- Do NOT modify any other existing layers
