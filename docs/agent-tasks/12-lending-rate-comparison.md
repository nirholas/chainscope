# Agent Task 12: Lending Rate Comparison Panel

## Objective

Create a lending/borrowing rate comparison panel that shows supply APY, borrow APY, and utilization across Aave, Compound, Morpho, and other lending protocols for the same assets. Essential for DeFi users to find the best yield.

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6
- Panel components extend `Panel` from `src/components/Panel.ts`
- API routes are Edge Runtime JavaScript in `api/`
- Types in `src/types/index.ts`, panel config in `src/config/panels.ts`
- DeFiLlama yields API at `https://yields.llama.fi/pools` provides cross-protocol yield data

## Data Source

DeFiLlama Yields API is the ideal source — it provides yield data across all lending protocols with a single query:
- `https://yields.llama.fi/pools` — all yield pools (can be large, ~10K+ pools)
- Filter by `category: 'Lending'` or `'CDP'`
- Filter by `project` for specific protocols
- Already used by the existing `defi-yields.js` route, but that serves general yields — this route focuses specifically on lending/borrowing comparison

## Files to Create

### 1. `api/lending-rates.js` — Edge API Route

```javascript
export const config = { runtime: 'edge' };
```

Fetch from DeFiLlama yields, filter to lending protocols, and pivot by asset:

Response shape:
```json
{
  "timestamp": "...",
  "assets": [
    {
      "symbol": "USDC",
      "name": "USD Coin",
      "rates": [
        {
          "protocol": "Aave V3",
          "chain": "Ethereum",
          "supplyAPY": 4.25,
          "borrowAPY": 5.12,
          "rewardAPY": 0,
          "netSupplyAPY": 4.25,
          "netBorrowAPY": 5.12,
          "tvl": 2500000000,
          "utilization": 0.82,
          "poolId": "aave-v3-ethereum-usdc"
        },
        {
          "protocol": "Compound V3",
          "chain": "Ethereum",
          "supplyAPY": 3.85,
          "borrowAPY": 4.92,
          "rewardAPY": 1.2,
          "netSupplyAPY": 5.05,
          "netBorrowAPY": 3.72,
          "tvl": 1800000000,
          "utilization": 0.78,
          "poolId": "compound-v3-ethereum-usdc"
        },
        {
          "protocol": "Morpho",
          "chain": "Ethereum",
          "supplyAPY": 4.50,
          "borrowAPY": 5.30,
          "rewardAPY": 0.5,
          "netSupplyAPY": 5.00,
          "netBorrowAPY": 4.80,
          "tvl": 800000000,
          "utilization": 0.85,
          "poolId": "morpho-ethereum-usdc"
        }
      ],
      "bestSupply": { "protocol": "Compound V3", "apy": 5.05, "chain": "Ethereum" },
      "bestBorrow": { "protocol": "Compound V3", "apy": 3.72, "chain": "Ethereum" },
      "spread": 1.33
    }
  ],
  "protocols": ["Aave V3", "Compound V3", "Morpho", "Spark", "Radiant", "Benqi"],
  "summary": {
    "avgSupplyAPY": 3.85,
    "avgBorrowAPY": 5.20,
    "bestOverallSupply": { "asset": "USDC", "protocol": "Compound V3", "apy": 5.05 },
    "lowestBorrow": { "asset": "ETH", "protocol": "Morpho", "apy": 2.15 },
    "assetCount": 10
  }
}
```

Target assets: USDC, USDT, DAI, WETH, WBTC, wstETH, cbETH, LINK, UNI, AAVE

Target protocols: Aave V3, Compound V3, Morpho, Spark, Radiant V2, Benqi, Venus, JustLend

### 2. `src/components/LendingRatesPanel.ts` — Lending Rate Comparison

**View 1: Asset-Centric (default)**
- Select an asset (USDC, ETH, etc.) from a tab/dropdown
- See all lending protocols side-by-side with supply APY, borrow APY, utilization
- Highlight the best supply & lowest borrow rates

