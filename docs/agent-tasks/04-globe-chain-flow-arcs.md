# Agent Task 04: DeFi Globe Layer — Cross-Chain Flow Arcs

## Objective

Add an ArcLayer to the 3D globe that visualizes cross-chain bridge volumes and DeFi capital flows between blockchain ecosystems. Arcs connect chain "home regions" showing direction and magnitude of capital movement.

## Context

- HQ is a vanilla TypeScript app (NO React) with deck.gl 9.2 + MapLibre GL 5.16
- 3D globe in `src/components/DeckGLMap.ts` (3,500+ lines)
- `ArcLayer` is already imported and used (displacement arcs exist as precedent)
- Types in `src/types/index.ts`, config in `src/config/panels.ts`

## Data Strategy

DeFiLlama provides bridge volume data at `https://bridges.llama.fi/bridges` and `https://bridges.llama.fi/transactions/{bridgeId}`. We:
1. Fetch bridge volumes from DeFiLlama bridges API
2. Map each chain to a representative geographic coordinate (e.g., Ethereum → Zug/SF, Solana → SF, Arbitrum → NYC, etc.)
3. Create arcs between chains proportional to bridge volume

## Files to Create

### 1. `src/config/chain-locations.ts` — Chain Geographic Centers

Map blockchain networks to representative coordinates (based on founding team / ecosystem center):

```typescript
export interface ChainLocation {
  chainId: string;        // DeFiLlama chain name lowercase
  name: string;
  lat: number;
  lon: number;
  city: string;
  color: [number, number, number]; // RGB for arc coloring
}

export const CHAIN_LOCATIONS: Record<string, ChainLocation> = {
  ethereum: { chainId: 'ethereum', name: 'Ethereum', lat: 47.3769, lon: 8.5417, city: 'Zug', color: [98, 126, 234] },
  solana: { chainId: 'solana', name: 'Solana', lat: 37.7749, lon: -122.4194, city: 'San Francisco', color: [153, 69, 255] },
  arbitrum: { chainId: 'arbitrum', name: 'Arbitrum', lat: 40.7128, lon: -74.006, city: 'New York', color: [40, 160, 240] },
  optimism: { chainId: 'optimism', name: 'Optimism', lat: 37.7749, lon: -122.4194, city: 'San Francisco', color: [255, 4, 32] },
  base: { chainId: 'base', name: 'Base', lat: 37.7749, lon: -122.4194, city: 'San Francisco', color: [0, 82, 255] },
  polygon: { chainId: 'polygon', name: 'Polygon', lat: 19.076, lon: 72.8777, city: 'Mumbai', color: [130, 71, 229] },
  avalanche: { chainId: 'avalanche', name: 'Avalanche', lat: 40.7128, lon: -74.006, city: 'New York', color: [232, 65, 66] },
  bsc: { chainId: 'bsc', name: 'BNB Chain', lat: 1.3521, lon: 103.8198, city: 'Singapore', color: [243, 186, 47] },
  fantom: { chainId: 'fantom', name: 'Fantom', lat: -33.8688, lon: 151.2093, city: 'Sydney', color: [19, 181, 236] },
  tron: { chainId: 'tron', name: 'Tron', lat: 37.5665, lon: 126.978, city: 'Seoul', color: [255, 6, 10] },
  sui: { chainId: 'sui', name: 'Sui', lat: 37.4419, lon: -122.143, city: 'Palo Alto', color: [77, 162, 255] },
  aptos: { chainId: 'aptos', name: 'Aptos', lat: 37.4419, lon: -122.143, city: 'Palo Alto', color: [0, 191, 165] },
  // Add 15+ more chains
};
```

Offset chains in the same city slightly (±0.5 degrees) so arcs are visually distinct.

### 2. `api/bridge-flows.js` — Edge API Route

Fetch bridge volume data from DeFiLlama and transform into flow arcs:

```javascript
export const config = { runtime: 'edge' };
```

Hit these DeFiLlama endpoints:
- `https://bridges.llama.fi/bridges` — list of bridges with volume
- `https://bridges.llama.fi/bridges?includeChains=true` — includes chain breakdown

