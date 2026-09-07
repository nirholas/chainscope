# Agent Task 03: DeFi Globe Layer — Exchange & Regulatory Map

## Objective

Add an IconLayer to the 3D globe showing major crypto exchange headquarters with regulatory status indicators, plus a GeoJsonLayer showing regulatory climate by country (crypto-friendly vs restrictive).

## Context

- HQ is a vanilla TypeScript app (NO React) with deck.gl 9.2 + MapLibre GL 5.16
- 3D globe in `src/components/DeckGLMap.ts` (3,500+ lines)
- IconLayer and GeoJsonLayer already imported and used (see bases layer, conflict zones layer)
- Types in `src/types/index.ts`, layer config in `src/config/panels.ts`

## Files to Create

### 1. `src/config/crypto-exchanges.ts` — Exchange Registry

Static dataset of 40+ major exchanges with HQ locations and regulatory status:

```typescript
export type ExchangeStatus = 'licensed' | 'restricted' | 'banned' | 'unregulated' | 'relocated';
export type ExchangeType = 'cex' | 'dex' | 'hybrid';

export interface CryptoExchange {
  id: string;
  name: string;
  type: ExchangeType;
  lat: number;
  lon: number;
  city: string;
  country: string;
  countryCode: string;
  status: ExchangeStatus;
  volume24h?: number;      // Will be enriched by API
  founded: number;         // Year
  note?: string;           // e.g., "Relocated from China 2021"
  url: string;
}

export const CRYPTO_EXCHANGES: CryptoExchange[] = [
  {
    id: 'binance', name: 'Binance', type: 'cex',
    lat: 25.2048, lon: 55.2708, city: 'Dubai', country: 'UAE', countryCode: 'AE',
    status: 'licensed', founded: 2017, note: 'HQ relocated multiple times; Dubai since 2022', url: 'https://binance.com'
  },
  {
    id: 'coinbase', name: 'Coinbase', type: 'cex',
    lat: 37.7749, lon: -122.4194, city: 'San Francisco', country: 'US', countryCode: 'US',
    status: 'licensed', founded: 2012, note: 'NASDAQ listed (COIN)', url: 'https://coinbase.com'
  },
  {
    id: 'kraken', name: 'Kraken', type: 'cex',
    lat: 37.7749, lon: -122.4194, city: 'San Francisco', country: 'US', countryCode: 'US',
    status: 'licensed', founded: 2011, url: 'https://kraken.com'
  },
  {
    id: 'okx', name: 'OKX', type: 'cex',
    lat: 22.3193, lon: 114.1694, city: 'Hong Kong', country: 'China', countryCode: 'HK',
    status: 'licensed', founded: 2017, note: 'Seychelles registered, HK operations', url: 'https://okx.com'
  },
  {
    id: 'bybit', name: 'Bybit', type: 'cex',
    lat: 25.2048, lon: 55.2708, city: 'Dubai', country: 'UAE', countryCode: 'AE',
    status: 'licensed', founded: 2018, note: 'Relocated from Singapore to Dubai', url: 'https://bybit.com'
  },
  // Include 35+ more: Bitfinex, Huobi/HTX, Gate.io, KuCoin, Gemini, Bitstamp,
  // Upbit, Bithumb, Crypto.com, dYdX, Hyperliquid, Uniswap (Labs HQ),
  // Jupiter, Raydium, Curve, Deribit, BitMEX, FTX (defunct), etc.
];
```

### 2. `src/config/crypto-regulation.ts` — Country Regulatory Status

Static dataset mapping countries to their crypto regulatory stance:

