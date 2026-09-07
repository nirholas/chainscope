# Agent Task 02: DeFi Globe Layer — TVL Geographic Heatmap

## Objective

Add a HeatmapLayer to the 3D globe that visualizes Total Value Locked (TVL) concentration by geographic region. This shows where DeFi capital is concentrated globally based on protocol headquarters and team locations.

## Context

- HQ is a vanilla TypeScript app (NO React) with deck.gl 9.2 + MapLibre GL 5.16
- The 3D globe is `src/components/DeckGLMap.ts` (3,500+ lines)
- `HeatmapLayer` is already imported from `@deck.gl/aggregation-layers` (used for climate layer)
- Types in `src/types/index.ts`, layer config in `src/config/panels.ts`
- API routes are Edge Runtime JavaScript in `api/`

## Data Strategy

DeFiLlama provides TVL data per protocol but NOT geographic data. We solve this by:
1. Fetching top protocols from DeFiLlama (`/api/top-protocols` already exists)
2. Mapping known protocol headquarters/team locations to coordinates
3. Creating a weighted heatmap where each point's weight = protocol TVL at that location

## Files to Create

### 1. `src/config/protocol-geo.ts` — Protocol Geographic Registry

Create a static mapping of top 100+ DeFi protocols to their headquarters/team base:

```typescript
export interface ProtocolLocation {
  name: string;           // Must match DeFiLlama protocol name/slug
  slug: string;           // DeFiLlama slug
  lat: number;
  lon: number;
  city: string;
  country: string;
  region: string;         // 'north-america' | 'europe' | 'asia' | 'other'
}

export const PROTOCOL_LOCATIONS: ProtocolLocation[] = [
  // Major DeFi protocols with known team locations
  { name: 'Lido', slug: 'lido', lat: 50.0755, lon: 14.4378, city: 'Remote/EU', country: 'EU', region: 'europe' },
  { name: 'Aave', slug: 'aave', lat: 51.5074, lon: -0.1278, city: 'London', country: 'UK', region: 'europe' },
  { name: 'MakerDAO', slug: 'makerdao', lat: 55.6761, lon: 12.5683, city: 'Copenhagen', country: 'DK', region: 'europe' },
  { name: 'Uniswap', slug: 'uniswap', lat: 40.7128, lon: -74.0060, city: 'New York', country: 'US', region: 'north-america' },
  { name: 'Curve Finance', slug: 'curve-dex', lat: 46.2044, lon: 6.1432, city: 'Remote/CH', country: 'CH', region: 'europe' },
  { name: 'Compound', slug: 'compound', lat: 37.7749, lon: -122.4194, city: 'San Francisco', country: 'US', region: 'north-america' },
  { name: 'Rocket Pool', slug: 'rocket-pool', lat: -33.8688, lon: 151.2093, city: 'Sydney', country: 'AU', region: 'other' },
  { name: 'Convex Finance', slug: 'convex-finance', lat: 40.7128, lon: -74.0060, city: 'Remote/US', country: 'US', region: 'north-america' },
  { name: 'Eigenlayer', slug: 'eigenlayer', lat: 47.6062, lon: -122.3321, city: 'Seattle', country: 'US', region: 'north-america' },
  { name: 'Jupiter', slug: 'jupiter', lat: 1.3521, lon: 103.8198, city: 'Singapore', country: 'SG', region: 'asia' },
  { name: 'Raydium', slug: 'raydium', lat: 1.3521, lon: 103.8198, city: 'Singapore', country: 'SG', region: 'asia' },
  { name: 'Marinade', slug: 'marinade-finance', lat: 50.0755, lon: 14.4378, city: 'Prague', country: 'CZ', region: 'europe' },
  { name: 'Jito', slug: 'jito', lat: 40.7128, lon: -74.0060, city: 'New York', country: 'US', region: 'north-america' },
  { name: 'Morpho', slug: 'morpho', lat: 48.8566, lon: 2.3522, city: 'Paris', country: 'FR', region: 'europe' },
  { name: 'Pendle', slug: 'pendle', lat: 1.3521, lon: 103.8198, city: 'Singapore', country: 'SG', region: 'asia' },
  { name: 'GMX', slug: 'gmx', lat: 1.3521, lon: 103.8198, city: 'Remote/Asia', country: 'SG', region: 'asia' },
  { name: 'dYdX', slug: 'dydx', lat: 40.7128, lon: -74.0060, city: 'New York', country: 'US', region: 'north-america' },
  { name: 'Ethena', slug: 'ethena', lat: 1.3521, lon: 103.8198, city: 'Singapore', country: 'SG', region: 'asia' },
  { name: 'Ondo Finance', slug: 'ondo-finance', lat: 40.7128, lon: -74.0060, city: 'New York', country: 'US', region: 'north-america' },
  { name: 'Usual', slug: 'usual', lat: 48.8566, lon: 2.3522, city: 'Paris', country: 'FR', region: 'europe' },
  { name: 'Sky (MakerDAO)', slug: 'sky-ecosystem', lat: 55.6761, lon: 12.5683, city: 'Copenhagen', country: 'DK', region: 'europe' },
  { name: 'Spark Protocol', slug: 'spark', lat: 55.6761, lon: 12.5683, city: 'Copenhagen', country: 'DK', region: 'europe' },
  { name: 'Instadapp', slug: 'instadapp', lat: 19.0760, lon: 72.8777, city: 'Mumbai', country: 'IN', region: 'asia' },
  { name: 'Balancer', slug: 'balancer', lat: 46.2044, lon: 6.1432, city: 'Remote/CH', country: 'CH', region: 'europe' },
  { name: 'SushiSwap', slug: 'sushiswap', lat: 35.6762, lon: 139.6503, city: 'Remote/Global', country: 'JP', region: 'asia' },
  { name: 'PancakeSwap', slug: 'pancakeswap', lat: 1.3521, lon: 103.8198, city: 'Singapore', country: 'SG', region: 'asia' },
  { name: 'Synthetix', slug: 'synthetix', lat: -33.8688, lon: 151.2093, city: 'Sydney', country: 'AU', region: 'other' },
  { name: 'Yearn Finance', slug: 'yearn-finance', lat: 51.5074, lon: -0.1278, city: 'Remote/Global', country: 'UK', region: 'europe' },
  { name: '1inch', slug: '1inch-network', lat: 55.7558, lon: 37.6173, city: 'Remote', country: 'UAE', region: 'other' },
  { name: 'Hyperliquid', slug: 'hyperliquid', lat: 40.7128, lon: -74.0060, city: 'New York', country: 'US', region: 'north-america' },
  // Add 70+ more protocols — include all top DeFiLlama protocols
  // Focus on accuracy of known team locations
];
```

