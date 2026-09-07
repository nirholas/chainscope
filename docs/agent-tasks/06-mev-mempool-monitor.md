# Agent Task 06: MEV & Mempool Monitor

## Objective

Create a MEV (Maximal Extractable Value) and mempool monitoring panel that tracks sandwich attacks, arbitrage, liquidation MEV, and large pending transactions. This is a feature no DeFi dashboard does well visually.

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6
- Panel components extend `Panel` from `src/components/Panel.ts`
- API routes are Edge Runtime JavaScript in `api/`
- Types in `src/types/index.ts`, panel config in `src/config/panels.ts`

## Data Sources

- **Flashbots MEV-Explore**: `https://mev-explore.flashbots.net` — historical MEV data
- **EigenPhi**: `https://eigenphi.io` — MEV transaction analysis
- **libMEV API**: `https://api.libmev.com` — open MEV data
- **Flashbots Blocks API**: `https://blocks.flashbots.net/v1/blocks?limit=10` — recent MEV blocks
- **mempool.space API**: `https://mempool.space/api/v1/fees/mempool-blocks` — Bitcoin mempool (for comparison)
- **Ultrasound.money relay**: MEV relay data

Use whichever of these are freely accessible. Flashbots blocks API is a good primary source.

## Files to Create

### 1. `api/mev-monitor.js` — Edge API Route

```javascript
export const config = { runtime: 'edge' };
```

Fetch from multiple MEV data sources. Primary: Flashbots blocks API.

Response shape:
```json
{
  "timestamp": "...",
  "recentBlocks": [
    {
      "blockNumber": 19500000,
      "mevReward": 0.45,
      "mevRewardUSD": 1575,
      "gasUsed": 12500000,
      "txCount": 180,
      "builderName": "beaverbuild",
      "timestamp": "2024-...",
      "sandwichCount": 3,
      "arbitrageCount": 5,
      "liquidationCount": 1
    }
  ],
  "stats": {
    "totalMev24h": 2500000,
    "avgMevPerBlock": 0.35,
    "topBuilder": "beaverbuild",
    "builderDominance": 45.2,
    "sandwichVolume24h": 15000000,
    "arbitrageProfit24h": 800000
  },
  "topSandwiches": [
    {
      "hash": "0x...",
      "victimSwap": { "token": "PEPE", "amount": 50000, "dex": "Uniswap V3" },
      "profit": 1250,
      "profitUSD": 1250,
      "blockNumber": 19499998,
      "timestamp": "..."
    }
  ],
  "builderShare": [
    { "name": "beaverbuild", "share": 45.2, "blockCount": 650 },
    { "name": "Titan", "share": 32.1, "blockCount": 462 },
    { "name": "rsync", "share": 12.5, "blockCount": 180 }
  ],
  "summary": {
    "totalBlocks": 100,
    "avgMevUSD": 1200,
    "sandwichRate": 0.15,
    "topMevType": "arbitrage"
  }
}
```

### 2. `src/components/MevMonitorPanel.ts` — MEV Monitor Panel

A multi-section panel with:

**Section 1: MEV Stats Overview**
- Total MEV extracted (24h) in ETH and USD
- Average MEV per block
- Sandwich attack rate (% of blocks)
- Arbitrage profit (24h)

**Section 2: Block Builder Market Share**
- Horizontal bar chart showing builder dominance (beaverbuild, Titan, rsync, etc.)
- Use simple CSS bars or inline SVG

**Section 3: Recent MEV Blocks**
- Scrollable list of recent blocks with MEV reward, builder, sandwich/arb counts
- Color-code by MEV amount (green=low, yellow=medium, red=high)

**Section 4: Top Sandwich Attacks**
- List of recent sandwich attacks with victim token, profit extracted
- Link to etherscan for the tx hash

```typescript
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';

export class MevMonitorPanel extends Panel {
  private data: any = null;
  private loading = true;
  private error: string | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    super({ 
      id: 'mev-monitor', 
      title: 'MEV Monitor', 
      showCount: true,
      infoTooltip: 'Tracks MEV extraction, sandwich attacks, and block builder competition on Ethereum'
    });
    void this.fetchData();
    this.refreshInterval = setInterval(() => this.fetchData(), 60000); // 1 min refresh
  }

  destroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.abortController?.abort();
    super.destroy();
  }

  private async fetchData(): Promise<void> {
    this.abortController?.abort();
    this.abortController = new AbortController();
    try {
      const res = await fetch('/api/mev-monitor', { signal: this.abortController.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.data = await res.json();
      this.error = null;
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      this.error = err.message || 'Failed to fetch';
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private render(): void {
    // Build HTML sections for stats, builder share, recent blocks, sandwiches
  }
}
```

### 3. `src/types/index.ts` — Add Types

```typescript
export interface MevBlock {
  blockNumber: number;
  mevReward: number;
  mevRewardUSD: number;
  gasUsed: number;
  txCount: number;
  builderName: string;
  timestamp: string;
  sandwichCount: number;
  arbitrageCount: number;
  liquidationCount: number;
}

export interface MevSandwich {
  hash: string;
  victimSwap: { token: string; amount: number; dex: string };
  profit: number;
  profitUSD: number;
  blockNumber: number;
  timestamp: string;
}

export interface MevBuilderShare {
  name: string;
  share: number;
  blockCount: number;
}

export interface MevMonitorResult {
  timestamp: string;
  recentBlocks: MevBlock[];
  stats: {
    totalMev24h: number;
    avgMevPerBlock: number;
    topBuilder: string;
    builderDominance: number;
    sandwichVolume24h: number;
    arbitrageProfit24h: number;
  };
  topSandwiches: MevSandwich[];
  builderShare: MevBuilderShare[];
  summary: {
    totalBlocks: number;
    avgMevUSD: number;
    sandwichRate: number;
    topMevType: string;
  };
}
```

### 4. `src/config/panels.ts` — Register Panel

Add to `FULL_PANELS` in Tier 2 section:
```typescript
'mev-monitor': { name: 'MEV Monitor', enabled: true, priority: 1 },
```

### 5. `src/App.ts` — Lazy Factory

```typescript
this.lazyFactories.set('mev-monitor', async () => {
  const { MevMonitorPanel } = await import('@/components/MevMonitorPanel');
  return new MevMonitorPanel();
});
```

## CSS Styling

- Stats grid: `.mev-stats-grid` (2x2 grid of stat cards)
- Each stat: `.mev-stat-card` with `.mev-stat-value` and `.mev-stat-label`
- Builder bars: `.mev-builder-bar` with `.mev-builder-fill` (colored by builder)
- Block list: `.mev-block-row` with alternating background
- Sandwich alerts: `.mev-sandwich-item` with red accent border
- Links: `.mev-etherscan-link` styled as subtle blue links

## Color Scheme

- MEV Reward: gradient from green (low) → yellow → red (high)
- Sandwich attacks: red accent (#ff4444)
- Arbitrage: blue accent (#4488ff)
- Liquidations: orange accent (#ff8844)
- Builder bars: each builder gets a consistent color

## Testing

1. `npm run typecheck` passes
2. Panel renders with all 4 sections
3. Builder share bars display correctly
4. Sandwich attacks show with correct formatting
5. Graceful fallback if Flashbots API is unavailable

## Do NOT

- Do NOT introduce React
- Do NOT modify existing panels or API routes
- Do NOT require API keys for basic functionality (Flashbots blocks API is free)