Response shape:
```json
{
  "timestamp": "...",
  "flows": [
    {
      "id": "eth-arb",
      "sourceChain": "ethereum",
      "targetChain": "arbitrum", 
      "sourceLat": 47.3769,
      "sourceLon": 8.5417,
      "targetLat": 40.7128,
      "targetLon": -74.006,
      "volume24h": 45000000,
      "bridgeName": "Arbitrum Bridge",
      "txCount": 12500
    }
  ],
  "bridges": [
    { "name": "Arbitrum Bridge", "volume24h": 120000000, "chains": ["ethereum", "arbitrum"] }
  ],
  "summary": {
    "totalVolume24h": 850000000,
    "activeBridges": 25,
    "topFlow": { "from": "ethereum", "to": "arbitrum" },
    "flowCount": 45
  }
}
```

Include the chain locations lookup inline in the API file (since Edge Functions can't import from `src/`).

### 3. `src/types/index.ts` — Add Types

```typescript
export interface BridgeFlow {
  id: string;
  sourceChain: string;
  targetChain: string;
  sourceLat: number;
  sourceLon: number;
  targetLat: number;
  targetLon: number;
  volume24h: number;
  bridgeName: string;
  txCount: number;
}

export interface BridgeFlowResult {
  timestamp: string;
  flows: BridgeFlow[];
  bridges: Array<{ name: string; volume24h: number; chains: string[] }>;
  summary: {
    totalVolume24h: number;
    activeBridges: number;
    topFlow: { from: string; to: string };
    flowCount: number;
  };
}
```

### 4. `src/types/index.ts` — Extend MapLayers

```typescript
chainFlows: boolean;
```

### 5. `src/config/panels.ts`

`FULL_MAP_LAYERS`: `chainFlows: true`
All others: `chainFlows: false`

### 6. `src/components/DeckGLMap.ts` — Add ArcLayer

**a) Data property:**
```typescript
private bridgeFlows: BridgeFlow[] = [];
```

**b) Fetch:**
```typescript
private async fetchBridgeFlows(): Promise<void> {
  try {
    const res = await fetch('/api/bridge-flows');
    if (!res.ok) return;
    const data = await res.json();
    this.bridgeFlows = data.flows || [];
    this.render();
  } catch (e) {
    console.warn('[DeckGLMap] Failed to fetch bridge flows:', e);
  }
}
```

**c) ArcLayer creation:**
```typescript
private createChainFlowsLayer(): ArcLayer {
  return new ArcLayer({
    id: 'chain-flows-layer',
    data: this.bridgeFlows,
    getSourcePosition: (d: BridgeFlow) => [d.sourceLon, d.sourceLat],
    getTargetPosition: (d: BridgeFlow) => [d.targetLon, d.targetLat],
    getSourceColor: [0, 255, 100, 180],    // DeFi green source
    getTargetColor: [100, 200, 255, 180],  // Blue target
    getWidth: (d: BridgeFlow) => Math.max(1, Math.log10(d.volume24h / 1e6) * 2),
    widthMinPixels: 1,
    widthMaxPixels: 8,
    pickable: true,
    greatCircle: true,                     // Follow Earth curvature
  });
}
```

**d) In `buildLayers()`:**
```typescript
if (mapLayers.chainFlows && this.bridgeFlows.length > 0) {
  layers.push(this.createChainFlowsLayer());
}
```

**e) Click popup:** Show source chain → target chain, bridge name, 24h volume, tx count.

### 7. Layer Toggle

Add toggle for `chainFlows` with label "Chain Flows" and an arc icon.

## Visual Design

- Arcs follow great circle paths (curved on the 3D globe)
- Width proportional to log(volume) for visual balance
- Green → Blue gradient shows flow direction (source → destination)
- Higher-volume flows are thicker and more opaque
- Clicking an arc shows bridge details (name, volume, chains)
- At zoom-out level, the arcs create a beautiful web of global DeFi capital movement

## Testing

1. `npm run typecheck` passes
2. Arcs appear between chain locations on the globe
3. Major flows (ETH↔Arbitrum, ETH↔Optimism) are clearly visible
4. Arc width varies by volume
5. Click popup works

## Do NOT

- Do NOT introduce React
- Do NOT modify existing layers
- Do NOT change the existing bridge-related panels
