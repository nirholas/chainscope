# Agent Task 14: On-Chain Activity Metrics

## Objective

Create a panel showing on-chain activity metrics across major chains: daily active addresses, transaction counts, new wallets created, gas consumed. Essential for understanding adoption and network health.

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6
- Panel components extend `Panel` from `src/components/Panel.ts`
- API routes are Edge Runtime JavaScript in `api/`
- Types in `src/types/index.ts`, panel config in `src/config/panels.ts`
- d3 7.9 is available for charts

## Data Sources

- **DeFiLlama Active Addresses**: `https://api.llama.fi/activeUsers` — daily active addresses per chain
- **DeFiLlama Chain Stats**: Various endpoints for chain-level metrics
- **Blockchair Stats**: `https://api.blockchair.com/ethereum/stats` — Ethereum chain stats (free tier)
- **Etherscan Charts API**: For historical on-chain metrics (limited free tier)

Primary strategy: DeFiLlama's chain metrics where available, supplemented with direct RPC calls for basic stats.

## Files to Create

### 1. `api/chain-activity.js` — Edge API Route

```javascript
export const config = { runtime: 'edge' };
```

Aggregate on-chain activity from multiple sources:

1. DeFiLlama active users endpoint (if available)
2. Blockchair stats for Ethereum
3. Direct JSON-RPC for block gas and tx count on major chains

Target chains: Ethereum, Solana, Arbitrum, Base, Optimism, Polygon, BSC, Avalanche

Response shape:
```json
{
  "timestamp": "...",
  "chains": [
    {
      "chain": "ethereum",
      "name": "Ethereum",
      "color": "#627EEA",
      "metrics": {
        "dailyActiveAddresses": 450000,
        "dailyActiveAddressesChange": 5.2,
        "dailyTransactions": 1200000,
        "dailyTransactionsChange": -2.1,
        "avgBlockTime": 12.05,
        "avgGasPrice": 25.5,
        "gasUsed24h": 150000000000000,
        "totalTxLast7d": 8200000,
        "newContracts24h": 1500,
        "avgTxFee": 3.25
      }
    }
  ],
  "comparison": {
    "mostActive": { "chain": "solana", "txCount": 45000000 },
    "fastestGrowing": { "chain": "base", "growthPercent": 15.2 },
    "cheapest": { "chain": "solana", "avgFee": 0.00025 },
    "mostExpensive": { "chain": "ethereum", "avgFee": 3.25 }
  },
  "summary": {
    "totalDailyTx": 52000000,
    "totalActiveAddresses": 2500000,
    "chainCount": 8
  }
}
```

### 2. `src/components/ChainActivityPanel.ts` — On-Chain Activity Panel

**Section 1: Activity Overview Cards**
- Total daily transactions across all chains
- Total active addresses
- Highest growth chain (badge)

**Section 2: Chain Comparison Table**
- Sortable table with columns: Chain, Daily Txs, Active Addresses, Avg Fee, Growth
- Each chain has its brand color
- Horizontal bars for relative comparison

**Section 3: Mini Bar Chart**
- d3 bar chart showing daily transactions per chain
- Horizontal grouped bars, one color per chain

```typescript
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import * as d3 from 'd3';

export class ChainActivityPanel extends Panel {
  private data: any = null;
  private sortColumn: string = 'dailyTransactions';
  private sortDirection: 'asc' | 'desc' = 'desc';
  // ... standard pattern

  constructor() {
    super({
      id: 'chain-activity',
      title: 'Chain Activity',
      showCount: true,
      infoTooltip: 'Daily active addresses, transaction volume, and fees across major chains'
    });
    void this.fetchData();
    this.refreshInterval = setInterval(() => this.fetchData(), 5 * 60000);
  }

  private renderChart(): void {
    const chartContainer = this.content.querySelector('.chain-activity-chart');
    if (!chartContainer || !this.data) return;

    const chains = this.data.chains.slice(0, 8);
    const w = chartContainer.clientWidth || 280;
    const h = 120;
    const margin = { top: 5, right: 5, bottom: 20, left: 60 };

    const svg = d3.select(chartContainer).append('svg').attr('width', w).attr('height', h);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand()
      .domain(chains.map(c => c.name))
      .range([0, h - margin.top - margin.bottom])
      .padding(0.2);

    const x = d3.scaleLinear()
      .domain([0, d3.max(chains, c => c.metrics.dailyTransactions)])
      .range([0, w - margin.left - margin.right]);

    g.selectAll('rect')
      .data(chains)
      .join('rect')
      .attr('y', d => y(d.name)!)
      .attr('width', d => x(d.metrics.dailyTransactions))
      .attr('height', y.bandwidth())
      .attr('fill', d => d.color)
      .attr('rx', 2);

    // Labels, axes...
  }
}
```

### 3. `src/types/index.ts` — Add Types

```typescript
export interface ChainActivityMetrics {
  dailyActiveAddresses: number;
  dailyActiveAddressesChange: number;
  dailyTransactions: number;
  dailyTransactionsChange: number;
  avgBlockTime: number;
  avgGasPrice: number;
  gasUsed24h: number;
  totalTxLast7d: number;
  newContracts24h: number;
  avgTxFee: number;
}

export interface ChainActivity {
  chain: string;
  name: string;
  color: string;
  metrics: ChainActivityMetrics;
}

export interface ChainActivityResult {
  timestamp: string;
  chains: ChainActivity[];
  comparison: {
    mostActive: { chain: string; txCount: number };
    fastestGrowing: { chain: string; growthPercent: number };
    cheapest: { chain: string; avgFee: number };
    mostExpensive: { chain: string; avgFee: number };
  };
  summary: {
    totalDailyTx: number;
    totalActiveAddresses: number;
    chainCount: number;
  };
}
```

### 4. `src/config/panels.ts` — Register Panel

Add to `FULL_PANELS` in Tier 2:
```typescript
'chain-activity': { name: 'Chain Activity', enabled: true, priority: 2 },
```

### 5. `src/App.ts` — Lazy Factory

```typescript
this.lazyFactories.set('chain-activity', async () => {
  const { ChainActivityPanel } = await import('@/components/ChainActivityPanel');
  return new ChainActivityPanel();
});
```

## CSS Styling

- Stat cards: `.chain-act-stat` with `.chain-act-stat-value` and `.chain-act-stat-label`
- Growth change: `.chain-act-change.positive` (green ↑), `.chain-act-change.negative` (red ↓)
- Chain color dot: `.chain-act-dot` (12px circle with chain brand color)
- Comparison bars: `.chain-act-bar` with fill proportional to value
- Table: `.chain-act-table` with sortable headers
- Fee value: `.chain-act-fee` colored from green (cheap) to red (expensive)
- Chart container: `.chain-activity-chart` with dark background

## Testing

1. `npm run typecheck` passes
2. Panel shows chain comparison table
3. Bar chart renders correctly with d3
4. Sorting by columns works
5. Growth indicators show correct direction
6. Graceful fallback for unavailable chain data

## Do NOT

- Do NOT introduce React
- Do NOT modify existing panels
- Do NOT change the existing gas tracker panel