Include at least **80 protocols** covering the top DeFiLlama protocols by TVL. Research the actual team/company locations where possible.

### 2. `api/tvl-geo.js` — Edge API Route

This route:
1. Fetches current TVL data from DeFiLlama (`https://api.llama.fi/protocols`)
2. Joins with the protocol-geo mapping (import from a small inline lookup or use a condensed version)
3. Returns geographic TVL data points

```javascript
export const config = { runtime: 'edge' };
```

Response shape:
```json
{
  "timestamp": "...",
  "points": [
    {
      "lat": 40.7128,
      "lon": -74.006,
      "tvl": 15200000000,
      "city": "New York",
      "country": "US",
      "protocols": [
        { "name": "Uniswap", "tvl": 5200000000 },
        { "name": "dYdX", "tvl": 320000000 }
      ]
    }
  ],
  "summary": {
    "totalMappedTvl": 85000000000,
    "totalGlobalTvl": 95000000000,
    "coveragePercent": 89.5,
    "topRegion": "north-america",
    "pointCount": 35
  }
}
```

Group protocols by city/location so each geographic point aggregates all protocols at that location.

**IMPORTANT**: Since Edge Functions can't import from `src/`, include a condensed protocol-geo lookup directly in the API file (just slug → {lat, lon, city, country}).

### 3. `src/types/index.ts` — Add Types