```typescript
export type RegulationStance = 'friendly' | 'moderate' | 'restrictive' | 'banned';

export interface CountryRegulation {
  countryCode: string;
  name: string;
  stance: RegulationStance;
  details: string;
  hasFramework: boolean;
  allowsExchanges: boolean;
  allowsStablecoins: boolean;
  taxRate?: string;
}

export const COUNTRY_REGULATIONS: CountryRegulation[] = [
  { countryCode: 'AE', name: 'United Arab Emirates', stance: 'friendly', details: 'VARA framework, Dubai crypto hub', hasFramework: true, allowsExchanges: true, allowsStablecoins: true, taxRate: '0%' },
  { countryCode: 'CH', name: 'Switzerland', stance: 'friendly', details: 'Crypto Valley Zug, FINMA regulated', hasFramework: true, allowsExchanges: true, allowsStablecoins: true },
  { countryCode: 'SG', name: 'Singapore', stance: 'moderate', details: 'MAS licensed, retail restrictions', hasFramework: true, allowsExchanges: true, allowsStablecoins: true },
  { countryCode: 'US', name: 'United States', stance: 'moderate', details: 'SEC/CFTC regulatory uncertainty, state-by-state', hasFramework: false, allowsExchanges: true, allowsStablecoins: true },
  { countryCode: 'CN', name: 'China', stance: 'banned', details: 'Complete ban on crypto trading since 2021', hasFramework: false, allowsExchanges: false, allowsStablecoins: false },
  // Include 50+ countries covering all major economies
];
```

### 3. `src/types/index.ts` — Add Types

Import and reference the config types. Also add to MapLayers:
```typescript
// DeFi globe layers
exchangeMap: boolean;
```

### 4. `src/config/panels.ts` — Enable Layer

`FULL_MAP_LAYERS`: `exchangeMap: true`
All others: `exchangeMap: false`

### 5. `src/components/DeckGLMap.ts` — Add Layers

**a) Import exchange data at top:**
```typescript
import { CRYPTO_EXCHANGES } from '@/config/crypto-exchanges';
import { COUNTRY_REGULATIONS } from '@/config/crypto-regulation';
```

**b) Create exchange IconLayer:**
```typescript
private createExchangeMapLayer(): ScatterplotLayer {
  return new ScatterplotLayer({
    id: 'exchange-map-layer',
    data: CRYPTO_EXCHANGES,
    getPosition: (d) => [d.lon, d.lat],
    getRadius: 20000,
    getFillColor: (d) => {
      const statusColors: Record<string, [number, number, number, number]> = {
        licensed: [0, 200, 83, 200],      // Green
        restricted: [255, 200, 0, 200],   // Yellow
        banned: [255, 60, 60, 200],       // Red
        unregulated: [150, 150, 150, 200], // Gray
        relocated: [255, 140, 0, 200],    // Orange
      };
      return statusColors[d.status] || [150, 150, 150, 180];
    },
    radiusMinPixels: 6,
    radiusMaxPixels: 18,
    pickable: true,
    stroked: true,
    getLineColor: [255, 255, 255, 150],
    lineWidthMinPixels: 1,
  });
}
```

**c) Create regulatory GeoJson overlay** (country fills based on stance):
Use a GeoJsonLayer with the world countries GeoJSON (check if the project already has a countries geojson, otherwise use Natural Earth simplified). Color countries by regulatory stance:
- friendly → green tint
- moderate → yellow tint  
- restrictive → orange tint
- banned → red tint

**d) In `buildLayers()`:**
```typescript
if (mapLayers.exchangeMap) {
  layers.push(this.createRegulatoryOverlayLayer());  // country fills first (underneath)
  layers.push(this.createExchangeMapLayer());          // exchange dots on top
}
```

**e) Click popup:** Show exchange details — name, type, status, city, country, volume, founded year, and notes.

### 6. Layer Toggle

Add toggle for `exchangeMap` with label "Exchanges & Regulation".

## Visual Design

- Exchange dots: colored by regulatory status (green=licensed, yellow=restricted, red=banned)
- Country overlay: very subtle tinted fill (alpha 30-50) to show regulatory climate
- Popup for exchanges shows a small card with name, status badge, location, volume
- Multiple exchanges in same city should be offset slightly or show aggregated popup

## Testing

1. `npm run typecheck` passes
2. Exchange dots appear on the globe at correct locations
3. Country fills show regulatory stance
4. Clicking an exchange shows detail popup

## Do NOT

- Do NOT introduce React
- Do NOT modify existing layers
- Do NOT fetch exchange data from an API — this is static config data (exchange locations don't change)