**View 2: Protocol-Centric**
- Select a protocol (Aave, Compound, etc.)
- See all available assets with their rates

**Visual elements:**
- Rate bars: horizontal bars showing APY magnitude
- Best rate: highlighted with star/crown icon and green accent
- Utilization gauge: small progress bar per row
- Spread indicator: difference between supply and borrow APY
- Chain badge: small pill showing which chain (Ethereum, Arbitrum, etc.)

```typescript
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';

export class LendingRatesPanel extends Panel {
  private data: any = null;
  private selectedAsset: string = 'USDC';
  private viewMode: 'asset' | 'protocol' = 'asset';
  private loading = true;
  private error: string | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private abortController: AbortController | null = null;
  
  constructor() {
    super({
      id: 'lending-rates',
      title: 'Lending Rates',
      showCount: true,
      infoTooltip: 'Compare supply and borrow rates across DeFi lending protocols'
    });
    void this.fetchData();
    this.refreshInterval = setInterval(() => this.fetchData(), 5 * 60000);
  }

  // Render asset tabs, protocol comparison table, best rate highlights
  // Support switching between asset-centric and protocol-centric views
}
```

### 3. `src/types/index.ts` — Add Types

```typescript
export interface LendingRate {
  protocol: string;
  chain: string;
  supplyAPY: number;
  borrowAPY: number;
  rewardAPY: number;
  netSupplyAPY: number;
  netBorrowAPY: number;
  tvl: number;
  utilization: number;
  poolId: string;
}

export interface LendingAsset {
  symbol: string;
  name: string;
  rates: LendingRate[];
  bestSupply: { protocol: string; apy: number; chain: string };
  bestBorrow: { protocol: string; apy: number; chain: string };
  spread: number;
}

export interface LendingRatesResult {
  timestamp: string;
  assets: LendingAsset[];
  protocols: string[];
  summary: {
    avgSupplyAPY: number;
    avgBorrowAPY: number;
    bestOverallSupply: { asset: string; protocol: string; apy: number };
    lowestBorrow: { asset: string; protocol: string; apy: number };
    assetCount: number;
  };
}
```

### 4. `src/config/panels.ts` — Register Panel

Add to `FULL_PANELS` after `'defi-yields'`:
```typescript
'lending-rates': { name: 'Lending Rates', enabled: true, priority: 1 },
```

### 5. `src/App.ts` — Lazy Factory

```typescript
this.lazyFactories.set('lending-rates', async () => {
  const { LendingRatesPanel } = await import('@/components/LendingRatesPanel');
  return new LendingRatesPanel();
});
```

## CSS Styling

- Asset tabs: `.lending-asset-tabs` with `.lending-asset-tab` pills (scrollable horizontal)
- Active asset: `.lending-asset-tab.active` (green accent)
- Rate row: `.lending-rate-row` with protocol name, supply bar, borrow bar, utilization
- Best badge: `.lending-best-badge` (gold star icon + "Best" text)
- APY bars: `.lending-apy-bar.supply` (green gradient), `.lending-apy-bar.borrow` (orange/red gradient)
- Chain pill: `.lending-chain-badge` (tiny colored pill: blue for ETH, etc.)
- Reward APY: `.lending-reward-apy` (purple text, shows reward token boost)
- Utilization bar: `.lending-util-bar` with `.lending-util-fill` (changes color at different thresholds)
- Spread: `.lending-spread` showing the gap between supply and borrow

## Testing

1. `npm run typecheck` passes
2. Panel shows asset tabs with correct rate data
3. Best rates are highlighted correctly
4. Switching assets updates the comparison table
5. Protocol-centric view works
6. Chain badges display correctly
7. Graceful fallback if DeFiLlama yields API is down

## Do NOT

- Do NOT introduce React
- Do NOT modify the existing `defi-yields` panel or API route
- Do NOT duplicate data fetching — reuse DeFiLlama yields data