```typescript
export interface TvlGeoPoint {
  lat: number;
  lon: number;
  tvl: number;
  city: string;
  country: string;
  protocols: Array<{ name: string; tvl: number }>;
}

export interface TvlGeoResult {
  timestamp: string;
  points: TvlGeoPoint[];
  summary: {
    totalMappedTvl: number;
    totalGlobalTvl: number;
    coveragePercent: number;
    topRegion: string;
    pointCount: number;
  };
}
```

### 4. `src/types/index.ts` — Extend MapLayers

Add `tvlHeatmap: boolean;` to the `MapLayers` interface in the DeFi globe layers section.

### 5. `src/config/panels.ts` — Enable Layer

In `FULL_MAP_LAYERS`:
```typescript
tvlHeatmap: true,
```

In all other map layer sets (mobile, tech):
```typescript
tvlHeatmap: false,
```

### 6. `src/components/DeckGLMap.ts` — Add HeatmapLayer

**a) Data property:**
```typescript
private tvlGeoPoints: TvlGeoPoint[] = [];
```

**b) Fetch method:**
```typescript
private async fetchTvlGeo(): Promise<void> {
  try {
    const res = await fetch('/api/tvl-geo');
    if (!res.ok) return;
    const data = await res.json();
    this.tvlGeoPoints = data.points || [];
    this.render();
  } catch (e) {
    console.warn('[DeckGLMap] Failed to fetch TVL geo:', e);
  }
}
```

**c) Layer creation:**
```typescript
private createTvlHeatmapLayer(): HeatmapLayer {
  return new HeatmapLayer({
    id: 'tvl-heatmap-layer',
    data: this.tvlGeoPoints,
    getPosition: (d: TvlGeoPoint) => [d.lon, d.lat],
    getWeight: (d: TvlGeoPoint) => Math.log10(d.tvl + 1),  // log scale for visual balance
    radiusPixels: 60,
    intensity: 1.5,
    threshold: 0.05,
    colorRange: [
      [0, 25, 0, 25],        // Dim green
      [0, 85, 0, 100],       // Green
      [0, 200, 83, 150],     // Bright green (DeFi green)
      [0, 255, 100, 200],    // Vivid green
      [255, 200, 0, 220],    // Yellow (high TVL)
      [255, 100, 0, 255],    // Orange (very high TVL)
    ],
    pickable: true,
  });
}
```

Also add a ScatterplotLayer overlay for clickable protocol clusters at each city:

```typescript
private createTvlCitiesLayer(): ScatterplotLayer {
  return new ScatterplotLayer({
    id: 'tvl-cities-layer',
    data: this.tvlGeoPoints,
    getPosition: (d: TvlGeoPoint) => [d.lon, d.lat],
    getRadius: (d: TvlGeoPoint) => Math.sqrt(d.tvl / 1e8) * 2000,
    getFillColor: [0, 255, 100, 120],   // DeFi green, semi-transparent
    radiusMinPixels: 4,
    radiusMaxPixels: 30,
    pickable: true,
    stroked: true,
    getLineColor: [0, 255, 100, 200],
    lineWidthMinPixels: 1,
  });
}
```

**d) In `buildLayers()`:**
```typescript
if (mapLayers.tvlHeatmap && this.tvlGeoPoints.length > 0) {
  layers.push(this.createTvlHeatmapLayer());
  layers.push(this.createTvlCitiesLayer());
}
```

**e) Click popup:** When clicking a TVL city point, show city name, total TVL, and list of protocols with their individual TVL.

### 7. Layer Toggle

Add toggle for `tvlHeatmap` with label "TVL Heatmap" and a green DeFi-themed icon.

## Visual Design

- Heatmap uses green-to-orange color gradient (DeFi green theme)
- City overlay dots are proportional to TVL (sqrt scale)
- Popup shows protocol breakdown when clicking a city
- Works well at both zoomed-out (heatmap visible) and zoomed-in (city dots visible) levels

## Testing

1. `npm run typecheck` passes
2. TVL heatmap renders on the globe with green hotspots
3. Major DeFi hubs (NYC, London, Singapore, SF) glow brightest
4. Clicking a hotspot shows protocol list with TVL values

## Do NOT

- Do NOT introduce React or any UI framework
- Do NOT modify existing layers or their behavior
- Do NOT change the existing `top-protocols` API route
