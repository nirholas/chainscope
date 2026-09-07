# Agent Task 09: Cross-Chain Bridge Monitor

## Objective

Create a bridge monitoring panel that tracks cross-chain bridge volumes, health status, and security alerts. Bridge exploits are the #1 DeFi security risk — real-time bridge monitoring is essential.

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6
- Panel components extend `Panel` from `src/components/Panel.ts`
- API routes are Edge Runtime JavaScript in `api/`
- Types in `src/types/index.ts`, panel config in `src/config/panels.ts`
- There's already a `hack-alerts` panel — this is complementary (bridges focus)

## Data Sources

- **DeFiLlama Bridges**: `https://bridges.llama.fi/bridges` — all bridges with volume data
- **DeFiLlama Bridge Volume**: `https://bridges.llama.fi/bridge/{id}` — individual bridge detail
- **DeFiLlama Bridge Transactions**: `https://bridges.llama.fi/transactions/{id}?starttimestamp=X&endtimestamp=Y`
- **DeFiLlama Bridge Day Data**: `https://bridges.llama.fi/bridgedaystats/{timestamp}/{chain}` — daily stats per chain

These are all free, no API key needed.

## Files to Create

### 1. `api/bridge-monitor.js` — Edge API Route

```javascript
export const config = { runtime: 'edge' };
```

Fetch from DeFiLlama bridges API:
1. Get all bridges: `GET https://bridges.llama.fi/bridges`
2. Get recent volume: `GET https://bridges.llama.fi/bridges?includeChains=true`

Response shape:
```json
{
  "timestamp": "...",
  "bridges": [
    {
      "id": 1,
      "name": "Arbitrum Bridge",
      "displayName": "Arbitrum",
      "icon": "chain:arbitrum",
      "chains": ["Ethereum", "Arbitrum"],
      "volume24h": 125000000,
      "volume7d": 850000000,
      "volumeChange24h": 12.5,
      "currentDayDeposits": 65000000,
      "currentDayWithdrawals": 60000000,
      "netFlow": 5000000,
      "netFlowDirection": "inflow",
      "txCount24h": 15000,
      "status": "healthy"
    }
  ],
  "chainSummary": [
    {
      "chain": "Ethereum",
      "totalDeposits24h": 500000000,
      "totalWithdrawals24h": 480000000,
      "netFlow": 20000000,
      "activeBridges": 12
    }
  ],
  "alerts": [
    {
      "type": "high-volume",
      "bridge": "Arbitrum Bridge",
      "message": "24h volume 45% above 7d average",
      "severity": "info",
      "timestamp": "..."
    }
  ],
  "summary": {
    "totalVolume24h": 2500000000,
    "totalVolume7d": 15000000000,
    "activeBridges": 25,
    "largestBridge": "Arbitrum Bridge",
    "biggestNetInflow": { "chain": "Base", "amount": 50000000 },
    "biggestNetOutflow": { "chain": "Ethereum", "amount": -80000000 }
  }
}
```

Generate alerts automatically:
- `high-volume`: Bridge volume >30% above 7d average
- `net-outflow`: Large net outflow from a chain (>$50M/day)
- `imbalance`: Deposits/withdrawals ratio >2:1 or <1:2

### 2. `src/components/BridgeMonitorPanel.ts` — Bridge Monitor Panel

**Section 1: Overview Stats**
- Total 24h bridge volume
- Net flow direction across all bridges
- Active bridge count
- Volume change vs 7d avg

**Section 2: Bridge Rankings (sortable table)**
- Columns: Name, 24h Volume, 7d Volume, Net Flow (with arrow), Tx Count, Status badge
- Sortable by clicking column headers
- Color net flows: green=inflow, red=outflow

**Section 3: Chain Net Flows**
- Horizontal bars showing net capital flow per chain
- Green bars = net inflow, Red bars = net outflow
- Centered at zero line

**Section 4: Alerts**
- List of auto-generated alerts (high volume, imbalance, outflow warnings)
- Color-coded by severity

```typescript
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { formatTvl } from '@/utils/defi-format';

export class BridgeMonitorPanel extends Panel {
  private data: any = null;
  private sortColumn: string = 'volume24h';
  private sortDirection: 'asc' | 'desc' = 'desc';
  // ... standard pattern
  
  constructor() {
    super({
      id: 'bridge-monitor',
      title: 'Bridge Monitor',
      showCount: true,
      infoTooltip: 'Cross-chain bridge volumes, net flows, and health alerts'
    });
  }
}
```

### 3. `src/types/index.ts` — Add Types

```typescript
export interface BridgeData {
  id: number;
  name: string;
  displayName: string;
  icon: string;
  chains: string[];
  volume24h: number;
  volume7d: number;
  volumeChange24h: number;
  currentDayDeposits: number;
  currentDayWithdrawals: number;
  netFlow: number;
  netFlowDirection: 'inflow' | 'outflow' | 'balanced';
  txCount24h: number;
  status: 'healthy' | 'degraded' | 'down';
}

export interface BridgeChainSummary {
  chain: string;
  totalDeposits24h: number;
  totalWithdrawals24h: number;
  netFlow: number;
  activeBridges: number;
}

export interface BridgeAlert {
  type: 'high-volume' | 'net-outflow' | 'imbalance';
  bridge: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

export interface BridgeMonitorResult {
  timestamp: string;
  bridges: BridgeData[];
  chainSummary: BridgeChainSummary[];
  alerts: BridgeAlert[];
  summary: {
    totalVolume24h: number;
    totalVolume7d: number;
    activeBridges: number;
    largestBridge: string;
    biggestNetInflow: { chain: string; amount: number };
    biggestNetOutflow: { chain: string; amount: number };
  };
}
```

### 4. `src/config/panels.ts` — Register Panel

Add to `FULL_PANELS` in Tier 2 (after `'exchange-flow'`):
```typescript
'bridge-monitor': { name: 'Bridge Monitor', enabled: true, priority: 1 },
```

### 5. `src/App.ts` — Lazy Factory

```typescript
this.lazyFactories.set('bridge-monitor', async () => {
  const { BridgeMonitorPanel } = await import('@/components/BridgeMonitorPanel');
  return new BridgeMonitorPanel();
});
```

## CSS Styling

- Net flow bars: `.bridge-flow-bar` with green fill for inflow, red for outflow
- Status badge: `.bridge-status-healthy` (green dot), `.bridge-status-degraded` (yellow), `.bridge-status-down` (red)
- Volume change: `.bridge-vol-change.positive` (green), `.bridge-vol-change.negative` (red)
- Alert items: `.bridge-alert` with left border colored by severity
- Sortable headers: `.bridge-sort-header` with arrow indicator
- Chain flow chart: `.bridge-chain-flow` with centered zero-line bars

## Testing

1. `npm run typecheck` passes
2. Panel renders with bridge rankings
3. Net flow bars display correctly (green for inflow, red for outflow)
4. Sorting by column works
5. Alerts auto-generate based on data
6. Graceful fallback if DeFiLlama is down

## Do NOT

- Do NOT introduce React
- Do NOT modify existing panels
- Do NOT change the existing `hack-alerts` panel
